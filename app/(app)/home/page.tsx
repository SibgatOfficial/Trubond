"use client";

import * as React from "react";
import { Newspaper, Plus } from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { PostCard } from "@/components/feed/post-card";
import { PostComposer } from "@/components/feed/post-composer";
import { CommentsDialog } from "@/components/feed/comments-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getLikedPostIds,
  incrementViewCount,
  subscribeToFeed,
  toggleLike,
} from "@/lib/services/posts";
import type { Post } from "@/types";
import { toast } from "sonner";

export default function HomePage() {
  const { profile } = useAuth();
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [liked, setLiked] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [commentsPostId, setCommentsPostId] = React.useState<string | null>(null);
  const viewedRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    const unsubscribe = subscribeToFeed(
      (nextPosts) => {
        setPosts(nextPosts);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        toast.error("Failed to load the feed.");
      }
    );
    return () => unsubscribe();
  }, []);

  // Resolve which posts the current user has liked.
  React.useEffect(() => {
    if (!profile || posts.length === 0) return;
    let active = true;
    getLikedPostIds(
      posts.map((p) => p.id),
      profile.id
    )
      .then((set) => {
        if (active) setLiked(set);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [posts, profile]);

  // Count a view once per post, per session (mirrors the original behaviour).
  React.useEffect(() => {
    if (!profile) return;
    posts.forEach((post) => {
      if (!viewedRef.current.has(post.id)) {
        viewedRef.current.add(post.id);
        incrementViewCount(post.id, profile.id).catch(() => undefined);
      }
    });
  }, [posts, profile]);

  const handleToggleLike = async (post: Post) => {
    if (!profile) return;
    const isLiked = liked.has(post.id);
    // Optimistic update
    setLiked((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(post.id);
      else next.add(post.id);
      return next;
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, likeCount: Math.max(0, (p.likeCount ?? 0) + (isLiked ? -1 : 1)) }
          : p
      )
    );
    try {
      await toggleLike(post.id, profile.id, isLiked);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update like.");
    }
  };

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Home Feed</h1>
        <Button className="gap-2" onClick={() => setComposerOpen(true)}>
          <Plus className="h-4 w-4" /> Create Post
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="No posts yet"
          description="Be the first to share something with your campus!"
        />
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUser={profile}
            liked={liked.has(post.id)}
            onToggleLike={handleToggleLike}
            onOpenComments={setCommentsPostId}
            onDeleted={(id) =>
              setPosts((prev) => prev.filter((p) => p.id !== id))
            }
          />
        ))
      )}

      <PostComposer
        currentUser={profile}
        open={composerOpen}
        onOpenChange={setComposerOpen}
      />
      <CommentsDialog
        postId={commentsPostId}
        open={commentsPostId !== null}
        onOpenChange={(open) => {
          if (!open) setCommentsPostId(null);
        }}
        currentUser={profile}
      />
    </div>
  );
}
