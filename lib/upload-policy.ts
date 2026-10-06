/**
 * Single source of truth for which files Trubond will upload.
 *
 * Why this exists: the `accept` attribute on a file input is only a *picker
 * hint*. A user can switch the dialog to "All files", and anyone can POST
 * straight to the Cloudinary endpoint — so `accept` alone guarantees nothing.
 *
 * The same policy is therefore enforced in code inside
 * `lib/services/storage.ts` (the choke point every upload flows through) and
 * mirrored in the Cloudinary upload preset, which is the one guarantee the
 * browser cannot give.
 */

import { formatBytes } from "@/lib/utils";

export type UploadPolicy = {
  /** Human label used in error copy, e.g. "an image". */
  label: string;
  /** Exact MIME types accepted. */
  allowedMimeTypes: readonly string[];
  /** Friendly extension names, used in error copy. */
  allowedExtensions: readonly string[];
  /** Hard size ceiling in bytes. */
  maxBytes: number;
};

/**
 * `image/svg+xml` is deliberately absent everywhere: SVG can carry inline
 * script and is a stored-XSS vector when served from a URL later.
 */
const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const IMAGE_EXTENSIONS = ["JPG", "PNG", "WebP", "GIF"] as const;

/** Study material: lecture notes, assignments, past papers, slide decks. */
const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
] as const;

const DOCUMENT_EXTENSIONS = [
  "PDF",
  "DOC",
  "DOCX",
  "XLS",
  "XLSX",
  "PPT",
  "PPTX",
  "TXT",
  "CSV",
  "ZIP",
] as const;

/** Images only — post images, profile photos, onboarding. */
export const IMAGE_UPLOAD_POLICY: UploadPolicy = {
  label: "an image",
  allowedMimeTypes: [...IMAGE_MIME_TYPES],
  allowedExtensions: [...IMAGE_EXTENSIONS],
  maxBytes: 5 * 1024 * 1024,
};

/**
 * Chat attachments: images plus the same document set as notes, so chat works
 * like a messenger rather than an image-only box.
 *
 * Capped at 25 MB — large enough for a scanned assignment or a slide deck,
 * small enough that a phone on campus wifi can actually push it.
 */
export const CHAT_UPLOAD_POLICY: UploadPolicy = {
  label: "an image or document",
  allowedMimeTypes: [...DOCUMENT_MIME_TYPES, ...IMAGE_MIME_TYPES],
  allowedExtensions: [...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS],
  maxBytes: 25 * 1024 * 1024,
};

/** Documents only. */
export const DOCUMENT_UPLOAD_POLICY: UploadPolicy = {
  label: "a document",
  allowedMimeTypes: [...DOCUMENT_MIME_TYPES],
  allowedExtensions: [...DOCUMENT_EXTENSIONS],
  maxBytes: 25 * 1024 * 1024,
};

/** Notes / assignments: PDF-only for reliable in-app preview. */
export const NOTE_UPLOAD_POLICY: UploadPolicy = {
  label: "a PDF",
  allowedMimeTypes: ["application/pdf"],
  allowedExtensions: ["PDF"],
  maxBytes: 25 * 1024 * 1024,
};

/** Maximum files attached to a single note. */
export const NOTE_MAX_FILES = 5;

export type UploadCheck = { ok: true } | { ok: false; reason: string };

/**
 * Validates a file against a policy.
 *
 * Returns a reason written for the end user, because these strings are shown
 * directly in a toast.
 */
export function checkUpload(file: File, policy: UploadPolicy): UploadCheck {
  if (file.size === 0) {
    return { ok: false, reason: "That file is empty." };
  }

  if (file.size > policy.maxBytes) {
    return {
      ok: false,
      reason: `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(
        policy.maxBytes
      )}.`,
    };
  }

  // Some platforms report an empty type for unusual files.
  if (!file.type) {
    return {
      ok: false,
      reason: `We couldn't tell what kind of file that is. Please upload ${policy.label}.`,
    };
  }

  if (!policy.allowedMimeTypes.includes(file.type)) {
    return {
      ok: false,
      reason: `Only ${policy.allowedExtensions.join(
        ", "
      )} files are allowed — that one is ${file.type}.`,
    };
  }

  return { ok: true };
}

/**
 * Builds the `accept=""` value for a file input, so the markup can never drift
 * from the policy that is actually enforced.
 */
export function acceptAttribute(policy: UploadPolicy): string {
  return policy.allowedMimeTypes.join(",");
}

/** Short human summary, e.g. "JPG, PNG, WebP, GIF · up to 5 MB". */
export function policySummary(policy: UploadPolicy): string {
  return `${policy.allowedExtensions.join(", ")} · up to ${formatBytes(
    policy.maxBytes
  )}`;
}
