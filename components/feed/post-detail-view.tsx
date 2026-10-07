"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Newspaper } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/auth-provider";
import { PostCard } from "@/components/feed/post-card";
import { CommentsDialog } from "@/components/feed/comments-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getLikedPostIds,
  incrementViewCount,
  subscribeToPost,
  toggleLike,
} from "@/lib/services/posts";
import { notifySafely } from "@/lib/services/notifications";
import { usePresenceMap } from "@/hooks/use-presence";
import type { Post } from "@/types";
import { toast } from "sonner";

/**
 * The single post behind a profile-post click (`/post?id=`).
 *
 * Must be rendered inside a `<Suspense>` boundary — in a static export
 * `useSearchParams()` forces a client-side bailout, and the build fails
 * without one.
 */
export function PostDetailView() {
  const searchParams = useSearchParams();
  const postId = searchParams.get("id") ?? "";
  const { profile } = useAuth();

  const [post, setPost] = React.useState<Post | null>(null);
  const [missing, setMissing] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [liked, setLiked] = React.useState(false);
  const [commentsOpen, setCommentsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!postId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMissing(false);
    return subscribeToPost(
      postId,
      (next) => {
        setPost(next);
        setMissing(next === null);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        toast.error("Failed to load that post.");
      }
    );
  }, [postId]);

  // Resolve this post's like-state once (same once-per-id pattern as the feeds).
  React.useEffect(() => {
    if (!profile || !post) return;
    const targetId = post.id;
    getLikedPostIds([targetId], profile.id)
      .then((set) => setLiked(set.has(targetId)))
      .catch(() => undefined);
  }, [profile, post]);

  const presence = usePresenceMap(post ? [post.authorId] : []);

  const handleToggleLike = async (target: Post) => {
    if (!profile) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setPost((prev) =>
      prev && prev.id === target.id
        ? { ...prev, likeCount: Math.max(0, (prev.likeCount ?? 0) + (wasLiked ? -1 : 1)) }
        : prev
    );
    try {
      const nowLiked = await toggleLike(target.id, profile.id);
      setLiked(nowLiked);
      if (nowLiked) {
        notifySafely({
          recipientId: target.authorId,
          actor: profile,
          type: "like",
          targetId: target.id,
          href: `/post?id=${encodeURIComponent(target.id)}`,
        });
      }
    } catch (error) {
      console.error(error);
      setLiked(wasLiked);
      setPost((prev) =>
        prev && prev.id === target.id
          ? { ...prev, likeCount: Math.max(0, (prev.likeCount ?? 0) + (wasLiked ? 1 : -1)) }
          : prev
      );
      toast.error("Failed to update like.");
    }
  };

  const handleView = React.useCallback(
    (target: Post) => {
      if (!profile) return;
      incrementViewCount(target.id, profile.id).catch(() => undefined);
    },
    [profile]
  );

  if (!postId) {
    return (
      <EmptyState
        animation="empty"
        icon={Newspaper}
        title="No post selected"
        description="Open a post from someone's profile or the home feed."
      />
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (missing || !post) {
    return (
      <EmptyState
        animation="empty"
        icon={Newspaper}
        title="This post isn't available"
        description="It may have been deleted."
      />
    );
  }

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Post"
        description={`@${post.authorUsername}`}
        action={
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link href="/home">
              <ArrowLeft className="h-4 w-4" /> Back to feed
            </Link>
          </Button>
        }
      />
      <PostCard
        post={post}
        currentUser={profile}
        liked={liked}
        onToggleLike={handleToggleLike}
        onOpenComments={() => setCommentsOpen(true)}
        onDeleted={() => setMissing(true)}
        onView={handleView}
        authorOnline={presence.get(post.authorId) ?? false}
      />
      <CommentsDialog
        postId={post.id}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        currentUser={profile}
        postAuthorId={post.authorId}
      />
    </div>
  );
}
