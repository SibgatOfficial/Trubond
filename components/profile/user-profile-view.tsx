"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Link2, MessageSquare, Newspaper, School } from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PresenceDot } from "@/components/shared/presence-dot";
import { FollowButton } from "@/components/profile/follow-button";
import { SocialLinks } from "@/components/profile/social-links";
import { PostCard } from "@/components/feed/post-card";
import { CommentsDialog } from "@/components/feed/comments-dialog";
import { getUserByUsername, getUserProfile } from "@/lib/services/users";
import { isFollowing } from "@/lib/services/follows";
import {
  getLikedPostIds,
  incrementViewCount,
  subscribeToUserPosts,
  toggleLike,
} from "@/lib/services/posts";
import { notifySafely } from "@/lib/services/notifications";
import { getJoinedEventIds } from "@/lib/services/events";
import { getUserActivityCounts } from "@/lib/services/stats";
import { usePresenceMap } from "@/hooks/use-presence";
import { DEFAULT_AVATAR, initials } from "@/lib/utils";
import type { Post, UserProfile } from "@/types";
import { toast } from "sonner";

/**
 * Another user's profile.
 *
 * Reads `?u=<uid>`. Must be rendered inside a `<Suspense>` boundary — in a
 * static export `useSearchParams()` forces a client-side bailout, and the build
 * fails without one.
 */
export function UserProfileView() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("u") ?? "";
  const { profile: me } = useAuth();

  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [loadingUser, setLoadingUser] = React.useState(true);
  const [following, setFollowing] = React.useState<boolean | null>(null);
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [liked, setLiked] = React.useState<Set<string>>(new Set());
  /** Post ids whose like-state has already been fetched from the server. */
  const likedResolvedRef = React.useRef<Set<string>>(new Set());
  /** Post ids the user toggled locally — never overwritten by a fetch. */
  const likedTouchedRef = React.useRef<Set<string>>(new Set());
  const [commentsPostId, setCommentsPostId] = React.useState<string | null>(null);
  const [activity, setActivity] = React.useState<{
    notes: number | null;
    projects: number | null;
    events: number | null;
  }>({ notes: null, projects: null, events: null });

  React.useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const [counts, joinedIds] = await Promise.all([
        getUserActivityCounts(userId),
        getJoinedEventIds(userId).catch(() => new Set<string>()),
      ]);
      if (active) {
        setActivity({
          notes: counts.notes,
          projects: counts.projects,
          events: joinedIds.size,
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  React.useEffect(() => {
    if (!userId) {
      setLoadingUser(false);
      return;
    }
    let active = true;
    setLoadingUser(true);
    (async () => {
      try {
        // `u` is either a uid (internal links) or a username (shared links).
        let result = await getUserProfile(userId);
        if (!result) result = await getUserByUsername(userId);
        if (active) setUser(result);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load that profile.");
      } finally {
        if (active) setLoadingUser(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  React.useEffect(() => {
    if (!me || !userId) return;
    let active = true;
    isFollowing(me.id, userId)
      .then((result) => {
        if (active) setFollowing(result);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [me, userId]);

  React.useEffect(() => {
    if (!userId) return;
    return subscribeToUserPosts(userId, setPosts);
  }, [userId]);

  /**
   * Resolve liked posts ONCE per id — merged, never replaced (see the home
   * feed for the full rationale; the old replace-every-posts-change behaviour
   * raced the optimistic like and desynced the heart from the count).
   */
  React.useEffect(() => {
    if (!me || posts.length === 0) return;
    const missing = posts
      .map((post) => post.id)
      .filter((id) => !likedResolvedRef.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => likedResolvedRef.current.add(id));

    getLikedPostIds(missing, me.id)
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
        missing.forEach((id) => likedResolvedRef.current.delete(id));
      });
  }, [posts, me]);

  const presence = usePresenceMap(userId ? [userId] : []);

  const handleToggleLike = async (post: Post) => {
    if (!me) return;
    likedTouchedRef.current.add(post.id);
    const isLiked = liked.has(post.id);
    setLiked((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(post.id);
      else next.add(post.id);
      return next;
    });
    setPosts((prev) =>
      prev.map((item) =>
        item.id === post.id
          ? {
              ...item,
              likeCount: Math.max(0, (item.likeCount ?? 0) + (isLiked ? -1 : 1)),
            }
          : item
      )
    );
    try {
      const nowLiked = await toggleLike(post.id, me.id);
      if (nowLiked) {
        notifySafely({
          recipientId: post.authorId,
          actor: me,
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
        prev.map((item) =>
          item.id === post.id
            ? {
                ...item,
                likeCount: Math.max(0, (item.likeCount ?? 0) + (isLiked ? 1 : -1)),
              }
            : item
        )
      );
      toast.error("Failed to update like.");
    }
  };

  const handleView = React.useCallback(
    (post: Post) => {
      if (!me) return;
      incrementViewCount(post.id, me.id).catch(() => undefined);
    },
    [me]
  );

  if (!userId) {
    return (
      <EmptyState
        animation="empty"
        title="No profile selected"
        description="Open someone's profile from a post, a comment or the chat."
      />
    );
  }

  if (loadingUser) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <EmptyState
        animation="empty"
        title="This profile isn't available"
        description="The account may have been removed, or the link is wrong."
      />
    );
  }

  const isMe = me?.id === user.id;
  const online = presence.get(user.id) ?? false;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title={isMe ? "Your profile" : user.name || user.username}
        description={`@${user.username}`}
      />

      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary to-primary/60" />
        <CardContent className="relative pt-0">
          <div className="-mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-card shadow-md">
                  <AvatarImage
                    src={user.profilePhotoUrl || DEFAULT_AVATAR}
                    alt={user.name}
                  />
                  <AvatarFallback className="text-xl">
                    {initials(user.name || user.username)}
                  </AvatarFallback>
                </Avatar>
                <PresenceDot
                  online={online}
                  className="h-4 w-4 border-4 border-card"
                />
              </div>
              <div className="pb-1">
                <h2 className="font-display text-xl font-bold">
                  {user.name || user.username}
                </h2>
                <p className="text-sm text-muted-foreground">
                  @{user.username}
                </p>
              </div>
            </div>

            {user.username ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={async () => {
                  // Username, not uid: a shared link keeps working even if the
                  // account's uid ever changes again.
                  const url = `${window.location.origin}/user?u=${encodeURIComponent(
                    user.username
                  )}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success("Profile link copied");
                  } catch {
                    toast.error(url);
                  }
                }}
              >
                <Link2 className="h-3.5 w-3.5" /> Copy link
              </Button>
            ) : null}

            {me && !isMe ? (
              <div className="flex gap-2">
                <FollowButton
                  currentUser={me}
                  targetUserId={user.id}
                  targetName={user.name}
                  initialFollowing={following ?? false}
                  size="default"
                />
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={async () => {
                    try {
                      const { sendDmMessage } = await import(
                        "@/lib/services/chat"
                      );
                      const { notifySafely } = await import(
                        "@/lib/services/notifications"
                      );
                      await sendDmMessage(
                        { id: user.id, username: user.username },
                        me,
                        `Hi @${user.username}!`
                      );
                      notifySafely({
                        recipientId: user.id,
                        actor: me,
                        type: "dm_request",
                        href: "/chat",
                        text: "sent you a message request",
                      });
                      toast.success("Message request sent — find it in Chat.");
                    } catch (error) {
                      console.error(error);
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Failed to send message request."
                      );
                    }
                  }}
                >
                  <MessageSquare className="h-4 w-4" /> Message
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-4 space-y-2 text-sm">
            {user.about ? <p>{user.about}</p> : null}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
              {user.branch ? (
                <span className="flex items-center gap-1.5">
                  <School className="h-4 w-4" /> {user.branch}
                </span>
              ) : null}
              {user.startYear ? (
                <Badge variant="outline" className="font-normal">
                  Batch {user.startYear}
                  {user.passingYear ? `–${user.passingYear}` : ""}
                </Badge>
              ) : null}
            </div>
            <SocialLinks links={user.socialLinks} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              { label: "Posts", value: user.postCount ?? 0 },
              { label: "Notes", value: activity.notes },
              { label: "Projects", value: activity.projects },
              { label: "Events", value: activity.events },
              { label: "Followers", value: user.followerCount ?? 0 },
              { label: "Following", value: user.followingCount ?? 0 },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg bg-muted/60 p-3 text-center"
              >
                <p className="text-lg font-bold text-primary">
                  {stat.value ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {posts.length === 0 ? (
        <EmptyState
          animation="empty"
          icon={Newspaper}
          title={isMe ? "You haven't posted yet" : `${user.name} hasn't posted yet`}
        />
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUser={me ?? user}
            liked={liked.has(post.id)}
            onToggleLike={handleToggleLike}
            onOpenComments={setCommentsPostId}
            onDeleted={(id) =>
              setPosts((prev) => prev.filter((item) => item.id !== id))
            }
            onView={handleView}
            authorOnline={online}
          />
        ))
      )}

      {me ? (
        <CommentsDialog
          postId={commentsPostId}
          open={commentsPostId !== null}
          onOpenChange={(open) => {
            if (!open) setCommentsPostId(null);
          }}
          currentUser={me}
          postAuthorId={
            posts.find((post) => post.id === commentsPostId)?.authorId ?? null
          }
        />
      ) : null}
    </div>
  );
}
