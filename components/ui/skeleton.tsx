import { cn } from "@/lib/utils";

/**
 * Skeleton block.
 *
 * Use `variant="text"` for copy lines and `variant="circle"` for avatars.
 * Kept as a single low-contrast pulse so loading lists feel calm.
 */
function Skeleton({
  className,
  variant = "block",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "block" | "text" | "circle";
}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        variant === "text" && "h-3.5 rounded",
        variant === "circle" && "rounded-full",
        className
      )}
      {...props}
    />
  );
}

/** A short stack of text lines — the "copy is loading" placeholder. */
function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={i === lines - 1 ? "w-2/3" : "w-full"}
        />
      ))}
    </div>
  );
}

/**
 * Card-shaped placeholder: avatar + name row, copy lines, optional media block.
 * Mirrors PostCard / NoteCard / ProjectCard proportions so the layout does not
 * jump when real content arrives.
 */
function SkeletonCard({
  media = false,
  lines = 3,
  className,
}: {
  media?: boolean;
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-4 rounded-xl border border-border bg-card p-4 shadow-soft sm:p-5",
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" className="h-10 w-10 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-1/3" />
          <Skeleton variant="text" className="h-3 w-1/5" />
        </div>
      </div>
      <SkeletonText lines={lines} />
      {media ? <Skeleton className="aspect-[16/9] w-full rounded-lg" /> : null}
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonCard };
