"use client";

import * as React from "react";
import { Newspaper, Plus, Users } from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { PostCard } from "@/components/feed/post-card";
import { PostComposer } from "@/components/feed/post-composer";
import { CommentsDialog } from "@/components/feed/comments-dialog";
import { PeopleYouMayKnow } from "@/components/feed/people-you-may-know";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadMore } from "@/components/shared/load-more";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchOlderPosts,
  getLikedPostIds,
  incrementViewCount,
  subscribeToFeed,
  toggleLike,
} from "@/lib/services/posts";
import { getFollowingIds } from "@/lib/services/follows";
import { notifySafely } from "@/lib/services/notifications";
import { usePresenceMap } from "@/hooks/use-presence";
import { usePagedList } from "@/hooks/use-paged-list";
import { FEED_TABS, selectFeed, type FeedTab } from "@/lib/services/feed";
import type { Post } from "@/types";
import { toast } from "sonner";

export default function HomePage() {
  const { profile } = useAuth();
  const {
    items: posts,
    setItems: setPosts,
    hasMore,
    loadingMore,
    applyFirstPage,
    loadMore,
  } = usePagedList<Post>(fetchOlderPosts, () =>
    toast.error("Failed to load more posts.")
  );
  const [liked, setLiked] = React.useState<Set<string>>(new Set());
  /** Post ids whose like-state has already been fetched from the server. */
  const likedResolvedRef = React.useRef<Set<string>>(new Set());
  /** Post ids the user toggled locally — never overwritten by a fetch. */
  const likedTouchedRef = React.useRef<Set<string>>(new Set());
  const [followingIds, setFollowingIds] = React.useState<Set<string>>(new Set());
  const [followingLoaded, setFollowingLoaded] = React.useState(false);
  const [tab, setTab] = React.useState<FeedTab>("for-you");
  const [loading, setLoading] = React.useState(true);
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [commentsPostId, setCommentsPostId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const unsubscribe = subscribeToFeed(
      (page) => {
        applyFirstPage(page);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        toast.error("Failed to load the feed.");
      }
    );
    return () => unsubscribe();
  }, [applyFirstPage]);

  React.useEffect(() => {
    if (!profile) return;
    let active = true;
    getFollowingIds(profile.id)
      .then((set) => {
        if (active) {
          setFollowingIds(set);
          setFollowingLoaded(true);
        }
      })
      .catch(() => {
        if (active) setFollowingLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [profile]);

  /**
   * Resolve which posts the current user has liked — ONCE per post id.
   *
   * This used to re-run on every `posts` change (which each optimistic like
   * causes) and replace the whole set with a pre-commit server response,
   * clobbering the optimistic toggle and desyncing the heart from the count —
   * the "like goes to 0 / comes back" bug. Ids are now resolved exactly once,
   * results are merged (never replaced), and ids the user toggled while the
   * fetch was in flight are left to local state (which the transaction then
   * agrees with).
   */
  React.useEffect(() => {
    if (!profile || posts.length === 0) return;
    const missing = posts
      .map((p) => p.id)
      .filter((id) => !likedResolvedRef.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => likedResolvedRef.current.add(id));

    getLikedPostIds(missing, profile.id)
      .then((serverSet) => {
        setLiked((prev) => {
          const next = new Set(prev);
          for (const id of missing) {
            if (likedTouchedRef.current.has(id)) continue;
            if (serverSet.has(id)) next.add(id);
            else next.delete(id);
          }
          return next;
        });
      })
      .catch(() => {
        // Un-resolve so a later snapshot retries these ids.
        missing.forEach((id) => likedResolvedRef.current.delete(id));
      });
  }, [posts, profile]);

  /**
   * Ranked order, snapshotted.
   *
   * Deliberately keyed on `posts.length` rather than `posts`: without this a
   * like would change a post's engagement score and reshuffle the list under
   * the reader's cursor. New posts change the length, so they still re-rank.
   */
  const orderedIds = React.useMemo(() => {
    if (!profile) return [] as string[];
    if (tab === "following" && !followingLoaded) return [] as string[];
    return selectFeed(posts, tab, {
      viewer: profile,
      followingIds,
    }).map((p) => p.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length, tab, followingIds, followingLoaded, profile]);

  /** Applies the frozen order to the *fresh* post objects, so counts stay live. */
  const visiblePosts = React.useMemo(() => {
    const byId = new Map(posts.map((p) => [p.id, p]));
    const ordered: Post[] = [];
    for (const id of orderedIds) {
      const found = byId.get(id);
      if (found) ordered.push(found);
    }
    const known = new Set(orderedIds);
    const fresh = posts.filter((p) => !known.has(p.id));
    return [...fresh, ...ordered];
  }, [posts, orderedIds]);

  /** Online flags for the authors currently on screen (one batched query). */
  const authorIds = React.useMemo(
    () => visiblePosts.map((post) => post.authorId),
    [visiblePosts]
  );
  const presence = usePresenceMap(authorIds);

  // Fired by PostCard's IntersectionObserver once a post is genuinely on
  // screen. `incrementViewCount` additionally throttles to one write per post
  // per day — previously every post was written on every feed load.
  const handleView = React.useCallback(
    (post: Post) => {
      if (!profile) return;
      incrementViewCount(post.id, profile.id).catch(() => undefined);
    },
    [profile]
  );

  const handleToggleLike = async (post: Post) => {
    if (!profile) return;
    likedTouchedRef.current.add(post.id);
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
      const nowLiked = await toggleLike(post.id, profile.id);
      // Only on like — un-liking should not ping the author.
      if (nowLiked) {
        notifySafely({
          recipientId: post.authorId,
          actor: profile,
          type: "like",
          targetId: post.id,
          href: "/home",
        });
      }
    } catch (error) {
      console.error(error);
      setLiked((prev) => {
        const next = new Set(prev);
        if (isLiked) next.add(post.id);
        else next.delete(post.id);
        return next;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, likeCount: Math.max(0, (p.likeCount ?? 0) + (isLiked ? 1 : -1)) }
            : p
        )
      );
      toast.error("Failed to update like.");
    }
  };

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Home Feed"
        description="See what your campus is talking about."
        action={
          <Button className="gap-2" onClick={() => setComposerOpen(true)}>
            <Plus className="h-4 w-4" /> Create Post
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as FeedTab)}>
        <TabsList className="w-full">
          {FEED_TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="flex-1">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <PeopleYouMayKnow currentUser={profile} />

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} media={i === 1} />
          ))}
        </div>
      ) : tab === "following" && !followingLoaded ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <SkeletonCard key={i} media={i === 1} />
          ))}
        </div>
      ) : visiblePosts.length === 0 ? (
        tab === "following" ? (
          <EmptyState
            animation="empty"
            icon={Users}
            title="Your following feed is empty"
            description="Follow a few people above and their posts will show up here."
          />
        ) : (
          <EmptyState
            animation="empty"
            icon={Newspaper}
            title="No posts yet"
            description="Be the first to share something with your campus!"
          />
        )
      ) : (
        visiblePosts.map((post) => (
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
            onView={handleView}
            authorOnline={presence.get(post.authorId) ?? false}
          />
        ))
      )}

      <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />

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
        postAuthorId={
          posts.find((post) => post.id === commentsPostId)?.authorId ?? null
        }
      />
    </div>
  );
}
