"use client";

import { cn } from "@/lib/utils";

export type ProfileStatKey =
  | "posts"
  | "notes"
  | "projects"
  | "events"
  | "followers"
  | "following";

export interface ProfileStat {
  key: ProfileStatKey;
  label: string;
  value: number | null;
}

/**
 * The six profile counters as real buttons.
 *
 * Posts / Projects / Events switch the tab below (and scroll it into view);
 * Notes deep-links to the notes page; Followers / Following open the list
 * dialog. Rendered as `<button>` so keyboard + screen-reader users get the
 * same behaviour as pointer users.
 */
export function ProfileStatsGrid({
  stats,
  onSelect,
}: {
  stats: ProfileStat[];
  onSelect: (key: ProfileStatKey) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {stats.map((stat) => (
        <button
          key={stat.key}
          type="button"
          onClick={() => onSelect(stat.key)}
          aria-label={`${stat.label}: ${stat.value ?? "unknown"}. View ${stat.label.toLowerCase()}.`}
          className={cn(
            "rounded-lg bg-muted/60 p-3 text-center transition-colors",
            "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <p className="text-lg font-bold text-primary">
            {stat.value ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">{stat.label}</p>
        </button>
      ))}
    </div>
  );
}
