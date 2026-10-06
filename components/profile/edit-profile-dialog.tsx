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
import { updateUserProfile } from "@/lib/services/users";
import { compressImage, uploadProfilePhoto } from "@/lib/services/storage";
import { acceptAttribute, IMAGE_UPLOAD_POLICY } from "@/lib/upload-policy";
import { useAuth } from "@/context/auth-provider";
import { BRANCHES } from "@/lib/constants";
import { DEFAULT_AVATAR } from "@/lib/utils";
import type { UserProfile } from "@/types";
import { toast } from "sonner";

export function EditProfileDialog({
  profile,
  open,
  onOpenChange,
}: {
  profile: UserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { refreshProfile } = useAuth();
  const [name, setName] = React.useState(profile.name);
  const [about, setAbout] = React.useState(profile.about ?? "");
  const [branch, setBranch] = React.useState(profile.branch ?? "");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(profile.name);
      setAbout(profile.about ?? "");
      setBranch(profile.branch ?? "");
      setPhotoFile(null);
    }
  }, [open, profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let profilePhotoUrl = profile.profilePhotoUrl || DEFAULT_AVATAR;
      if (photoFile) {
        const compressed = await compressImage(photoFile);
        profilePhotoUrl = await uploadProfilePhoto(profile.id, compressed);
      }
      await updateUserProfile(profile.id, {
        name: name.trim(),
        about,
        branch,
        profilePhotoUrl,
      });
      await refreshProfile();
      toast.success("Profile updated!");
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="ep-name">Full name</Label>
            <Input
              id="ep-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="ep-about">About</Label>
            <Textarea
              id="ep-about"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="ep-branch">Branch</Label>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger id="ep-branch" className="mt-1.5">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {BRANCHES.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ep-photo">New photo</Label>
            <Input
              id="ep-photo"
              type="file"
              accept={acceptAttribute(IMAGE_UPLOAD_POLICY)}
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
