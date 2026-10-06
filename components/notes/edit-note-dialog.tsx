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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateNote } from "@/lib/services/notes";
import { BRANCHES, SEMESTERS } from "@/lib/constants";
import type { Note } from "@/types";
import { toast } from "sonner";

export function EditNoteDialog({
  note,
  open,
  onOpenChange,
  onSaved,
}: {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (patch: Partial<Note>) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [branch, setBranch] = React.useState("");
  const [semester, setSemester] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !note) return;
    setTitle(note.title ?? "");
    setDescription(note.description ?? "");
    setSubject(note.subject ?? "");
    setBranch(note.branch ?? "");
    setSemester(note.semester ?? "");
    setTags((note.tags ?? []).join(", "));
  }, [open, note]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!note) return;
    if (!title.trim()) {
      toast.error("Give your note a title.");
      return;
    }

    setSaving(true);
    try {
      const patch: Partial<Note> = {
        title: title.trim(),
        description: description.trim(),
        subject: subject.trim(),
        branch,
        semester,
        tags: tags
          .split(",")
          .map((tag) => tag.trim().replace(/^#/, ""))
          .filter(Boolean)
          .slice(0, 8),
      };

      await updateNote(note.id, patch);
      onSaved?.(patch);
      toast.success("Note updated");
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update the note."
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit note</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="en-title">Title *</Label>
            <Input
              id="en-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="en-description">Description</Label>
            <Textarea
              id="en-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="en-subject">Subject</Label>
              <Input
                id="en-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="en-semester">Semester</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger id="en-semester" className="mt-1.5">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value} semester
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="en-branch">Branch</Label>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger id="en-branch" className="mt-1.5">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {BRANCHES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="en-tags">Tags</Label>
            <Input
              id="en-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Comma separated, up to 8. Attached files can&apos;t be changed here
              — delete the note and re-upload if you need different files.
            </p>
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
