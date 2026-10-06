"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Check,
  Cloud,
  Database,
  Download,
  LogOut,
  Monitor,
  Moon,
  Sun,
} from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SuccessAnimation } from "@/components/ui/lottie-animation";
import { PageHeader } from "@/components/shared/page-header";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { DEFAULT_AVATAR, cn, initials, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export default function SettingsPage() {
  const { profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const router = useRouter();

  // `theme` is undefined until mounted (next-themes reads localStorage in the
  // browser only), so highlighting is deferred to avoid a hydration mismatch.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!profile) return null;

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    router.replace("/");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Settings"
        description="Manage your appearance and account."
      />

      {/* --- Appearance ---------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sun className="h-4 w-4 text-primary" /> Appearance
          </CardTitle>
          <CardDescription>
            Choose how {`Trubond`} looks to you. Your choice is saved on this
            device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = mounted && theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setTheme(option.value);
                    toast.success(`${option.label} theme applied`);
                  }}
                  aria-pressed={active}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition-all duration-200",
                    active
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {active && (
                    <Check className="absolute right-2 top-2 h-3.5 w-3.5" />
                  )}
                  <Icon className="h-5 w-5" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* --- Install ------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4 text-primary" /> Install Trubond
          </CardTitle>
          <CardDescription>
            Add Trubond to your home screen for a full-screen app, faster loads
            and an offline fallback page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {installed ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-emerald-500" /> Trubond is installed
              on this device.
            </p>
          ) : canInstall ? (
            <Button
              className="gap-2"
              onClick={() => {
                void promptInstall();
              }}
            >
              <Download className="h-4 w-4" /> Install app
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Open your browser menu and choose{" "}
              <span className="font-medium text-foreground">
                Add to Home Screen
              </span>{" "}
              — on iOS Safari that&apos;s <span className="font-medium">Share</span>{" "}
              → <span className="font-medium">Add to Home Screen</span>.
            </p>
          )}
        </CardContent>
      </Card>

      {/* --- Account ------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" /> Account
          </CardTitle>
          <CardDescription>
            Your profile is stored in Cloud Firestore and your images are hosted
            on Cloudinary.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage
                src={profile.profilePhotoUrl || DEFAULT_AVATAR}
                alt={profile.name}
              />
              <AvatarFallback>{initials(profile.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold">{profile.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                @{profile.username}
              </p>
              {profile.email && (
                <p className="truncate text-xs text-muted-foreground">
                  {profile.email}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/profile")}>
              Edit profile
            </Button>
          </div>

          {profile.createdAt ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Cloud className="h-3.5 w-3.5" />
              Joined {timeAgo(profile.createdAt)} ago
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* --- Session ------------------------------------------------------- */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LogOut className="h-4 w-4 text-destructive" /> Session
          </CardTitle>
          <CardDescription>
            Signing out clears your session on this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <SuccessAnimation className="h-14 w-14" />
            <p className="text-sm text-muted-foreground">
              You are signed in as{" "}
              <span className="font-medium text-foreground">
                {profile.name}
              </span>
              .
            </p>
          </div>
          <Button variant="destructive" className="gap-2" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
