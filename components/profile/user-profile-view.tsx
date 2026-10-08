"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link2, MapPin, MessageSquare, Newspaper, School, BookOpen } from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PresenceDot } from "@/components/shared/presence-dot";
import { FollowButton } from "@/components/profile/follow-button";
import { SocialLinks } from "@/components/profile/social-links";
import { ProfilePostCard } from "@/components/profile/profile-post-card";
import { ProfileProjectsSection } from "@/components/profile/profile-projects-section";
import { type ProjectSubTab } from "@/components/profile/profile-projects-section";
import { ProfileEventsSection } from "@/components/profile/profile-events-section";
import { type EventSubTab } from "@/components/profile/profile-events-section";
import { ProfileStatsGrid } from "@/components/profile/profile-stats-grid";
import { type ProfileStatKey } from "@/components/profile/profile-stats-grid";
import { FollowListDialog } from "@/components/profile/follow-list-dialog";
import { CommentsDialog } from "@/components/feed/comments-dialog";
import { getUserByUsername, getUserProfile } from "@/lib/services/users";
import { isFollowing } from "@/lib/services/follows";
import {
  getLikedPostIds,
  incrementViewCount,
  subscribeToUserPosts,
  toggleLike,
} from "@/lib/services/posts";
import {
  getOwnedProjectsByUsername,
  subscribeToOwnedProjects,
  subscribeToUserProjects,
} from "@/lib/services/projects";
import { notifySafely } from "@/lib/services/notifications";
import { getCreatedEventsByUsername, getEventsByIds, getJoinedEventIds, subscribeToCreatedEvents } from "@/lib/services/events";
import { getUserActivityCounts } from "@/lib/services/stats";
import { usePresenceMap } from "@/hooks/use-presence";
import { DEFAULT_AVATAR, initials } from "@/lib/utils";
import type { EventItem, Post, Project, UserProfile } from "@/types";
import { toast } from "sonner";

type UserProfileTab = "posts" | "projects" | "events";

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
  const [memberProjects, setMemberProjects] = React.useState<Project[]>([]);
  const [ownedProjects, setOwnedProjects] = React.useState<Project[]>([]);
  const [joinedEvents, setJoinedEvents] = React.useState<EventItem[]>([]);
  const [createdEvents, setCreatedEvents] = React.useState<EventItem[]>([]);
  const [tab, setTab] = React.useState<UserProfileTab>("posts");
  const [projectSubTab, setProjectSubTab] = React.useState<ProjectSubTab>("joined");
  const [eventSubTab, setEventSubTab] = React.useState<EventSubTab>("joined");
  const [followMode, setFollowMode] = React.useState<"followers" | "following" | null>(null);
  const tabsRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [activity, setActivity] = React.useState<{
    notes: number | null;
    projects: number | null;
    ownedProjects: number | null;
    events: number | null;
    createdEvents: number | null;
  }>({ notes: null, projects: null, ownedProjects: null, events: null, createdEvents: null });

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
          ownedProjects: counts.ownedProjects,
          events: joinedIds.size,
          createdEvents: counts.createdEvents,
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

  // Projects: membership stream + owned stream (live uid) + legacy username
  // sweep for pre-migration docs. Reset on user change — listeners are per
  // user and stale lists would otherwise flash.
  React.useEffect(() => {
    if (!userId) return;
    setMemberProjects([]);
    setOwnedProjects([]);
    const unsubMember = subscribeToUserProjects(userId, setMemberProjects);
    const unsubOwned = subscribeToOwnedProjects(userId, (live) => {
      setOwnedProjects((prev) => {
        const legacy = prev.filter((p) => p.ownerId !== userId);
        const byId = new Map(legacy.map((p) => [p.id, p]));
        live.forEach((p) => byId.set(p.id, p));
        return Array.from(byId.values());
      });
    });
    let active = true;
    getUserProfile(userId)
      .then((byId) => byId ?? getUserByUsername(userId))
      .then((resolved) => {
        if (!active || !resolved?.username) return;
        return getOwnedProjectsByUsername(resolved.username);
      })
      .then((legacy) => {
        if (!active || !legacy || legacy.length === 0) return;
        setOwnedProjects((prev) => {
          const byId = new Map(prev.map((p) => [p.id, p]));
          legacy.forEach((p) => {
            if (!byId.has(p.id)) byId.set(p.id, p);
          });
          return Array.from(byId.values());
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
      unsubMember();
      unsubOwned();
    };
  }, [userId]);

  // Events: joined ids resolved to full docs (not the first events page) plus
  // the created stream and legacy username sweep.
  React.useEffect(() => {
    if (!userId) return;
    setJoinedEvents([]);
    setCreatedEvents([]);
    let active = true;
    const unsubCreated = subscribeToCreatedEvents(userId, (live) => {
      setCreatedEvents((prev) => {
        const legacy = prev.filter((e) => e.createdBy !== userId);
        const byId = new Map(legacy.map((e) => [e.id, e]));
        live.forEach((e) => byId.set(e.id, e));
        return Array.from(byId.values());
      });
    });
    (async () => {
      try {
        const [joinedIds, resolved] = await Promise.all([
          getJoinedEventIds(userId),
          getUserProfile(userId).then(
            (byId) => byId ?? getUserByUsername(userId)
          ),
        ]);
        if (!active) return;
        const [docs, legacy] = await Promise.all([
          joinedIds.size > 0 ? getEventsByIds(Array.from(joinedIds)) : [],
          resolved?.username
            ? getCreatedEventsByUsername(resolved.username)
            : [],
        ]);
        if (!active) return;
        setJoinedEvents(docs);
        if (legacy.length > 0) {
          setCreatedEvents((prev) => {
            const byId = new Map(prev.map((e) => [e.id, e]));
            legacy.forEach((e) => {
              if (!byId.has(e.id)) byId.set(e.id, e);
            });
            return Array.from(byId.values());
          });
        }
      } catch (error) {
        console.error(error);
      }
    })();
    return () => {
      active = false;
      unsubCreated();
    };
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
          href: `/post?id=${encodeURIComponent(post.id)}`,
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

  const scrollToTabs = React.useCallback(() => {
    window.setTimeout(() => {
      tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  const handleStatSelect = React.useCallback(
    (key: ProfileStatKey) => {
      if (key === "posts") {
        setTab("posts");
        scrollToTabs();
      } else if (key === "projects") {
        setTab("projects");
        setProjectSubTab("joined");
        scrollToTabs();
      } else if (key === "events") {
        setTab("events");
        setEventSubTab("joined");
        scrollToTabs();
      } else if (key === "notes") {
        router.push("/notes");
      } else {
        setFollowMode(key);
      }
    },
    [router, scrollToTabs]
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
            {user.university ? (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                {user.university}
              </p>
            ) : null}
            {user.degree || user.major ? (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                {[user.degree, user.major].filter(Boolean).join(" · ")}
              </p>
            ) : null}
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

            <ProfileStatsGrid
              stats={[
                { key: "posts", label: "Posts", value: user.postCount ?? 0 },
                { key: "notes", label: "Notes", value: activity.notes },
                { key: "projects", label: "Projects", value: activity.projects },
                { key: "events", label: "Events", value: activity.events },
                { key: "followers", label: "Followers", value: user.followerCount ?? 0 },
                { key: "following", label: "Following", value: user.followingCount ?? 0 },
              ]}
              onSelect={handleStatSelect}
            />
          </CardContent>
        </Card>

        <div ref={tabsRef} className="scroll-mt-20">
          <Tabs value={tab} onValueChange={(value) => setTab(value as UserProfileTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="space-y-3">
              {posts.length === 0 ? (
                <EmptyState
                  animation="empty"
                  icon={Newspaper}
                  title={isMe ? "You haven't posted yet" : `${user.name} hasn't posted yet`}
                />
              ) : (
                posts.map((post) => (
                  <ProfilePostCard
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
            </TabsContent>

            <TabsContent value="projects" className="space-y-3">
              <ProfileProjectsSection
                viewer={me ?? user}
                owner={user}
                memberProjects={memberProjects}
                ownedProjects={ownedProjects}
                subTab={projectSubTab}
                onSubTabChange={setProjectSubTab}
              />
            </TabsContent>

            <TabsContent value="events" className="space-y-3">
              <ProfileEventsSection
                viewer={me ?? user}
                owner={user}
                joinedEvents={joinedEvents}
                createdEvents={createdEvents}
                subTab={eventSubTab}
                onSubTabChange={setEventSubTab}
              />
            </TabsContent>
          </Tabs>
        </div>

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

        {followMode && (
          <FollowListDialog
            userId={user.id}
            mode={followMode}
            open={followMode !== null}
            onOpenChange={(open) => {
              if (!open) setFollowMode(null);
            }}
          />
        )}
      </div>
    );
  }
