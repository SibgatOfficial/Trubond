"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
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
import { CoverPicker } from "@/components/shared/cover-picker";
import { updateEvent } from "@/lib/services/events";
import { uploadCoverImage } from "@/lib/services/storage";
import { toMillis } from "@/lib/utils";
import type { EventItem } from "@/types";
import { toast } from "sonner";

/** Converts a stored date into the `datetime-local` input format. */
function toLocalInputValue(value: unknown): string {
  const ms = toMillis(value);
  if (!ms) return "";
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EditEventDialog({
  event,
  open,
  onOpenChange,
  onSaved,
}: {
  event: EventItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (patch: Partial<EventItem>) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [date, setDate] = React.useState("");
  const [maxAttendees, setMaxAttendees] = React.useState("50");
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [coverRemoved, setCoverRemoved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !event) return;
    setTitle(event.title ?? "");
    setDescription(event.description ?? "");
    setLocation(event.location ?? "");
    setDate(toLocalInputValue(event.date));
    setMaxAttendees(String(event.maxAttendees ?? 50));
    setCoverFile(null);
    setCoverRemoved(false);
  }, [open, event]);

  const handleCoverChange = (file: File | null) => {
    setCoverFile(file);
    if (!file) setCoverRemoved(true);
  };

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!event) return;
    if (!title.trim() || !date) {
      toast.error("Title and date are required.");
      return;
    }

    setSaving(true);
    try {
      const patch: Partial<EventItem> = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        date: new Date(date).toISOString(),
        maxAttendees: Number(maxAttendees) || 1,
      };

      if (coverFile) {
        patch.coverPhotoUrl = await uploadCoverImage(
          "events",
          event.createdBy ?? "unknown",
          coverFile
        );
      } else if (coverRemoved) {
        patch.coverPhotoUrl = null;
      }

      await updateEvent(event.id, {
        title: patch.title,
        description: patch.description,
        location: patch.location,
        date: patch.date as string,
        maxAttendees: patch.maxAttendees,
        ...(coverFile || coverRemoved
          ? { coverPhotoUrl: patch.coverPhotoUrl ?? null }
          : {}),
      });

      onSaved?.(patch);
      toast.success("Event updated");
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update event."
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
          <DialogTitle>Edit event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <CoverPicker
            file={coverFile}
            existingUrl={coverRemoved ? null : event?.coverPhotoUrl}
            onChange={handleCoverChange}
            disabled={saving}
          />

          <div>
            <Label htmlFor="ee-title">Title *</Label>
            <Input
              id="ee-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="ee-desc">Description</Label>
            <Textarea
              id="ee-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ee-location">Location</Label>
              <Input
                id="ee-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ee-date">Date &amp; time *</Label>
              <Input
                id="ee-date"
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ee-max">Max attendees</Label>
            <Input
              id="ee-max"
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
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
