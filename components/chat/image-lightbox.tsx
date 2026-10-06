"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SafeImage } from "@/components/shared/safe-image";

/**
 * Full-size image viewer.
 *
 * `DialogTitle` is rendered `sr-only` rather than omitted — Radix requires a
 * title for the dialog to be announced correctly by screen readers.
 */
export function ImageLightbox({
  src,
  alt,
  open,
  onOpenChange,
}: {
  src: string;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <SafeImage
          src={src}
          alt={alt}
          className="max-h-[85vh] w-full rounded-xl object-contain"
          wrapperClassName="h-64 w-full rounded-xl"
        />
      </DialogContent>
    </Dialog>
  );
}
