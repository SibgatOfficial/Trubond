"use client";

import * as React from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SafeImage } from "@/components/shared/safe-image";
import {
  acceptAttribute,
  checkUpload,
  IMAGE_UPLOAD_POLICY,
} from "@/lib/upload-policy";
import { toast } from "sonner";

/**
 * Optional cover-image picker shared by the project and event dialogs.
 *
 * `existingUrl` lets one control serve both "create" (nothing saved yet) and
 * "edit" (the document already has a banner). The parent tracks removal by
 * watching for a `null` callback.
 */
export function CoverPicker({
  file,
  existingUrl,
  onChange,
  disabled = false,
}: {
  file: File | null;
  existingUrl?: string | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = preview ?? existingUrl ?? null;

  const handlePick = (picked: File | undefined) => {
    if (!picked) return;
    // Reject before any upload starts.
    const check = checkUpload(picked, IMAGE_UPLOAD_POLICY);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    onChange(picked);
  };

  return (
    <div>
      <Label>Cover image</Label>

      {shown ? (
        <div className="relative mt-1.5 overflow-hidden rounded-lg border">
          <SafeImage
            src={shown}
            alt="Cover preview"
            className="h-36 w-full object-cover"
            wrapperClassName="h-36 w-full"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 h-7 w-7"
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label="Remove cover image"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1.5 gap-2"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <ImagePlus className="h-4 w-4" /> Add a cover
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={acceptAttribute(IMAGE_UPLOAD_POLICY)}
        className="hidden"
        onChange={(event) => {
          handlePick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        Optional. Shown as the banner on the card.
      </p>
    </div>
  );
}
