"use client";

import * as React from "react";
import { FolderKanban, Plus } from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { ProjectCard } from "@/components/projects/project-card";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ManageProjectDialog } from "@/components/projects/manage-project-dialog";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  fetchOlderProjects,
  cancelRequest,
  getRequestedProjectIds,
  leaveProject,
  requestToJoin,
  subscribeToProjects,
} from "@/lib/services/projects";
import { LoadMore } from "@/components/shared/load-more";
import { usePagedList } from "@/hooks/use-paged-list";
import type { Project } from "@/types";
import { toast } from "sonner";

export default function ProjectsPage() {
  const { profile } = useAuth();
  const {
    items: projects,
    setItems: setProjects,
    hasMore,
    loadingMore,
    applyFirstPage,
    loadMore,
  } = usePagedList<Project>(fetchOlderProjects, () =>
    toast.error("Failed to load more projects.")
  );
  const [pending, setPending] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [manageProject, setManageProject] = React.useState<Project | null>(null);
  const [editProject, setEditProject] = React.useState<Project | null>(null);
  const [leaveTarget, setLeaveTarget] = React.useState<Project | null>(null);
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = subscribeToProjects((page) => {
      applyFirstPage(page);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [applyFirstPage]);

  React.useEffect(() => {
    if (!profile) return;
    let active = true;
    // One collection-group query rather than one query per project.
    getRequestedProjectIds(profile.id)
      .then((set) => {
        if (active) setPending(set);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [profile]);

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

  const handleCancelRequest = async (project: Project) => {
    try {
      await cancelRequest(project.id, profile.id);
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
      toast.success("Request cancelled.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to cancel request.");
    }
  };

  const handleLeaveConfirm = async () => {
    if (!leaveTarget) return;
    const targetId = leaveTarget.id;
    // Close FIRST so Radix runs its exit cleanup (restores body
    // pointer-events) before the list re-renders underneath.
    setLeaveTarget(null);
    setLeaving(true);
    try {
      await leaveProject(targetId, profile.id);
      toast.success("You left the project.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to leave project.");
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Projects"
        description="Find teammates and build something together."
        action={
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Project
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <SkeletonCard key={i} media />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          animation="empty"
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
              onLeave={setLeaveTarget}
              onManage={setManageProject}
              onEdit={setEditProject}
              onDeleted={(id) =>
                setProjects((prev) => prev.filter((item) => item.id !== id))
              }
            />
          ))}
        </div>
      )}

      <LoadMore
        hasMore={hasMore}
        loading={loadingMore}
        onClick={loadMore}
        label="Load more projects"
      />

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

      <EditProjectDialog
        project={editProject}
        open={editProject !== null}
        onOpenChange={(open) => {
          if (!open) setEditProject(null);
        }}
        onSaved={(patch) =>
          setProjects((prev) =>
            prev.map((item) =>
              item.id === editProject?.id ? { ...item, ...patch } : item
            )
          )
        }
      />

      <AlertDialog
        open={leaveTarget !== null}
        onOpenChange={(open) => {
          if (!open && leaving) return;
          if (!open) setLeaveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Leave &ldquo;{leaveTarget?.title}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll stop receiving project updates and lose access to the
              project chat. The owner can invite you again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleLeaveConfirm();
              }}
              disabled={leaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leaving ? "Leaving…" : "Leave project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
