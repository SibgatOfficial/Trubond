"use client";

import * as React from "react";
import { ExternalLink, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/shared/safe-image";
import { cloudinaryPdfPageUrl } from "@/lib/utils";
import type { AttachedFile } from "@/components/shared/file-chip";

/**
 * Tap-to-open preview for a PDF attachment.
 *
 * The first page renders as an image via `cloudinaryPdfPageUrl` because
 * Cloudinary blocks raw `.pdf` delivery by default — the "Open file" button
 * still opens the raw URL for accounts with delivery enabled.
 *
 * Replaces the always-visible inline previews that used to sit under every
 * attachment; files now show a plain chip and the preview only appears when
 * the user taps it.
 */
export function PdfPreviewDialog({
  file,
  open,
  onOpenChange,
  onOpenFile,
}: {
  file: AttachedFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user hits "Open file" — e.g. to count a note download. */
  onOpenFile?: () => void;
}) {
  const preview = file ? cloudinaryPdfPageUrl(file.url) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-rose-500" />
            <span className="truncate">{file?.name ?? "PDF"}</span>
          </DialogTitle>
          <DialogDescription>First page preview</DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="overflow-hidden rounded-lg border bg-muted/30">
            <SafeImage
              src={preview}
              alt={file ? `First page of ${file.name}` : "PDF preview"}
              className="max-h-[65vh] w-full object-contain"
              wrapperClassName="max-h-[65vh] w-full"
              fallbackLabel="Preview unavailable — use Open file instead"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Preview unavailable for this file.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {file ? (
            <Button
              className="gap-1.5"
              onClick={() => {
                onOpenFile?.();
                window.open(file.url, "_blank", "noopener,noreferrer");
              }}
            >
              <ExternalLink className="h-4 w-4" /> Open file
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}