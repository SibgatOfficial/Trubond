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

/** Safely format a value that may be a Firestore Timestamp, Date, ISO string or ms number. */
export function formatTimestamp(value: unknown): string {
  if (!value) return "Date not set";

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
