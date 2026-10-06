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
import { createProject } from "@/lib/services/projects";
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
  const [saving, setSaving] = React.useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setSkills("");
    setMembersNeeded("3");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required.");
      return;
    }
    setSaving(true);
    try {
      await createProject(currentUser, {
        title: title.trim(),
        description: description.trim(),
        skillsRequired: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        membersNeeded: Number(membersNeeded) || 1,
      });
      toast.success("Project created!");
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to create project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
