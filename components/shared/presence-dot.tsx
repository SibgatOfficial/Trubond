"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DEFAULT_AVATAR, cn, initials } from "@/lib/utils";

/**
 * A small "online" indicator.
 *
 * Renders nothing when the user is offline, so an offline feed is not littered
 * with grey dots — the absence of the dot is the signal.
 */
export function PresenceDot({
  online,
  className,
}: {
  online: boolean;
  className?: string;
}) {
  if (!online) return null;
  return (
    <span
      role="img"
      aria-label="Online"
      title="Online"
      className={cn(
        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500",
        className
      )}
    />
  );
}

/**
 * An avatar with its presence dot.
 *
 * The dot is a *sibling* of `Avatar`, not a child: `Avatar` is
 * `overflow-hidden`, which would clip a dot positioned on its edge.
 */
export function PresenceAvatar({
  src,
  name,
  online,
  avatarClassName,
  fallbackClassName,
}: {
  src?: string | null;
  name?: string | null;
  online: boolean;
  avatarClassName?: string;
  fallbackClassName?: string;
}) {
  return (
    <div className="relative shrink-0">
      <Avatar className={avatarClassName}>
        <AvatarImage src={src || DEFAULT_AVATAR} alt={name ?? "User"} />
        <AvatarFallback className={fallbackClassName}>
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <PresenceDot online={online} />
    </div>
  );
}
