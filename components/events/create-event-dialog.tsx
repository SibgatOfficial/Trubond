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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createEvent } from "@/lib/services/events";
import { compressImage, uploadCoverImage } from "@/lib/services/storage";
import {
  acceptAttribute,
  checkUpload,
  IMAGE_UPLOAD_POLICY,
} from "@/lib/upload-policy";
import { toast } from "sonner";
import type { UserProfile } from "@/types";

export function CreateEventDialog({
  currentUser,
  open,
  onOpenChange,
}: {
  currentUser: UserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [date, setDate] = React.useState("");
  const [maxAttendees, setMaxAttendees] = React.useState("50");
  const [cover, setCover] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const coverInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!cover) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(cover);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  const handleCoverPick = (file: File | undefined) => {
    if (!file) return;
    const check = checkUpload(file, IMAGE_UPLOAD_POLICY);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    setCover(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !date) {
      toast.error("Title and date are required.");
      return;
    }
    setSaving(true);
    try {
      let coverPhotoUrl: string | null = null;
      if (cover) {
        const compressed = await compressImage(cover);
        coverPhotoUrl = await uploadCoverImage(
          "events",
          currentUser.id,
          compressed
        );
      }

      await createEvent(currentUser, {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        date: new Date(date).toISOString(),
        maxAttendees: Number(maxAttendees) || 1,
        coverPhotoUrl,
      });

      toast.success("Event created!");
      setTitle("");
      setDescription("");
      setLocation("");
      setDate("");
      setMaxAttendees("50");
      setCover(null);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create event."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create an event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Cover image</Label>
            {preview ? (
              <div className="relative mt-1.5 overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Event cover preview"
                  className="h-36 w-full object-cover"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7"
                  onClick={() => setCover(null)}
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
                onClick={() => coverInputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" /> Add a cover
              </Button>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept={acceptAttribute(IMAGE_UPLOAD_POLICY)}
              className="hidden"
              onChange={(e) => {
                handleCoverPick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Optional. Shown as the event's banner.
            </p>
          </div>

          <div>
            <Label htmlFor="e-title">Title *</Label>
            <Input
              id="e-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Hackathon 2026"
            />
          </div>
          <div>
            <Label htmlFor="e-desc">Description</Label>
            <Textarea
              id="e-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="e-location">Location</Label>
              <Input
                id="e-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1.5"
                placeholder="Auditorium"
              />
            </div>
            <div>
              <Label htmlFor="e-date">Date &amp; time *</Label>
              <Input
                id="e-date"
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="e-max">Max attendees</Label>
            <Input
              id="e-max"
              type="number"
              min={1}
              value={maxAttendees}
              onChange={(e) => setMaxAttendees(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Creating..." : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
