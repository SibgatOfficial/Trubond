"use client";

import * as React from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { follow, unfollow } from "@/lib/services/follows";
import { notifySafely } from "@/lib/services/notifications";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/types";
import { toast } from "sonner";

type Size = "sm" | "default";

/**
 * Follow / Unfollow toggle.
 *
 * Optimistic: the label flips immediately and rolls back if the write fails, so
 * the button never feels laggy on a slow connection.
 */
export function FollowButton({
  currentUser,
  targetUserId,
  targetName,
  initialFollowing,
  size = "sm",
  className,
}: {
  currentUser: UserProfile;
  targetUserId: string;
  targetName?: string;
  initialFollowing?: boolean;
  size?: Size;
  className?: string;
}) {
  const [following, setFollowing] = React.useState(initialFollowing ?? false);
  const [busy, setBusy] = React.useState(false);

  // A follow button is meaningless on your own content.
  if (currentUser.id === targetUserId) return null;

  const handleToggle = async () => {
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      if (next) {
        await follow(currentUser.id, targetUserId);
        notifySafely({
          recipientId: targetUserId,
          actor: currentUser,
          type: "follow",
          targetId: currentUser.id,
          href: "/profile",
        });
        toast.success(
          targetName ? `Now following ${targetName}` : "Now following"
        );
      } else {
        await unfollow(currentUser.id, targetUserId);
        toast.success(targetName ? `Unfollowed ${targetName}` : "Unfollowed");
      }
    } catch (error) {
      console.error(error);
      setFollowing(!next);
      toast.error(
        error instanceof Error ? error.message : "Couldn't update follow."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={following ? "outline" : "default"}
      size={size}
      onClick={handleToggle}
      disabled={busy}
      aria-pressed={following}
      aria-label={following ? `Unfollow ${targetName ?? "user"}` : `Follow ${targetName ?? "user"}`}
      className={cn("gap-1.5", className)}
    >
      {following ? (
        <UserMinus className="h-3.5 w-3.5" />
      ) : (
        <UserPlus className="h-3.5 w-3.5" />
      )}
      {following ? "Following" : "Follow"}
    </Button>
  );
}
