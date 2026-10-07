"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { PostCard } from "@/components/feed/post-card";
import { cn } from "@/lib/utils";
import type { Post, UserProfile } from "@/types";

/**
 * A post on a profile that opens the real post when clicked.
 *
 * A `div` with router navigation (not a wrapping `<Link>`): PostCard already
 * contains author `<a>` links, and nested anchors are invalid HTML that
 * browsers repair by breaking the layout. Inner interactive elements — like,
 * comment, edit/delete menu, author links — are detected via `closest()` and
 * left alone, so they keep working without navigating away.
 */
export function ProfilePostCard({
  post,
  currentUser,
  liked,
  onToggleLike,
  onOpenComments,
  onDeleted,
  onView,
  authorOnline = false,
}: {
  post: Post;
  currentUser: UserProfile;
  liked: boolean;
  onToggleLike: (post: Post) => void;
  onOpenComments: (postId: string) => void;
  onDeleted: (postId: string) => void;
  onView?: (post: Post) => void;
  authorOnline?: boolean;
}) {
  const router = useRouter();

  const openPost = React.useCallback(() => {
    router.push(`/post?id=${encodeURIComponent(post.id)}`);
  }, [router, post.id]);

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Open post by ${post.authorName || post.authorUsername}`}
      onClick={(event) => {
        // Inner interactive elements handle their own clicks; only navigate
        // when the "dead" area of the card is clicked.
        const target = event.target as HTMLElement;
        if (
          target.closest(
            "a,button,[role='button'],textarea,input,[data-radix-popper]"
          )
        ) {
          return;
        }
        openPost();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) {
          openPost();
        }
      }}
      className={cn(
        "group relative cursor-pointer rounded-xl",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "[&>div]:transition-colors hover:[&>div]:border-primary/40"
      )}
    >
      <PostCard
        post={post}
        currentUser={currentUser}
        liked={liked}
        onToggleLike={onToggleLike}
        onOpenComments={onOpenComments}
        onDeleted={onDeleted}
        onView={onView}
        authorOnline={authorOnline}
      />
      <span
        aria-hidden="true"
        className="absolute right-4 top-4 flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        Open <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}
