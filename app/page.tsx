"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, ShieldCheck, Users, Zap } from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { toast } from "sonner";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

const HIGHLIGHTS = [
  {
    icon: Users,
    title: "Connect",
    body: "Find classmates across every branch and year.",
  },
  {
    icon: Zap,
    title: "Collaborate",
    body: "Team up on projects and share notes instantly.",
  },
  {
    icon: ShieldCheck,
    title: "Verified",
    body: "Google sign-in only — no throwaway accounts.",
  },
] as const;

export default function LoginPage() {
  const { user, profile, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (loading) return;
    if (user && profile) router.replace("/home");
    else if (user && !profile) router.replace("/onboarding");
  }, [user, profile, loading, router]);

  const handleSignIn = async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
      toast.success(`Signed in — welcome to ${APP_NAME}!`);
    } catch (error) {
      console.error(error);
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // Every colour here is a semantic token, so this page follows the theme.
    // (The pre-auth pages used to hardcode a light gradient, which rendered
    // near-white text on white in dark mode.)
    <main className="relative grid min-h-screen bg-background lg:grid-cols-2">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      {/* Brand panel — desktop only */}
      <section className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        {/* One restrained highlight, not a pair of floating blobs. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60rem 40rem at 110% -10%, rgb(255 255 255 / 0.14), transparent 60%)",
          }}
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/15 backdrop-blur">
            <GraduationCap className="h-6 w-6" />
          </span>
          <span className="font-display text-2xl font-bold">{APP_NAME}</span>
        </div>

        <div className="relative max-w-md space-y-8">
          <div>
            <h1 className="font-display text-4xl font-bold leading-[1.15] tracking-tight">
              Your campus,
              <br />
              connected.
            </h1>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-primary-foreground/80">
              {APP_TAGLINE} — feeds, notes, projects, events and real-time chat
              in one place.
            </p>
          </div>

          <ul className="space-y-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <item.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-primary-foreground/75">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} {APP_NAME}. Built for students.
        </p>
      </section>

      {/* Auth panel */}
      <section className="flex items-center justify-center px-4 py-14">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-wash text-white shadow-soft">
              <GraduationCap className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {APP_NAME}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{APP_TAGLINE}</p>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-soft sm:p-8">
            <h2 className="text-center font-display text-xl font-semibold tracking-tight text-card-foreground">
              Welcome back
            </h2>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Sign in with your Google account to continue.
            </p>

            <Button
              variant="outline"
              size="lg"
              className="mt-6 w-full gap-3 text-base font-medium"
              onClick={handleSignIn}
              disabled={submitting || loading}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <GoogleIcon className="h-5 w-5" />
              )}
              {submitting ? "Signing in…" : "Continue with Google"}
            </Button>

            {/* Only needed where the brand panel (with the full highlights)
                isn't visible — otherwise it just repeats the left side. */}
            <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground lg:hidden">
              {HIGHLIGHTS.map((item) => (
                <div key={item.title} className="rounded-lg bg-muted/60 p-3">
                  <item.icon className="mx-auto mb-1 h-4 w-4 text-primary" />
                  {item.title}
                </div>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to {APP_NAME}&apos;s community guidelines.
          </p>
        </div>
      </section>
    </main>
  );
}
