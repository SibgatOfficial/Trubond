"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { createUserProfile, isUsernameAvailable } from "@/lib/services/users";
import { uploadProfilePhoto, compressImage } from "@/lib/services/storage";
import { DEFAULT_AVATAR, cn } from "@/lib/utils";
import { BRANCHES, GENDERS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type UsernameState = "idle" | "checking" | "available" | "taken";

export default function OnboardingPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();

  const [username, setUsername] = React.useState("");
  const [usernameState, setUsernameState] = React.useState<UsernameState>("idle");
  const [name, setName] = React.useState(user?.displayName ?? "");
  const [about, setAbout] = React.useState("");
  const [branch, setBranch] = React.useState("");
  const [startYear, setStartYear] = React.useState("");
  const [passingYear, setPassingYear] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/");
    else if (profile) router.replace("/home");
  }, [user, profile, loading, router]);

  // Debounced username availability check.
  React.useEffect(() => {
    const value = username.toLowerCase().trim();
    if (!value || value.length < 3) {
      setUsernameState("idle");
      return;
    }
    setUsernameState("checking");
    const handle = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(value);
        setUsernameState(available ? "available" : "taken");
      } catch {
        setUsernameState("idle");
      }
    }, 450);
    return () => clearTimeout(handle);
  }, [username]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (usernameState !== "available") {
      toast.error("Please choose an available username.");
      return;
    }
    if (!name.trim()) {
      toast.error("Please enter your full name.");
      return;
    }

    setSaving(true);
    try {
      let photoURL = DEFAULT_AVATAR;
      if (photoFile) {
        const compressed = await compressImage(photoFile);
        photoURL = await uploadProfilePhoto(user.uid, compressed);
      }

      await createUserProfile(user.uid, {
        username: username.toLowerCase().trim(),
        name: name.trim(),
        email: user.email ?? "",
        about,
        profilePhotoUrl: photoURL,
        branch,
        startYear: startYear ? Number(startYear) : null,
        passingYear: passingYear ? Number(passingYear) : null,
        gender,
        dob,
      });

      await refreshProfile();
      toast.success("Profile created! Welcome to Trubond.");
      router.replace("/home");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create profile."
      );
    } finally {
      setSaving(false);
    }
  };

  const selectClass =
    "mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-10">
      <div className="mx-auto max-w-2xl animate-fade-in">
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-bold text-primary">
            Create your profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome to Trubond! Let&apos;s get you set up.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border bg-card p-6 shadow-xl shadow-slate-200/50 sm:p-8"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. sibgat_dev"
                className="mt-1.5"
                required
              />
              <p
                className={cn(
                  "mt-1.5 h-4 text-xs font-medium",
                  usernameState === "available" && "text-emerald-600",
                  usernameState === "taken" && "text-destructive",
                  usernameState === "checking" && "text-muted-foreground"
                )}
              >
                {usernameState === "checking" && "Checking availability..."}
                {usernameState === "available" && "Username is available \u2713"}
                {usernameState === "taken" && "Username is already taken \u2715"}
              </p>
            </div>

            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email ?? ""}
                readOnly
                disabled
                className="mt-1.5"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="about">About</Label>
              <Textarea
                id="about"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Tell people about yourself..."
                className="mt-1.5"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="photo">Profile Photo</Label>
              <Input
                id="photo"
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="branch">Branch</Label>
              <select
                id="branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className={selectClass}
              >
                <option value="">Select branch</option>
                {BRANCHES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className={selectClass}
              >
                <option value="">Select gender</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="start-year">Start Year</Label>
              <Input
                id="start-year"
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                placeholder="2023"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="passing-year">Passing Year</Label>
              <Input
                id="passing-year"
                type="number"
                value={passingYear}
                onChange={(e) => setPassingYear(e.target.value)}
                placeholder="2027"
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="mt-6 w-full"
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : "Save Profile & Enter"}
          </Button>
        </form>
      </div>
    </main>
  );
}