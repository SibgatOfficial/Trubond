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
import { createProject } from "@/lib/services/projects";
import { compressImage, uploadCoverImage } from "@/lib/services/storage";
import {
  acceptAttribute,
  checkUpload,
  IMAGE_UPLOAD_POLICY,
} from "@/lib/upload-policy";
import type { UserProfile } from "@/types";
import { toast } from "sonner";

export function CreateProjectDialog({
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
  const [skills, setSkills] = React.useState("");
  const [membersNeeded, setMembersNeeded] = React.useState("3");
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

  const reset = () => {
    setTitle("");
    setDescription("");
    setSkills("");
    setMembersNeeded("3");
    setCover(null);
  };

  const handleCoverPick = (file: File | undefined) => {
    if (!file) return;
    // Reject before any upload starts.
    const check = checkUpload(file, IMAGE_UPLOAD_POLICY);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    setCover(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required.");
      return;
    }
    setSaving(true);
    try {
      let coverPhotoUrl: string | null = null;
      if (cover) {
        const compressed = await compressImage(cover);
        coverPhotoUrl = await uploadCoverImage(
          "projects",
          currentUser.id,
          compressed
        );
      }

      await createProject(currentUser, {
        title: title.trim(),
        description: description.trim(),
        skillsRequired: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        membersNeeded: Number(membersNeeded) || 1,
        coverPhotoUrl,
      });

      toast.success("Project created!");
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create project."
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
          <DialogTitle>Create a project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Cover image</Label>
            {preview ? (
              <div className="relative mt-1.5 overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Project cover preview"
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
              Optional. Shown as the project&apos;s banner.
            </p>
          </div>

          <div>
            <Label htmlFor="p-title">Title *</Label>
            <Input
              id="p-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
              placeholder="e.g. Campus Event App"
            />
          </div>
          <div>
            <Label htmlFor="p-desc">Description *</Label>
            <Textarea
              id="p-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5"
              placeholder="What are you building?"
            />
          </div>
          <div>
            <Label htmlFor="p-skills">Skills required (comma separated)</Label>
            <Input
              id="p-skills"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="mt-1.5"
              placeholder="React, Firebase, UI/UX"
            />
          </div>
          <div>
            <Label htmlFor="p-members">Team members needed</Label>
            <Input
              id="p-members"
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
              {saving ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
