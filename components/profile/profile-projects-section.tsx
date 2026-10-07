"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, FolderKanban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { cn, isOwnedBy } from "@/lib/utils";
import type { Project, UserProfile } from "@/types";

export type ProjectSubTab = "joined" | "created";

/**
 * Projects split into Joined vs Created, shared by /profile and /user.
 *
 * `memberProjects` is the `members array-contains` subscription (owner is in
 * `members` too, so "Joined" excludes owned ones client-side via `isOwnedBy`,
 * which also covers pre-migration docs through the username fallback).
 * `ownedProjects` merges the live `ownerId` listener with the one-shot legacy
 * username sweep — deduped by id.
 */
export function ProfileProjectsSection({
  viewer,
  owner,
  memberProjects,
  ownedProjects,
  subTab,
  onSubTabChange,
}: {
  viewer: UserProfile;
  owner: UserProfile;
  memberProjects: Project[];
  ownedProjects: Project[];
  subTab: ProjectSubTab;
  onSubTabChange: (tab: ProjectSubTab) => void;
}) {
  const created = React.useMemo(() => {
    const byId = new Map<string, Project>();
    for (const project of [...ownedProjects, ...memberProjects]) {
      if (isOwnedBy(project.ownerId, project.ownerUsername, owner)) {
        byId.set(project.id, project);
      }
    }
    return Array.from(byId.values());
  }, [ownedProjects, memberProjects, owner]);

  const joined = React.useMemo(
    () =>
      memberProjects.filter(
        (project) => !isOwnedBy(project.ownerId, project.ownerUsername, owner)
      ),
    [memberProjects, owner]
  );

  const list = subTab === "created" ? created : joined;

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Projects filter"
        className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1"
      >
        {(
          [
            { value: "joined", label: `Joined (${joined.length})` },
            { value: "created", label: `Created (${created.length})` },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={subTab === option.value}
            onClick={() => onSubTabChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              subTab === option.value
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={
            subTab === "created"
              ? viewer.id === owner.id
                ? "You haven't created any projects"
                : `@${owner.username} hasn't created any projects`
              : viewer.id === owner.id
                ? "You haven't joined any projects"
                : `@${owner.username} hasn't joined any projects`
          }
          description={
            subTab === "created"
              ? "Start one from the Projects page."
              : undefined
          }
        />
      ) : (
        list.map((project) => (
          <Link
            key={project.id}
            href="/projects"
            aria-label={`View ${project.title} in Projects`}
            className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="transition-colors hover:border-primary/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="min-w-0 flex-1 truncate">{project.title}</span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="line-clamp-2 text-sm text-muted-foreground">
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
          </Link>
        ))
      )}
    </div>
  );
}
