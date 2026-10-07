"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/empty-state";
import { getFollowerIds, getFollowingIds } from "@/lib/services/follows";
import { getUsersByIds } from "@/lib/services/users";
import { DEFAULT_AVATAR, initials } from "@/lib/utils";
import type { UserProfile } from "@/types";

/**
 * Followers / Following list behind the clickable stat tiles.
 *
 * Ids come from the `follows` collection (one query each), then resolve to
 * profiles in 10-id chunks via `getUsersByIds`. Every row links to that
 * person's profile.
 */
export function FollowListDialog({
  userId,
  mode,
  open,
  onOpenChange,
}: {
  userId: string;
  mode: "followers" | "following";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [users, setUsers] = React.useState<UserProfile[] | null>(null);

  React.useEffect(() => {
    if (!open || !userId) return;
    let active = true;
    setUsers(null);
    (async () => {
      try {
        const ids =
          mode === "followers"
            ? await getFollowerIds(userId)
            : await getFollowingIds(userId);
        const profiles = await getUsersByIds(Array.from(ids));
        if (active) setUsers(profiles);
      } catch (error) {
        console.error(error);
        if (active) setUsers([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, userId, mode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "followers" ? "Followers" : "Following"}
          </DialogTitle>
        </DialogHeader>
        {users === null ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            animation="empty"
            icon={Users}
            title={mode === "followers" ? "No followers yet" : "Not following anyone yet"}
          />
        ) : (
          <ScrollArea className="max-h-[55vh] pr-4">
            <ul className="space-y-1">
              {users.map((person) => (
                <li key={person.id}>
                  <Link
                    href={
                      person.id === userId
                        ? "/profile"
                        : `/user?u=${encodeURIComponent(person.id)}`
                    }
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage
                        src={person.profilePhotoUrl || DEFAULT_AVATAR}
                        alt={person.name}
                      />
                      <AvatarFallback>
                        {initials(person.name || person.username)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {person.name || person.username}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        @{person.username}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
