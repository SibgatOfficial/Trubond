"use client";

import * as React from "react";
import { FileChip } from "@/components/shared/file-chip";
import { SafeImage } from "@/components/shared/safe-image";
import { ImageLightbox } from "@/components/chat/image-lightbox";
import { cloudinaryPdfPageUrl } from "@/lib/utils";

/**
 * Renders a chat attachment.
 *
 * Images preview inline and open in a lightbox; everything else becomes a
 * downloadable file card. Previously every attachment — images included — was a
 * bare underlined link with a paperclip.
 */
export function ChatFileMessage({
  url,
  name,
  size,
  type,
  onDownload,
}: {
  url: string;
  name: string;
  size?: number;
  type?: string;
  onDownload?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const isImage = Boolean(type?.startsWith("image/"));
  const isPdf = type === "application/pdf" || /\.pdf$/i.test(name);
  const pdfPreview = isPdf ? cloudinaryPdfPageUrl(url) : null;

  if (isPdf && pdfPreview) {
    return (
      <div className="space-y-2">
        {/* Page 1 rendered as an image — avoids Cloudinary's default block on
            raw PDF delivery, so the document is visible either way. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block w-full overflow-hidden rounded-lg border bg-muted/30 transition-opacity hover:opacity-90"
          aria-label={`Preview ${name}`}
        >
          <SafeImage
            src={pdfPreview}
            alt={`First page of ${name}`}
            className="max-h-72 w-full object-contain"
            wrapperClassName="h-40 w-full"
            fallbackLabel="PDF preview unavailable — open the file to view it"
          />
        </button>
        <FileChip
          file={{ url, name, size: size ?? 0, type: type ?? "" }}
          onDownload={onDownload}
          className="min-w-[14rem]"
        />
        <ImageLightbox
          src={pdfPreview}
          alt={`First page of ${name}`}
          open={open}
          onOpenChange={setOpen}
        />
      </div>
    );
  }

  if (isImage) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block overflow-hidden rounded-lg border transition-opacity hover:opacity-90"
          aria-label={`Open image ${name}`}
        >
          <SafeImage
            src={url}
            alt={name}
            className="max-h-64 w-full object-cover"
            wrapperClassName="h-32 w-full"
          />
        </button>
        <ImageLightbox
          src={url}
          alt={name}
          open={open}
          onOpenChange={setOpen}
        />
      </>
    );
  }

  return (
    <FileChip
      file={{ url, name, size: size ?? 0, type: type ?? "" }}
      onDownload={onDownload}
      className="min-w-[14rem]"
    />
  );
}
