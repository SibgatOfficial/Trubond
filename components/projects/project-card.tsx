"use client";

import * as React from "react";
import {
  Check,
  Loader2,
  LogOut,
  MoreHorizontal,
  Pencil,
  Settings,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserLink } from "@/components/shared/user-link";
import { SafeImage } from "@/components/shared/safe-image";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { deleteProject } from "@/lib/services/projects";
import { seedGradient, isOwnedBy } from "@/lib/utils";
import type { Project, UserProfile } from "@/types";
import { toast } from "sonner";

export function ProjectCard({
  project,
  currentUser,
  isMember,
  isPending,
  onRequest,
  onCancelRequest,
  onLeave,
  onManage,
  onEdit,
  onDeleted,
}: {
  project: Project;
  currentUser: UserProfile;
  isMember: boolean;
  isPending: boolean;
  onRequest: (project: Project) => void;
  onCancelRequest?: (project: Project) => void;
  onLeave: (project: Project) => void;
  onManage: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDeleted: (projectId: string) => void;
}) {
  // Uid OR username — projects predating the auth migration carry the old uid.
  const isOwner = isOwnedBy(project.ownerId, project.ownerUsername, currentUser);
  const [busy, setBusy] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const targetId = project.id;
    // Close FIRST so Radix runs exit cleanup before the parent removes
    // this card; defer onDeleted one frame so the animation can start.
    setConfirmOpen(false);
    setDeleting(true);
    try {
      await deleteProject(targetId);
      // Defer past the 200ms Radix exit animation so body cleanup finishes.
      window.setTimeout(() => onDeleted(targetId), 250);
      toast.success("Project deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete project.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* A project without a cover still gets a deterministic brand gradient, so
          the grid looks intentional rather than half-finished. */}
      {project.coverPhotoUrl ? (
        <SafeImage
          src={project.coverPhotoUrl}
          alt={`${project.title} cover`}
          className="h-32 w-full object-cover"
          wrapperClassName="h-32 w-full"
        />
      ) : (
        <div
          aria-hidden="true"
          className="h-32 w-full"
          style={{ background: seedGradient(project.id) }}
        />
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate">{project.title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              <UserLink userId={project.ownerId}>
                @{project.ownerUsername}
              </UserLink>
              {" · "}
              {project.members?.length ?? 0} member
              {(project.members?.length ?? 0) === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Badge variant={isMember ? "success" : "secondary"}>
              {isOwner ? "Owner" : isMember ? "Member" : "Open"}
            </Badge>

            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Project options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                {/* non-modal so the delete/edit dialogs opened from here never
                    inherit a stale `body { pointer-events: none }` lock. */}
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onEdit(project)}>
                    <Pencil /> Edit details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setConfirmOpen(true)}
                  >
                    <Trash2 /> Delete project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {project.description}
        </p>

        {project.skillsRequired?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.skillsRequired.map((skill) => (
              <Badge key={skill} variant="outline" className="font-medium">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-4 w-4" />
            {project.members?.length ?? 0}/
            {(project.members?.length ?? 0) + (project.membersNeeded ?? 0)}
          </span>

          <div className="ml-auto flex gap-2">
            {isOwner || isMember ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onManage(project)}
                >
                  <Settings className="h-4 w-4" /> Manage
                </Button>
                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onEdit(project)}
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                )}
                {!isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => run(() => onLeave(project))}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                    Leave
                  </Button>
                )}
              </>
            ) : isPending ? (
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                disabled={busy}
                onClick={() => run(() => onCancelRequest?.(project))}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Requested — cancel?
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={busy}
                onClick={() => run(() => onRequest(project))}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Request to join
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && deleting) return;
          setConfirmOpen(open);
        }}
        title={`Delete "${project.title}"?`}
        description="This removes the project, its join requests and its project chat. It can't be undone."
        confirmLabel="Delete project"
        busy={deleting}
        onConfirm={handleDelete}
      />
    </Card>
  );
}
