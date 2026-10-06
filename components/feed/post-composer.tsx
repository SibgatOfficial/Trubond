"use client";

import * as React from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createPost } from "@/lib/services/posts";
import { compressImage, uploadPostImage } from "@/lib/services/storage";
import { DEFAULT_AVATAR, initials } from "@/lib/utils";
import type { UserProfile } from "@/types";
import { toast } from "sonner";

export function PostComposer({
  currentUser,
  open,
  onOpenChange,
}: {
  currentUser: UserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const reset = () => {
    setText("");
    setFile(null);
    setPreview(null);
  };

  const handleSubmit = async () => {
    if (!text.trim() && !file) {
      toast.error("Write something or add an image first.");
      return;
    }
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (file) {
        const compressed = await compressImage(file);
        imageUrl = await uploadPostImage(currentUser.id, compressed);
      }
      await createPost(currentUser, text.trim(), imageUrl);
      toast.success("Post published!");
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to publish post.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a post</DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={currentUser.profilePhotoUrl || DEFAULT_AVATAR}
              alt={currentUser.name}
            />
            <AvatarFallback>{initials(currentUser.name)}</AvatarFallback>
          </Avatar>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`What's on your mind, ${currentUser.name.split(" ")[0]}?`}
            className="min-h-[120px] resize-none border-0 px-0 text-base focus-visible:ring-0"
            autoFocus
          />
        </div>

        {preview && (
          <div className="relative overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Preview" className="max-h-72 w-full object-cover" />
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 top-2 h-7 w-7"
              onClick={() => setFile(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <DialogFooter className="items-center sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" /> Photo
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Posting..." : "Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
