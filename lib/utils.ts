import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Placeholder avatar used when a user has no profile photo. */
export const DEFAULT_AVATAR =
  "https://placehold.co/400x400/EBF4FF/76A9FA?text=User";

export const SMALL_AVATAR =
  "https://placehold.co/40x40/f3f4f6/6b7280?text=?";

/**
 * Normalises any Firestore date representation (Timestamp, Date, ISO string or
 * epoch ms) to epoch milliseconds. Returns 0 for anything unparseable, so
 * callers can treat 0 as "unknown".
 */
export function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      /* fall through to the generic parse */
    }
  }
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value as string | number).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Safely format a value that may be a Firestore Timestamp, Date, ISO string or ms number. */
export function formatTimestamp(value: unknown): string {  if (!value) return "Date not set";

  // Firestore Timestamp has a toDate() method.
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const withToDate = value as { toDate: () => Date };
    try {
      return withToDate.toDate().toLocaleString();
    } catch {
      /* fall through */
    }
  }

  if (value instanceof Date) return value.toLocaleString();

  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? "Date not set" : parsed.toLocaleString();
}

/** Short relative-ish time, e.g. "just now", "5m", "3h", "2d". */
export function timeAgo(value: unknown): string {
  if (!value) return "";
  let date: Date;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    date = (value as { toDate: () => Date }).toDate();
  } else if (value instanceof Date) {
    date = value;
  } else {
    date = new Date(value as string | number);
  }
  if (Number.isNaN(date.getTime())) return "";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Deterministic gradient for avatars/fallbacks based on a seed string. */
export function seedGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 45%))`;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Event timing summary: day + start–end + relative status.
 * Falls back to legacy `date` when startsAt/endsAt are absent.
 */
export function eventTiming(event: {
  date?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
}): { line: string; status: string } {
  const startMs = toMillis((event.startsAt as unknown) ?? event.date);
  const endMs = toMillis((event.endsAt as unknown) ?? event.date);
  if (!startMs) return { line: formatTimestamp(event.date), status: "" };
  const start = new Date(startMs);
  const end = endMs ? new Date(endMs) : start;
  const day = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameDay = start.toDateString() === end.toDateString();
  const line = sameDay
    ? `${day} · ${time(start)} – ${time(end)}`
    : `${day} ${time(start)} → ${end.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })} ${time(end)}`;
  const now = Date.now();
  let status = "";
  if (now < startMs) {
    const diffH = (startMs - now) / 36e5;
    status =
      diffH < 1
        ? `Starts in ${Math.max(1, Math.round(diffH * 60))}m`
        : diffH < 24
          ? `Starts in ${Math.round(diffH)}h`
          : `Starts in ${Math.round(diffH / 24)}d`;
  } else if (now <= endMs) {
    status = "Ongoing now";
  } else {
    status = "Ended";
  }
  return { line, status };
}

/**
 * A short, colour-keyed label for a file's type, e.g. "PDF", "DOCX", "IMG".
 *
 * Prefers the extension because it is what users recognise; falls back to the
 * MIME type when the name has no usable extension.
 */
export function fileKindLabel(mimeType: string, fileName: string): string {
  const extension = fileName.split(".").pop()?.toUpperCase();
  if (extension && extension.length <= 4) return extension;
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/")) return "IMG";
  return "FILE";
}

/**
 * Whether a piece of content belongs to the current user.
 *
 * Matching on the id alone is NOT reliable. This app moved from Firebase Phone
 * Auth to Google Sign-In, and those providers issue **different UIDs** (see
 * GOOGLE_AUTH_MIGRATION.md). Everything the user created before the switch still
 * carries their OLD uid, so a uid-only check says "not yours" — which showed
 * their own chat messages on the wrong side and hid the edit/delete menu on
 * their own older posts and projects.
 *
 * Usernames survive that migration (profile recovery copies the same username
 * onto the new uid) and are unique thanks to the `usernames` lock collection, so
 * they make a safe secondary match.
 */
/**
 * Builds an inline **image** preview of a PDF's first page.
 *
 * Why this matters: Cloudinary serves PDFs as `image` assets but **blocks raw
 * .pdf delivery by default** on newer accounts, so a direct link shows
 * "Failed to load PDF document". Requesting a *page* transformation
 * (`pg_1,f_jpg`) is delivered as a JPEG — a normal image request — so the
 * preview works without that account setting. The raw file still needs the
 * setting enabled to download.
 *
 * Returns null for anything that isn't a Cloudinary-hosted PDF.
 */
export function cloudinaryPdfPageUrl(
  url: string,
  page = 1,
  width = 900
): string | null {
  if (!url || !/\.pdf(\?.*)?$/i.test(url)) return null;
  const marker = "/image/upload/";
  const index = url.indexOf(marker);
  if (index === -1) return null;

  const head = url.slice(0, index + marker.length);
  const tail = url.slice(index + marker.length);
  const withoutExtension = tail.replace(/\.pdf(\?.*)?$/i, "");
  return `${head}pg_${page},f_jpg,w_${width}/${withoutExtension}.jpg`;
}

/**
 * SHA-256 hex digest of a file's bytes.
 *
 * Used for duplicate-note detection: the same file uploaded twice produces the
 * same hash. Returns "" when WebCrypto is unavailable, and callers treat an
 * empty hash as "unknown" rather than as a match.
 */
export async function hashFile(file: File): Promise<string> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

/** Lower-cased, punctuation-stripped, whitespace-collapsed form for comparison. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isOwnedBy(
  ownerId: string | null | undefined,
  ownerUsername: string | null | undefined,
  viewer: { id: string; username: string } | null | undefined
): boolean {
  if (!viewer) return false;
  if (ownerId && ownerId === viewer.id) return true;
  const owner = ownerUsername?.toLowerCase().trim();
  const me = viewer.username?.toLowerCase().trim();
  return Boolean(owner && me && owner === me);
}
