import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The single page header used by every screen.
 *
 * Before this each page hand-rolled its own heading markup, so spacing and
 * type scale drifted between routes.
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-4 gap-y-3 animate-fade-in",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}
