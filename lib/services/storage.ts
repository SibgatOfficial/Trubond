/**
 * Cloudinary-backed file uploads (replaces Firebase Cloud Storage).
 *
 * Uploads are *unsigned*: the browser posts the file straight to Cloudinary
 * using a public cloud name plus an unsigned upload preset. No server and no
 * API secret are involved, which is required here because the app is built as
 * a static export (`output: "export"` in next.config.mjs) and therefore has no
 * backend available to sign requests.
 *
 * Required env vars (see `.env.local.example`):
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME     e.g. "trubond"
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET  e.g. "trubond_unsigned"
 */

import {
  checkUpload,
  CHAT_UPLOAD_POLICY,
  IMAGE_UPLOAD_POLICY,
  NOTE_UPLOAD_POLICY,
  type UploadPolicy,
} from "@/lib/upload-policy";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

function assertConfigured(): void {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and " +
        "NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env.local, then restart the dev server."
    );
  }
}

type CloudinaryUploadResponse = {
  secure_url?: string;
  url?: string;
  error?: { message?: string };
};

/**
 * Uploads a file and returns its public HTTPS URL.
 *
 * `path` mirrors the old Firebase object path (e.g. `posts/<uid>/<timestamp>`);
 * its directory part is forwarded to Cloudinary as the asset `folder` so the
 * existing organisation is preserved. The filename itself is left to Cloudinary,
 * which guarantees a collision-free public_id.
 *
 * Uses `XMLHttpRequest` rather than `fetch` specifically so upload progress can
 * be reported — `fetch` has no upload-progress event, which matters for the
 * 25 MB documents chat and notes now accept.
 *
 * `policy` decides which types and sizes are accepted. The check lives here
 * rather than only in the UI because every upload funnels through this function.
 */
export function uploadImageWithProgress(
  path: string,
  file: File,
  policy: UploadPolicy,
  onProgress?: (percent: number) => void
): Promise<string> {
  assertConfigured();

  const check = checkUpload(file, policy);
  if (!check.ok) {
    // Message is written for the end user and surfaced verbatim in a toast.
    return Promise.reject(new Error(check.reason));
  }

  return new Promise<string>((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", UPLOAD_PRESET);
    const folder = path.split("/").slice(0, -1).join("/");
    if (folder) body.append("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`
    );

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      let data: CloudinaryUploadResponse = {};
      try {
        data = JSON.parse(xhr.responseText) as CloudinaryUploadResponse;
      } catch {
        /* non-JSON error body; the status check below still reports it */
      }

      if (xhr.status < 200 || xhr.status >= 300 || data.error) {
        reject(
          new Error(
            data.error?.message ??
              `Cloudinary upload failed (HTTP ${xhr.status}).`
          )
        );
        return;
      }

      const url = data.secure_url ?? data.url;
      if (!url) {
        reject(new Error("Cloudinary upload succeeded but returned no URL."));
        return;
      }
      resolve(url);
    };

    xhr.onerror = () =>
      reject(new Error("Network error while uploading. Check your connection."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));

    xhr.send(body);
  });
}

/** Fire-and-forget variant for callers that don't need a progress bar. */
export async function uploadImage(
  path: string,
  file: File,
  policy: UploadPolicy
): Promise<string> {
  return uploadImageWithProgress(path, file, policy);
}

export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  return uploadImage(
    `profile_photos/${uid}/${Date.now()}_${file.name}`,
    file,
    IMAGE_UPLOAD_POLICY
  );
}

export async function uploadPostImage(uid: string, file: File): Promise<string> {
  return uploadImage(
    `posts/${uid}/${Date.now()}_${file.name}`,
    file,
    IMAGE_UPLOAD_POLICY
  );
}

export async function uploadChatFile(
  chatType: string,
  roomId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  return uploadImageWithProgress(
    `chat_files/${chatType}/${roomId}/${Date.now()}_${file.name}`,
    file,
    CHAT_UPLOAD_POLICY,
    onProgress
  );
}

/** Study material attached to a note — documents and images, larger cap. */
export async function uploadNoteFile(uid: string, file: File): Promise<string> {
  return uploadImage(
    `notes/${uid}/${Date.now()}_${file.name}`,
    file,
    NOTE_UPLOAD_POLICY
  );
}

/** Cover banner for a project or an event. Images only. */
export async function uploadCoverImage(
  kind: "projects" | "events",
  uid: string,
  file: File
): Promise<string> {
  return uploadImage(
    `${kind}/covers/${uid}/${Date.now()}_${file.name}`,
    file,
    IMAGE_UPLOAD_POLICY
  );
}

/**
 * Best-effort client-side image compression. Falls back to the original file
 * when canvas is unavailable or the file is not an image.
 *
 * Still worth keeping with Cloudinary: smaller uploads mean faster posts and
 * less bandwidth against the account's monthly quota.
 */
export async function compressImage(file: File, maxSizeMB = 1): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }
  if (file.size <= maxSizeMB * 1024 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const scale = Math.min(
      1,
      Math.sqrt((maxSizeMB * 1024 * 1024) / file.size)
    );
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, file.type, 0.85)
    );
    if (!blob) return file;
    return new File([blob], file.name, { type: file.type });
  } catch {
    return file;
  }
}
