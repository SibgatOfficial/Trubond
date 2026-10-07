"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Link2,
  Mail,
  Newspaper,
  Pencil,
  School,
} from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
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
import {
  getCreatedEventsByUsername,
  getEventsByIds,
  getJoinedEventIds,
  subscribeToCreatedEvents,
} from "@/lib/services/events";
import { getUserActivityCounts } from "@/lib/services/stats";
import { notifySafely } from "@/lib/services/notifications";
import { usePresenceMap } from "@/hooks/use-presence";
import { DEFAULT_AVATAR, initials } from "@/lib/utils";
import type { EventItem, Post, Project } from "@/types";
import { toast } from "sonner";

type ProfileTab = "posts" | "projects" | "events";

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
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
  const [editOpen, setEditOpen] = React.useState(false);
  const [tab, setTab] = React.useState<ProfileTab>("posts");
  const [projectSubTab, setProjectSubTab] = React.useState<ProjectSubTab>("joined");
  const [eventSubTab, setEventSubTab] = React.useState<EventSubTab>("joined");
  const [followMode, setFollowMode] = React.useState<"followers" | "following" | null>(null);
  const tabsRef = React.useRef<HTMLDivElement>(null);
  const [activity, setActivity] = React.useState<{
    notes: number | null;
    projects: number | null;
    ownedProjects: number | null;
    events: number | null;
    createdEvents: number | null;
  }>({ notes: null, projects: null, ownedProjects: null, events: null, createdEvents: null });

  const presence = usePresenceMap(profile ? [profile.id] : []);

  // Aggregation counts — one read per 1,000 documents, so this stays cheap and
  // is not limited by how much of each list has been paginated in.
  React.useEffect(() => {
    if (!profile) return;
    let active = true;
    (async () => {
      const [counts, joinedIds] = await Promise.all([
        getUserActivityCounts(profile.id),
        getJoinedEventIds(profile.id).catch(() => new Set<string>()),
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
  }, [profile]);

  // Pull fresh follower/following counters when the page opens — they are
  // maintained by the follow service and change from other screens.
  React.useEffect(() => {
    refreshProfile().catch(() => undefined);
    // Intentionally mount-only: `refreshProfile` updates context state, so
    // depending on it here would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!profile) return;
    const unsubPosts = subscribeToUserPosts(profile.id, setPosts);
    const unsubMember = subscribeToUserProjects(profile.id, setMemberProjects);
    const unsubOwned = subscribeToOwnedProjects(profile.id, (live) => {
      // Merge the legacy-username sweep in: same id space, so dedupe by id.
      setOwnedProjects((prev) => {
        const legacy = prev.filter((p) => p.ownerId !== profile.id);
        const byId = new Map(legacy.map((p) => [p.id, p]));
        live.forEach((p) => byId.set(p.id, p));
        return Array.from(byId.values());
      });
    });
    const unsubCreatedEvents = subscribeToCreatedEvents(profile.id, (live) => {
      setCreatedEvents((prev) => {
        const legacy = prev.filter((e) => e.createdBy !== profile.id);
        const byId = new Map(legacy.map((e) => [e.id, e]));
        live.forEach((e) => byId.set(e.id, e));
        return Array.from(byId.values());
      });
    });
    // One-shot legacy sweep for pre-migration docs (old uid, same username).
    getOwnedProjectsByUsername(profile.username)
      .then((legacy) => {
        if (legacy.length === 0) return;
        setOwnedProjects((prev) => {
          const byId = new Map(prev.map((p) => [p.id, p]));
          legacy.forEach((p) => {
            if (!byId.has(p.id)) byId.set(p.id, p);
          });
          return Array.from(byId.values());
        });
      })
      .catch(() => undefined);
    getCreatedEventsByUsername(profile.username)
      .then((legacy) => {
        if (legacy.length === 0) return;
        setCreatedEvents((prev) => {
          const byId = new Map(prev.map((e) => [e.id, e]));
          legacy.forEach((e) => {
            if (!byId.has(e.id)) byId.set(e.id, e);
          });
          return Array.from(byId.values());
        });
      })
      .catch(() => undefined);
    return () => {
      unsubPosts();
      unsubMember();
      unsubOwned();
      unsubCreatedEvents();
    };
  }, [profile]);

  // Joined events: resolve the attendee ids to full docs (NOT the first events
  // page — that dropped joined events outside the page).
  React.useEffect(() => {
    if (!profile) return;
    let active = true;
    (async () => {
      try {
        const joinedIds = await getJoinedEventIds(profile.id);
        if (!active) return;
        if (joinedIds.size === 0) {
          setJoinedEvents([]);
          return;
        }
        const docs = await getEventsByIds(Array.from(joinedIds));
        if (active) setJoinedEvents(docs);
      } catch (error) {
        console.error(error);
      }
    })();
    return () => {
      active = false;
    };
  }, [profile]);

  // Resolve liked posts ONCE per id — merged, never replaced (same rationale
  // as the home feed: replacing raced the optimistic like and desynced it).
  React.useEffect(() => {
    if (!profile || posts.length === 0) return;
    const missing = posts
      .map((post) => post.id)
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
        missing.forEach((id) => likedResolvedRef.current.delete(id));
      });
  }, [posts, profile]);

  const handleToggleLike = async (post: Post) => {
    if (!profile) return;
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
          ? { ...item, likeCount: Math.max(0, (item.likeCount ?? 0) + (isLiked ? -1 : 1)) }
          : item
      )
    );
    try {
      const nowLiked = await toggleLike(post.id, profile.id);
      setLiked((prev) => {
        const next = new Set(prev);
        if (nowLiked) next.add(post.id);
        else next.delete(post.id);
        return next;
      });
      if (nowLiked) {
        notifySafely({
          recipientId: post.authorId,
          actor: profile,
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
            ? { ...item, likeCount: Math.max(0, (item.likeCount ?? 0) + (isLiked ? 1 : -1)) }
            : item
        )
      );
      toast.error("Failed to update like.");
    }
  };

  const handleView = React.useCallback(
    (post: Post) => {
      if (!profile) return;
      incrementViewCount(post.id, profile.id).catch(() => undefined);
    },
    [profile]
  );

  const scrollToTabs = React.useCallback(() => {
    // Wait a frame so the tab switch renders before scrolling.
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

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary to-blue-500" />
        <CardContent className="relative pt-0">
          <div className="-mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <Avatar className="h-24 w-24 border-4 border-card shadow-md">
                <AvatarImage
                  src={profile.profilePhotoUrl || DEFAULT_AVATAR}
                  alt={profile.name}
                />
                <AvatarFallback className="text-xl">
                  {initials(profile.name || profile.username)}
                </AvatarFallback>
              </Avatar>
              <div className="pb-1">
                <h1 className="font-display text-xl font-bold">
                  {profile.name || profile.username}
                </h1>
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={async () => {
                  // Username, not uid: the link stays valid even if the auth
                  // provider changes again — and /user?u=<username> resolves
                  // for visitors, while /profile is only ever your own page.
                  const url = `${window.location.origin}/user?u=${encodeURIComponent(
                    profile.username
                  )}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success("Profile link copied");
                  } catch {
                    toast.error(url);
                  }
                }}
              >
                <Link2 className="h-4 w-4" /> Copy link
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-4 w-4" /> Edit profile
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            {profile.about && <p>{profile.about}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
              {profile.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4" /> {profile.email}
                </span>
              )}
              {profile.branch && (
                <span className="flex items-center gap-1.5">
                  <School className="h-4 w-4" /> {profile.branch}
                </span>
              )}
            </div>
            <SocialLinks links={profile.socialLinks} />
          </div>

          <ProfileStatsGrid
            stats={[
              { key: "posts", label: "Posts", value: profile.postCount ?? 0 },
              { key: "notes", label: "Notes", value: activity.notes },
              { key: "projects", label: "Projects", value: activity.projects },
              { key: "events", label: "Events", value: activity.events },
              { key: "followers", label: "Followers", value: profile.followerCount ?? 0 },
              { key: "following", label: "Following", value: profile.followingCount ?? 0 },
            ]}
            onSelect={handleStatSelect}
          />
        </CardContent>
      </Card>

      <div ref={tabsRef} className="scroll-mt-20">
        <Tabs value={tab} onValueChange={(value) => setTab(value as ProfileTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-3">
            {posts.length === 0 ? (
              <EmptyState icon={Newspaper} title="No posts yet" />
            ) : (
              posts.map((post) => (
                <ProfilePostCard
                  key={post.id}
                  post={post}
                  currentUser={profile}
                  liked={liked.has(post.id)}
                  onToggleLike={handleToggleLike}
                  onOpenComments={setCommentsPostId}
                  onDeleted={(id) =>
                    setPosts((prev) => prev.filter((item) => item.id !== id))
                  }
                  onView={handleView}
                  authorOnline={presence.get(post.authorId) ?? false}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="projects" className="space-y-3">
            <ProfileProjectsSection
              viewer={profile}
              owner={profile}
              memberProjects={memberProjects}
              ownedProjects={ownedProjects}
              subTab={projectSubTab}
              onSubTabChange={setProjectSubTab}
            />
          </TabsContent>

          <TabsContent value="events" className="space-y-3">
            <ProfileEventsSection
              viewer={profile}
              owner={profile}
              joinedEvents={joinedEvents}
              createdEvents={createdEvents}
              subTab={eventSubTab}
              onSubTabChange={setEventSubTab}
            />
          </TabsContent>
        </Tabs>
      </div>

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

      {followMode && (
        <FollowListDialog
          userId={profile.id}
          mode={followMode}
          open={followMode !== null}
          onOpenChange={(open) => {
            if (!open) setFollowMode(null);
          }}
        />
      )}

      <EditProfileDialog
        profile={profile}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
