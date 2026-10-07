"use client";

import * as React from "react";
import { Loader2, Users } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PresenceAvatar } from "@/components/shared/presence-dot";
import { UserLink } from "@/components/shared/user-link";
import { usePresenceMap } from "@/hooks/use-presence";
import { getRoomMembers } from "@/lib/services/chat";
import type { ChatRoom, UserProfile } from "@/types";

/**
 * Who's in this room, opened from the chat header.
 *
 * Presence is scoped to the members actually rendered (the Firestore `in`
 * query tops out at 30 ids), and the member list itself comes from
 * `getRoomMembers`, which bounds every branch — project roster from the
 * `members` array, branch/global capped at 50 profiles.
 */
export function RoomMembersSheet({
  room,
  currentUser,
  open,
  onOpenChange,
}: {
  room: ChatRoom | null;
  currentUser: UserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [members, setMembers] = React.useState<UserProfile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const memberIds = React.useMemo(
    () => members.map((member) => member.id),
    [members]
  );
  const presence = usePresenceMap(memberIds);

  React.useEffect(() => {
    if (!open || !room) return;
    let active = true;
    setLoading(true);
    setFailed(false);
    setMembers([]);
    getRoomMembers(room, currentUser)
      .then((list) => {
        if (!active) return;
        setMembers(
          [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        );
      })
      .catch((error) => {
        console.error(error);
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, room, currentUser]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-72 p-0 sm:max-w-sm">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Members {members.length > 0 ? `(${members.length})` : ""}
          </SheetTitle>
        </SheetHeader>

        <div className="h-[calc(100%-3.5rem)] overflow-y-auto scrollbar-thin p-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading members…
            </div>
          ) : failed || members.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {failed
                ? "Couldn't load members. Please try again."
                : "No members to show."}
            </p>
          ) : (
            members.map((member) => (
              <UserLink
                key={member.id}
                userId={member.id}
                stopPropagation={false}
                className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
              >
                <PresenceAvatar
                  src={member.profilePhotoUrl}
                  name={member.name || member.username}
                  online={presence.get(member.id) ?? false}
                  avatarClassName="h-9 w-9"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {member.name || member.username}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{member.username}
                  </span>
                </span>
              </UserLink>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}