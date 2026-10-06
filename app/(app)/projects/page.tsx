"use client";

import * as React from "react";
import { FolderKanban, Plus } from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { ProjectCard } from "@/components/projects/project-card";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ManageProjectDialog } from "@/components/projects/manage-project-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  hasRequested,
  leaveProject,
  requestToJoin,
  subscribeToProjects,
} from "@/lib/services/projects";
import type { Project } from "@/types";
import { toast } from "sonner";

export default function ProjectsPage() {
  const { profile } = useAuth();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [pending, setPending] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [manageProject, setManageProject] = React.useState<Project | null>(null);

  React.useEffect(() => {
    const unsubscribe = subscribeToProjects((next) => {
      setProjects(next);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!profile || projects.length === 0) return;
    let active = true;
    (async () => {
      const entries = await Promise.all(
        projects.map(async (p) => [p.id, await hasRequested(p.id, profile.id)] as const)
      );
      if (!active) return;
      const next = new Set<string>();
      entries.forEach(([id, isPending]) => {
        if (isPending) next.add(id);
      });
      setPending(next);
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [projects, profile]);

  if (!profile) return null;

  const handleRequest = async (project: Project) => {
    try {
      await requestToJoin(project, profile);
      setPending((prev) => new Set(prev).add(project.id));
      toast.success("Request sent to the project owner!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to send request.");
    }
  };

  const handleLeave = async (project: Project) => {
    if (!window.confirm(`Leave "${project.title}"?`)) return;
    try {
      await leaveProject(project.id, profile.id);
      toast.success("You left the project.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to leave project.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Projects</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Start a project and find teammates with the skills you need."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              currentUser={profile}
              isMember={project.members?.includes(profile.id)}
              isPending={pending.has(project.id)}
              onRequest={handleRequest}
              onLeave={handleLeave}
              onManage={setManageProject}
            />
          ))}
        </div>
      )}

      <CreateProjectDialog
        currentUser={profile}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <ManageProjectDialog
        project={manageProject}
        currentUser={profile}
        open={manageProject !== null}
        onOpenChange={(open) => {
          if (!open) setManageProject(null);
        }}
      />
    </div>
  );
}
