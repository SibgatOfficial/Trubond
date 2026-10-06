"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Explicit "load more" control.
 *
 * Deliberately a button rather than an infinite-scroll sentinel: the first page
 * of most lists is a live subscription, and auto-loading fights that (content
 * arriving above the fold while older pages append below). A button is also
 * keyboard- and screen-reader-accessible for free.
 */
export function LoadMore({
  hasMore,
  loading,
  onClick,
  label = "Load more",
}: {
  hasMore: boolean;
  loading: boolean;
  onClick: () => void;
  label?: string;
}) {
  if (!hasMore) return null;

  return (
    <div className="flex justify-center pt-2">
      <Button
        variant="outline"
        onClick={onClick}
        disabled={loading}
        className="gap-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? "Loading…" : label}
      </Button>
    </div>
  );
}
