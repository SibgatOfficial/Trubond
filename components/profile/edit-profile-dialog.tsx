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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserProfile } from "@/lib/services/users";
import { compressImage, uploadProfilePhoto } from "@/lib/services/storage";
import { acceptAttribute, IMAGE_UPLOAD_POLICY } from "@/lib/upload-policy";
import { useAuth } from "@/context/auth-provider";
import {
  BRANCH_GROUPS,
  DEGREES,
  DEGREE_GROUPS,
  DEGREE_OTHER,
} from "@/lib/constants";
import { UniversitySearch } from "@/components/shared/university-search";
import { DEFAULT_AVATAR } from "@/lib/utils";
import type { UserProfile } from "@/types";
import { toast } from "sonner";

/**
 * Split a stored degree into [select value, custom text].
 *
 * A stored value that isn't in the curated list (typed before the list
 * existed, or saved via "Other") maps to the Other option with its text.
 */
function splitDegree(stored: string | undefined): [string, string] {
  const value = (stored ?? "").trim();
  if (!value) return ["", ""];
  return DEGREES.includes(value) ? [value, ""] : [DEGREE_OTHER, value];
}

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
  const [university, setUniversity] = React.useState(profile.university ?? "");
  const [degree, setDegree] = React.useState(
    () => splitDegree(profile.degree)[0]
  );
  const [degreeCustom, setDegreeCustom] = React.useState(
    () => splitDegree(profile.degree)[1]
  );
  const [major, setMajor] = React.useState(profile.major ?? "");
  const [passingYear, setPassingYear] = React.useState(
    profile.passingYear ? String(profile.passingYear) : ""
  );
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [links, setLinks] = React.useState({
    linkedin: "",
    github: "",
    portfolio: "",
    website: "",
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(profile.name);
      setAbout(profile.about ?? "");
      setBranch(profile.branch ?? "");
      setUniversity(profile.university ?? "");
      const [storedDegree, customDegree] = splitDegree(profile.degree);
      setDegree(storedDegree);
      setDegreeCustom(customDegree);
      setMajor(profile.major ?? "");
      setPassingYear(profile.passingYear ? String(profile.passingYear) : "");
      setPhotoFile(null);
      setLinks({
        linkedin: profile.socialLinks?.linkedin ?? "",
        github: profile.socialLinks?.github ?? "",
        portfolio: profile.socialLinks?.portfolio ?? "",
        website: profile.socialLinks?.website ?? "",
      });
    }
  }, [open, profile]);

  const handleSave = async () => {
    if (!university.trim()) {
      toast.error("Please choose your college or university from the list.");
      return;
    }
    if (!passingYear) {
      toast.error("Please enter your graduation year.");
      return;
    }
    setSaving(true);
    try {
      let profilePhotoUrl = profile.profilePhotoUrl || DEFAULT_AVATAR;
      if (photoFile) {
        const compressed = await compressImage(photoFile);
        profilePhotoUrl = await uploadProfilePhoto(profile.id, compressed);
      }
      const socialLinks: NonNullable<UserProfile["socialLinks"]> = {};
      if (links.linkedin.trim()) socialLinks.linkedin = links.linkedin.trim();
      if (links.github.trim()) socialLinks.github = links.github.trim();
      if (links.portfolio.trim()) socialLinks.portfolio = links.portfolio.trim();
      if (links.website.trim()) socialLinks.website = links.website.trim();
      await updateUserProfile(profile.id, {
        name: name.trim(),
        about,
        branch,
        university: university.trim(),
        degree: (degree === DEGREE_OTHER ? degreeCustom : degree).trim(),
        major: major.trim(),
        passingYear: Number(passingYear),
        profilePhotoUrl,
        socialLinks,
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
                {BRANCH_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.options.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ep-university">College / University</Label>
            <UniversitySearch
              id="ep-university"
              value={university}
              onChange={setUniversity}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="ep-degree">Degree</Label>
            <Select value={degree} onValueChange={setDegree}>
              <SelectTrigger id="ep-degree" className="mt-1.5">
                <SelectValue placeholder="Select degree" />
              </SelectTrigger>
              <SelectContent>
                {DEGREE_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.degrees.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                <SelectSeparator />
                <SelectItem value={DEGREE_OTHER}>{DEGREE_OTHER}</SelectItem>
              </SelectContent>
            </Select>
            {degree === DEGREE_OTHER ? (
              <Input
                id="ep-degree-custom"
                placeholder="Type your degree"
                value={degreeCustom}
                onChange={(e) => setDegreeCustom(e.target.value)}
                className="mt-1.5"
              />
            ) : null}
          </div>
          <div>
            <Label htmlFor="ep-major">Major / Field of Study</Label>
            <Input
              id="ep-major"
              placeholder="e.g. Computer Science"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="ep-passing-year">Graduation Year</Label>
            <Input
              id="ep-passing-year"
              type="number"
              placeholder="2027"
              value={passingYear}
              onChange={(e) => setPassingYear(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="space-y-3 border-t pt-4">
            <div>
              <Label htmlFor="ep-linkedin">LinkedIn</Label>
              <Input
                id="ep-linkedin"
                placeholder="linkedin.com/in/username"
                value={links.linkedin}
                onChange={(e) =>
                  setLinks((p) => ({ ...p, linkedin: e.target.value }))
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ep-github">GitHub</Label>
              <Input
                id="ep-github"
                placeholder="github.com/username"
                value={links.github}
                onChange={(e) =>
                  setLinks((p) => ({ ...p, github: e.target.value }))
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ep-portfolio">Portfolio</Label>
              <Input
                id="ep-portfolio"
                placeholder="your-portfolio.com"
                value={links.portfolio}
                onChange={(e) =>
                  setLinks((p) => ({ ...p, portfolio: e.target.value }))
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ep-website">Website</Label>
              <Input
                id="ep-website"
                placeholder="your-site.com"
                value={links.website}
                onChange={(e) =>
                  setLinks((p) => ({ ...p, website: e.target.value }))
                }
                className="mt-1.5"
              />
            </div>
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
