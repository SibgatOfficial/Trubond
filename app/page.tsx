"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Users, Zap } from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { Button } from "@/components/ui/button";
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
      toast.success("Signed in — welcome to Trubond!");
    } catch (error) {
      console.error(error);
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Trubond
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            College Networking Platform
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-xl shadow-slate-200/60">
          <h2 className="text-center text-xl font-semibold">
            Welcome back
          </h2>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Sign in with your Google account to continue.
          </p>

          <Button
            variant="outline"
            size="lg"
            className="mt-6 w-full gap-3 border-slate-200 text-base font-medium"
            onClick={handleSignIn}
            disabled={submitting || loading}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <GoogleIcon className="h-5 w-5" />
            )}
            Continue with Google
          </Button>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
            <div className="rounded-lg bg-muted/60 p-3">
              <Users className="mx-auto mb-1 h-4 w-4 text-primary" />
              Connect
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <Zap className="mx-auto mb-1 h-4 w-4 text-primary" />
              Collaborate
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <GraduationCap className="mx-auto mb-1 h-4 w-4 text-primary" />
              Grow
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to Trubond&apos;s community guidelines.
        </p>
      </div>
    </main>
  );
}
