"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn, isOwnedBy, timeAgo } from "@/lib/utils";
import type { EventItem, UserProfile } from "@/types";

export type EventSubTab = "joined" | "created";

/**
 * Events split into Joined vs Created, shared by /profile and /user.
 *
 * `joinedEvents` are the full docs resolved from the attendee ids (NOT the
 * first events page — that dropped joined events outside the page).
 * `createdEvents` merges the live `createdBy` listener with the one-shot
 * legacy username sweep — deduped by id, and excluded from "Joined" so an
 * organiser who also registered isn't double-listed.
 */
export function ProfileEventsSection({
  viewer,
  owner,
  joinedEvents,
  createdEvents,
  subTab,
  onSubTabChange,
}: {
  viewer: UserProfile;
  owner: UserProfile;
  joinedEvents: EventItem[];
  createdEvents: EventItem[];
  subTab: EventSubTab;
  onSubTabChange: (tab: EventSubTab) => void;
}) {
  const created = React.useMemo(() => {
    const byId = new Map<string, EventItem>();
    for (const event of [...createdEvents, ...joinedEvents]) {
      if (isOwnedBy(event.createdBy, event.createdByUsername, owner)) {
        byId.set(event.id, event);
      }
    }
    return Array.from(byId.values());
  }, [createdEvents, joinedEvents, owner]);

  const createdIds = React.useMemo(
    () => new Set(created.map((event) => event.id)),
    [created]
  );

  const joined = React.useMemo(
    () => joinedEvents.filter((event) => !createdIds.has(event.id)),
    [joinedEvents, createdIds]
  );

  const list = subTab === "created" ? created : joined;

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Events filter"
        className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1"
      >
        {(
          [
            { value: "joined", label: `Joined (${joined.length})` },
            { value: "created", label: `Created (${created.length})` },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={subTab === option.value}
            onClick={() => onSubTabChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              subTab === option.value
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={
            subTab === "created"
              ? viewer.id === owner.id
                ? "You haven't organised any events"
                : `@${owner.username} hasn't organised any events`
              : viewer.id === owner.id
                ? "You haven't joined any events"
                : `@${owner.username} hasn't joined any events`
          }
          description={
            subTab === "created"
              ? "Create one from the Events page."
              : undefined
          }
        />
      ) : (
        list.map((event) => (
          <Link
            key={event.id}
            href="/events"
            aria-label={`View ${event.title} in Events`}
            className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="transition-colors hover:border-primary/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="min-w-0 flex-1 truncate">{event.title}</span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">
                {event.location} · {timeAgo(event.date)}
              </CardContent>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}
