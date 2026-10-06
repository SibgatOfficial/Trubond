"use client";

import * as React from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * An `<img>` that fails gracefully.
 *
 * Old posts point at Firebase Storage URLs that no longer resolve. A bare
 * `<img>` renders the browser's broken-image icon plus the alt text, which looks
 * like a bug. This swaps in a muted placeholder instead.
 *
 * `alt` is still required — it is what screen readers announce and what shows if
 * JavaScript is disabled.
 */
export function SafeImage({
  src,
  alt,
  className,
  wrapperClassName,
  fallbackLabel = "Image unavailable",
}: {
  src: string;
  alt: string;
  className?: string;
  /** Applied to the placeholder too, so the layout does not shift. */
  wrapperClassName?: string;
  fallbackLabel?: string;
}) {
  const [failed, setFailed] = React.useState(false);

  // A new src deserves a fresh attempt.
  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${alt} — ${fallbackLabel}`}
        className={cn(
          "flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground",
          wrapperClassName
        )}
      >
        <ImageOff className="h-6 w-6" aria-hidden="true" />
        <span className="px-4 text-center text-xs">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
