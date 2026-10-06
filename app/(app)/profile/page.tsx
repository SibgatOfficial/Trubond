"use client";

import * as React from "react";
import {
  CalendarDays,
  FolderKanban,
  Mail,
  Newspaper,
  Pencil,
  School,
} from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import { subscribeToUserPosts } from "@/lib/services/posts";
import { subscribeToUserProjects } from "@/lib/services/projects";
import { getEvent, hasJoinedEvent, subscribeToEvents } from "@/lib/services/events";
import { DEFAULT_AVATAR, initials, timeAgo } from "@/lib/utils";
import type { EventItem, Post, Project } from "@/types";

export default function ProfilePage() {
  const { profile } = useAuth();
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [events, setEvents] = React.useState<EventItem[]>([]);
  const [editOpen, setEditOpen] = React.useState(false);

  React.useEffect(() => {
    if (!profile) return;
    const unsubPosts = subscribeToUserPosts(profile.id, setPosts);
    const unsubProjects = subscribeToUserProjects(profile.id, setProjects);
    return () => {
      unsubPosts();
      unsubProjects();
    };
  }, [profile]);

  React.useEffect(() => {
    if (!profile) return;
    let active = true;
    const unsubscribe = subscribeToEvents(async (all) => {
      const joined: EventItem[] = [];
      for (const event of all) {
        const isJoined = await hasJoinedEvent(event.id, profile.id);
        if (isJoined) {
          const full = (await getEvent(event.id)) ?? event;
          joined.push(full);
        }
      }
      if (active) setEvents(joined);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [profile]);

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
                  {initials(profile.name)}
                </AvatarFallback>
              </Avatar>
              <div className="pb-1">
                <h1 className="font-display text-xl font-bold">{profile.name}</h1>
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4" /> Edit profile
            </Button>
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
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Posts", value: profile.postCount ?? 0 },
              { label: "Projects", value: profile.projectsJoined ?? 0 },
              { label: "Events", value: profile.eventsJoined ?? 0 },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg bg-muted/60 p-3 text-center"
              >
                <p className="text-lg font-bold text-primary">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="posts">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-3">
          {posts.length === 0 ? (
            <EmptyState icon={Newspaper} title="No posts yet" />
          ) : (
            posts.map((post) => (
              <Card key={post.id}>
                <CardContent className="p-4">
                  {post.text && (
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {post.text}
                    </p>
                  )}
                  {post.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.imageUrl}
                      alt="Post"
                      className="mt-3 max-h-72 w-full rounded-lg border object-cover"
                    />
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {timeAgo(post.createdAt)} · {post.likeCount ?? 0} likes ·{" "}
                    {post.commentCount ?? 0} comments
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="projects" className="space-y-3">
          {projects.length === 0 ? (
            <EmptyState icon={FolderKanban} title="No projects joined" />
          ) : (
            projects.map((project) => (
              <Card key={project.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{project.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">
                    {project.description}
                  </p>
                  {project.skillsRequired?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {project.skillsRequired.map((skill) => (
                        <Badge key={skill} variant="outline">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="events" className="space-y-3">
          {events.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No events joined" />
          ) : (
            events.map((event) => (
              <Card key={event.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{event.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  {event.location} · {timeAgo(event.date)}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <EditProfileDialog
        profile={profile}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
