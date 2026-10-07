"use client";

import * as React from "react";
import { Loader2, Paperclip, X } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createNote } from "@/lib/services/notes";
import { findNotesByHashes, findSimilarNotes } from "@/lib/services/notes";
import { uploadNoteFile } from "@/lib/services/storage";
import {
  acceptAttribute,
  checkUpload,
  NOTE_MAX_FILES,
  NOTE_UPLOAD_POLICY,
  policySummary,
} from "@/lib/upload-policy";
import { BRANCHES, SEMESTERS } from "@/lib/constants";
import { formatBytes, hashFile } from "@/lib/utils";
import type { Note, NoteFile, UserProfile } from "@/types";
import { toast } from "sonner";

export function CreateNoteDialog({
  currentUser,
  open,
  onOpenChange,
  existingNotes = [],
}: {
  currentUser: UserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Loaded notes, used to warn about near-identical titles before upload. */
  existingNotes?: Note[];
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [branch, setBranch] = React.useState(currentUser.branch ?? "");
  const [semester, setSemester] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [fileHashes, setFileHashes] = React.useState<string[]>([]);
  const [duplicateOf, setDuplicateOf] = React.useState<Note[]>([]);
  const [acknowledged, setAcknowledged] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  /**
   * Hash the chosen files and look for the same bytes already on the platform.
   *
   * This is a WARNING, never a block: two students photographing the same
   * handout produce different bytes, and the reverse (same title, different
   * content) is also possible.
   */
  React.useEffect(() => {
    let active = true;
    if (files.length === 0) {
      setFileHashes([]);
      setDuplicateOf([]);
      return;
    }
    (async () => {
      const hashes = (await Promise.all(files.map(hashFile))).filter(Boolean);
      if (!active) return;
      setFileHashes(hashes);
      try {
        const matches = await findNotesByHashes(hashes);
        if (active) setDuplicateOf(matches);
      } catch {
        if (active) setDuplicateOf([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [files]);

  const similarByTitle = React.useMemo(
    () =>
      title.trim().length >= 6
        ? findSimilarNotes({ title, subject, semester }, existingNotes)
        : [],
    [title, subject, semester, existingNotes]
  );

  const hasDuplicateWarning = duplicateOf.length > 0 || similarByTitle.length > 0;

  const reset = () => {
    setTitle("");
    setDescription("");
    setSubject("");
    setSemester("");
    setTags("");
    setFiles([]);
    setProgress(0);
    setFileHashes([]);
    setDuplicateOf([]);
    setAcknowledged(false);
  };

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (next.length >= NOTE_MAX_FILES) {
        toast.error(`You can attach up to ${NOTE_MAX_FILES} files per note.`);
        break;
      }
      // Validate up front so a bad file is rejected before any upload starts.
      const check = checkUpload(file, NOTE_UPLOAD_POLICY);
      if (!check.ok) {
        toast.error(`${file.name}: ${check.reason}`);
        continue;
      }
      next.push(file);
    }
    setFiles(next);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Give your note a title.");
      return;
    }
    if (hasDuplicateWarning && !acknowledged) {
      toast.error("Confirm this isn't a duplicate first.");
      return;
    }
    setSaving(true);
    setProgress(0);
    try {
      const uploaded: NoteFile[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const url = await uploadNoteFile(currentUser.id, file);
        uploaded.push({
          url,
          name: file.name,
          size: file.size,
          type: file.type,
        });
        setProgress(Math.round(((index + 1) / files.length) * 100));
      }

      await createNote(currentUser, {
        title,
        description,
        subject,
        branch,
        semester,
        tags: tags
          .split(",")
          .map((tag) => tag.trim().replace(/^#/, ""))
          .filter(Boolean)
          .slice(0, 8),
        files: uploaded,
        fileHashes,
      });

      // Close FIRST so the dialog + its Select portals unmount past the exit
      // animation before the live subscription re-renders the list — same
      // stuck `body { pointer-events: none }` race as the edit dialog.
      onOpenChange(false);
      reset();
      toast.success("Note shared with your campus!");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to share the note."
      );
    } finally {
      setSaving(false);
      setProgress(0);
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
          <DialogTitle>Share notes or an assignment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="note-title">Title *</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. DBMS Unit 3 — Normalization"
              className="mt-1.5"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="note-description">Description</Label>
            <Textarea
              id="note-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's covered, which exam it's useful for…"
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="note-subject">Subject</Label>
              <Input
                id="note-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="DBMS"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="note-semester">Semester</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger id="note-semester" className="mt-1.5">
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
            <Label htmlFor="note-branch">Branch</Label>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger id="note-branch" className="mt-1.5">
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
            <Label htmlFor="note-tags">Tags</Label>
            <Input
              id="note-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="normalization, midterm, important"
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Comma separated, up to 8.
            </p>
          </div>

          <div>
            <Label>Files</Label>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={acceptAttribute(NOTE_UPLOAD_POLICY)}
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1.5 gap-2"
              onClick={() => inputRef.current?.click()}
              disabled={saving || files.length >= NOTE_MAX_FILES}
            >
              <Paperclip className="h-4 w-4" /> Add files
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              {policySummary(NOTE_UPLOAD_POLICY)} · up to {NOTE_MAX_FILES} files
            </p>

            {files.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      aria-label={`Remove ${file.name}`}
                      disabled={saving}
                      onClick={() =>
                        setFiles((prev) =>
                          prev.filter((_, i) => i !== index)
                        )
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {hasDuplicateWarning && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                {duplicateOf.length > 0
                  ? "This exact file has already been shared"
                  : "A note with this title already exists"}
              </p>
              <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                {[...duplicateOf, ...similarByTitle].slice(0, 3).map((note) => (
                  <li key={note.id} className="truncate">
                    • {note.title}
                    {note.subject ? ` — ${note.subject}` : ""}
                  </li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                This is different — share it anyway
              </label>
            </div>
          )}

          {saving && files.length > 0 && (
            <div className="space-y-1.5">
              <Progress value={progress} aria-label="Upload progress" />
              <p className="text-xs text-muted-foreground">
                Uploading… {progress}%
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={saving || (hasDuplicateWarning && !acknowledged)}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Sharing…" : "Share note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
