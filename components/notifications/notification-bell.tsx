"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowBigUp,
  Bell,
  FolderKanban,
  Heart,
  MessageCircle,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  describeNotification,
  markNotificationsRead,
  subscribeToNotifications,
} from "@/lib/services/notifications";
import { DEFAULT_AVATAR, cn, initials, timeAgo } from "@/lib/utils";
import { UserLink } from "@/components/shared/user-link";
import type { AppNotification, NotificationType } from "@/types";

const ICONS: Record<NotificationType, LucideIcon> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  note_upvote: ArrowBigUp,
  project_approved: FolderKanban,
};

export function NotificationBell() {
  const { profile } = useAuth();
  const router = useRouter();
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!profile) return;
    return subscribeToNotifications(profile.id, setItems);
  }, [profile]);

  const unreadIds = React.useMemo(
    () => items.filter((item) => !item.read).map((item) => item.id),
    [items]
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && unreadIds.length > 0) {
      // Marking on open (rather than per item) matches how people expect a bell
      // to behave, and avoids a write for every notification merely glanced at.
      markNotificationsRead(unreadIds).catch(() => undefined);
    }
  };

  if (!profile) return null;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadIds.length > 0
              ? `Notifications, ${unreadIds.length} unread`
              : "Notifications"
          }
        >
          <Bell className="h-5 w-5" />
          {unreadIds.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadIds.length > 9 ? "9+" : unreadIds.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="px-3 py-2">
          Notifications
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />

        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            items.map((item) => {
              const Icon = ICONS[item.type] ?? Bell;
              return (
                <DropdownMenuItem
                  key={item.id}
                  // Router navigation rather than an <a> child: a Radix menu item
                  // unmounts its content on select, so asChild nesting is fragile.
                  onSelect={() => {
                    // "X started following you" is about the actor, so it opens
                    // their profile; the rest point at the content.
                    if (item.type === "follow") {
                      router.push(`/user?u=${encodeURIComponent(item.actorId)}`);
                    } else if (item.href) {
                      router.push(item.href);
                    }
                  }}
                  className={cn(
                    "cursor-pointer px-3 py-2.5",
                    !item.read && "bg-primary/5"
                  )}
                >
                  <div className="flex w-full items-start gap-2.5">
                    <UserLink userId={item.actorId} stopPropagation={false}>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage
                          src={item.actorPhoto || DEFAULT_AVATAR}
                          alt={item.actorName ?? item.actorUsername}
                        />
                        <AvatarFallback>
                          {initials(item.actorName ?? item.actorUsername)}
                        </AvatarFallback>
                      </Avatar>
                    </UserLink>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-normal text-sm leading-snug">
                        {describeNotification(item)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {timeAgo(item.createdAt)}
                      </p>
                    </div>
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        item.read ? "text-muted-foreground" : "text-primary"
                      )}
                      aria-hidden="true"
                    />
                  </div>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
