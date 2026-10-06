"use client";

import * as React from "react";
import { Sparkles, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PresenceAvatar } from "@/components/shared/presence-dot";
import { UserLink } from "@/components/shared/user-link";
import { FollowButton } from "@/components/profile/follow-button";
import { getFollowingIds, suggestPeople } from "@/lib/services/follows";
import { usePresenceMap } from "@/hooks/use-presence";
import type { UserProfile } from "@/types";
import { toast } from "sonner";

const DISMISS_KEY = "trubond:suggestions-dismissed-until";
/** Dismissal is a snooze, not a permanent opt-out. */
const DISMISS_DAYS = 7;

type Visibility = "checking" | "visible" | "hidden";

/**
 * Suggestions rail.
 *
 * Same-branch, same-year students first, already-followed people excluded, and
 * ranked using mutual follows and shared projects (see `suggestPeople`).
 *
 * Dismissible: closing it stores a timestamp for a week, so it comes back rather
 * than disappearing forever. Dismissal is read in an effect, never during render,
 * because `localStorage` does not exist on the server and reading it during the
 * first render would be a hydration mismatch.
 */
export function PeopleYouMayKnow({ currentUser }: { currentUser: UserProfile }) {
  const [people, setPeople] = React.useState<UserProfile[]>([]);
  const [followingIds, setFollowingIds] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [visibility, setVisibility] = React.useState<Visibility>("checking");

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DISMISS_KEY);
      const until = raw ? Number(raw) : 0;
      setVisibility(
        Number.isFinite(until) && Date.now() < until ? "hidden" : "visible"
      );
    } catch {
      setVisibility("visible");
    }
  }, []);

  React.useEffect(() => {
    if (visibility !== "visible") return;
    let active = true;
    (async () => {
      try {
        const following = await getFollowingIds(currentUser.id);
        const suggestions = await suggestPeople(currentUser, following, 4);
        if (!active) return;
        setFollowingIds(following);
        setPeople(suggestions);
      } catch (error) {
        console.error("Failed to load suggestions:", error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentUser, visibility]);

  const presence = usePresenceMap(people.map((person) => person.id));

  const handleDismiss = () => {
    setVisibility("hidden");
    try {
      window.localStorage.setItem(
        DISMISS_KEY,
        String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000)
      );
    } catch {
      /* storage blocked — it just won't persist */
    }
    toast.success("Suggestions hidden for a week");
  };

  // Nothing at all while we check storage, so a dismissed card never flashes.
  if (visibility !== "visible") return null;

  const header = (
    <CardHeader className="flex-row items-center gap-2 space-y-0">
      <Sparkles className="h-4 w-4 text-primary" />
      <CardTitle className="text-base">People you may know</CardTitle>
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto h-7 w-7 text-muted-foreground"
        onClick={handleDismiss}
        aria-label="Hide suggestions"
        title="Hide for a week"
      >
        <X className="h-4 w-4" />
      </Button>
    </CardHeader>
  );

  if (loading) {
    return (
      <Card>
        {header}
        <CardContent className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (people.length === 0) return null;

  return (
    <Card>
      {header}
      <CardContent className="space-y-3">
        {people.map((person) => (
          <div key={person.id} className="flex items-center gap-3">
            <UserLink userId={person.id} stopPropagation={false}>
              <PresenceAvatar
                src={person.profilePhotoUrl}
                name={person.name}
                online={presence.get(person.id) ?? false}
                avatarClassName="h-9 w-9"
              />
            </UserLink>
            <div className="min-w-0 flex-1">
              <UserLink
                userId={person.id}
                className="block truncate text-sm font-medium text-foreground"
              >
                {person.name}
              </UserLink>
              <p className="truncate text-xs text-muted-foreground">
                @{person.username}
                {person.branch ? ` · ${person.branch}` : ""}
              </p>
            </div>
            <FollowButton
              currentUser={currentUser}
              targetUserId={person.id}
              targetName={person.name}
              initialFollowing={followingIds.has(person.id)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
