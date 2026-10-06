"use client";

import * as React from "react";
import { FileChip } from "@/components/shared/file-chip";
import { SafeImage } from "@/components/shared/safe-image";
import { ImageLightbox } from "@/components/chat/image-lightbox";
import { PdfPreviewDialog } from "@/components/shared/pdf-preview-dialog";

/**
 * Renders a chat attachment.
 *
 * Images preview inline and open in a lightbox; every other file — PDFs
 * included — is a plain file chip. Tapping a PDF chip opens the in-app
 * first-page preview dialog instead of navigating to the raw file.
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
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const isImage = Boolean(type?.startsWith("image/"));
  const isPdf = type === "application/pdf" || /\.pdf$/i.test(name);

  if (isPdf) {
    return (
      <>
        <FileChip
          file={{ url, name, size: size ?? 0, type: type ?? "" }}
          onDownload={onDownload}
          onPreview={() => setPreviewOpen(true)}
          className="min-w-[14rem]"
        />
        <PdfPreviewDialog
          file={{ url, name, size: size ?? 0, type: type ?? "" }}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      </>
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
