import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyAnimation, type LottieAnimationName } from "@/components/ui/lottie-animation";

/**
 * Empty/placeholder panel used across the app.
 *
 * Pass a Lucide `icon` for the compact look, or `animation` to show one of the
 * bundled Lottie animations instead (used on the main feed-style screens).
 */
export function EmptyState({
  icon: Icon,
  animation,
  title,
  description,
  className,
}: {
  icon?: LucideIcon;
  animation?: LottieAnimationName;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center",
        className
      )}
    >
      {animation ? (
        <div className="-my-4 mb-1">
          <EmptyAnimation className="h-36 w-36" />
        </div>
      ) : Icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}

      <p className="font-semibold">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
