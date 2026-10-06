import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";

/**
 * Compresses an image in the browser before upload (mirrors the original
 * browser-image-compression usage) and returns a download URL.
 */
export async function uploadImage(
  path: string,
  file: File
): Promise<string> {
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
}

export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  return uploadImage(`profile_photos/${uid}/${Date.now()}_${file.name}`, file);
}

export async function uploadPostImage(uid: string, file: File): Promise<string> {
  return uploadImage(`posts/${uid}/${Date.now()}_${file.name}`, file);
}

export async function uploadChatFile(
  chatType: string,
  roomId: string,
  file: File
): Promise<string> {
  return uploadImage(
    `chat_files/${chatType}/${roomId}/${Date.now()}_${file.name}`,
    file
  );
}

/**
 * Best-effort client-side image compression. Falls back to the original file
 * when canvas is unavailable or the file is not an image.
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
