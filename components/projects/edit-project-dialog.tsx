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
import { updateProject } from "@/lib/services/projects";
import { uploadCoverImage } from "@/lib/services/storage";
import type { Project } from "@/types";
import { toast } from "sonner";

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
  onSaved,
}: {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lets the list update in place without waiting for the snapshot. */
  onSaved?: (patch: Partial<Project>) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [skills, setSkills] = React.useState("");
  const [membersNeeded, setMembersNeeded] = React.useState("3");
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [coverRemoved, setCoverRemoved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Seed the form each time the dialog opens, so a cancelled edit doesn't leak
  // into the next one.
  React.useEffect(() => {
    if (!open || !project) return;
    setTitle(project.title ?? "");
    setDescription(project.description ?? "");
    setSkills((project.skillsRequired ?? []).join(", "));
    setMembersNeeded(String(project.membersNeeded ?? 3));
    setCoverFile(null);
    setCoverRemoved(false);
  }, [open, project]);

  const handleCoverChange = (file: File | null) => {
    setCoverFile(file);
    if (!file) setCoverRemoved(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!project) return;
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required.");
      return;
    }

    setSaving(true);
    try {
      const patch: Partial<Project> = {
        title: title.trim(),
        description: description.trim(),
        skillsRequired: skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        membersNeeded: Number(membersNeeded) || 1,
      };

      if (coverFile) {
        patch.coverPhotoUrl = await uploadCoverImage(
          "projects",
          project.ownerId,
          coverFile
        );
      } else if (coverRemoved) {
        patch.coverPhotoUrl = null;
      }

      await updateProject(project.id, {
        title: patch.title,
        description: patch.description,
        skillsRequired: patch.skillsRequired,
        membersNeeded: patch.membersNeeded,
        ...(coverFile || coverRemoved
          ? { coverPhotoUrl: patch.coverPhotoUrl ?? null }
          : {}),
      });

      onSaved?.(patch);
      toast.success("Project updated");
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update project."
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
          <DialogTitle>Edit project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <CoverPicker
            file={coverFile}
            existingUrl={coverRemoved ? null : project?.coverPhotoUrl}
            onChange={handleCoverChange}
            disabled={saving}
          />

          <div>
            <Label htmlFor="ep-title">Title *</Label>
            <Input
              id="ep-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="ep-desc">Description *</Label>
            <Textarea
              id="ep-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="ep-skills">Skills required (comma separated)</Label>
            <Input
              id="ep-skills"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="ep-members">Team members needed</Label>
            <Input
              id="ep-members"
              type="number"
              min={1}
              value={membersNeeded}
              onChange={(e) => setMembersNeeded(e.target.value)}
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
