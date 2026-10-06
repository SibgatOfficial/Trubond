"use client";

import * as React from "react";
import Link from "next/link";
import { Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyAnimation } from "@/components/ui/lottie-animation";

/**
 * Segment-level error boundary.
 *
 * Without this, a thrown error during render showed a blank white screen with
 * no way back. Must be a Client Component, which is why it lives here rather
 * than in the root layout.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Surface the real cause in the console instead of swallowing it.
    console.error("Unhandled app error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <EmptyAnimation className="h-40 w-40" />
      <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset} className="gap-2">
          <RotateCcw className="h-4 w-4" /> Try again
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/home">
            <Home className="h-4 w-4" /> Back to feed
          </Link>
        </Button>
      </div>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      ) : null}
    </main>
  );
}
