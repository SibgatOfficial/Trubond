"use client";

import { Download } from "lucide-react";
import { cn, fileKindLabel, formatBytes } from "@/lib/utils";

/**
 * Colour per file kind. Deliberately avoids slate/gray so the chip reads
 * correctly in both themes without needing `dark:` variants.
 */
const KIND_STYLES: Record<string, string> = {
  PDF: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  DOC: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  DOCX: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  XLS: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  XLSX: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  CSV: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  PPT: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  PPTX: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  ZIP: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  TXT: "bg-muted text-muted-foreground",
  IMG: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  FILE: "bg-muted text-muted-foreground",
};

export interface AttachedFile {
  url: string;
  name: string;
  size: number;
  type: string;
}

/**
 * A downloadable file row: type badge, name, size, download affordance.
 *
 * Note: the `download` attribute is ignored by browsers for cross-origin URLs,
 * which Cloudinary is — so this opens in a new tab rather than forcing a save.
 * That is the correct fallback, not a bug.
 */
export function FileChip({
  file,
  onDownload,
  onPreview,
  className,
}: {
  file: AttachedFile;
  onDownload?: () => void;
  /**
   * When provided, tapping the chip opens this in-app preview instead of
   * navigating to the raw file — used for PDFs, whose raw delivery Cloudinary
   * blocks by default.
   */
  onPreview?: () => void;
  className?: string;
}) {
  const kind = fileKindLabel(file.type, file.name);

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      download={file.name}
      onClick={(event) => {
        if (onPreview) {
          // Tap-to-preview: stay in-app instead of opening the raw file.
          event.preventDefault();
          onPreview();
          return;
        }
        onDownload?.();
      }}
      className={cn(
        "group flex items-center gap-3 rounded-lg border bg-card p-2.5 transition-colors hover:border-primary/40 hover:bg-accent",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
          KIND_STYLES[kind] ?? KIND_STYLES.FILE
        )}
      >
        {kind}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{file.name}</span>
        <span className="block text-xs text-muted-foreground">
          {file.size ? formatBytes(file.size) : "Unknown size"}
        </span>
      </span>
      <Download
        className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
        aria-hidden="true"
      />
      <span className="sr-only">Download {file.name}</span>
    </a>
  );
}
