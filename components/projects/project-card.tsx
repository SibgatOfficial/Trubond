"use client";

import * as React from "react";
import { Check, Loader2, LogOut, Settings, UserPlus, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Project, UserProfile } from "@/types";

export function ProjectCard({
  project,
  currentUser,
  isMember,
  isPending,
  onRequest,
  onLeave,
  onManage,
}: {
  project: Project;
  currentUser: UserProfile;
  isMember: boolean;
  isPending: boolean;
  onRequest: (project: Project) => void;
  onLeave: (project: Project) => void;
  onManage: (project: Project) => void;
}) {
  const isOwner = project.ownerId === currentUser.id;
  const [busy, setBusy] = React.useState(false);

  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">{project.title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              @{project.ownerUsername} · {project.members?.length ?? 0} member
              {(project.members?.length ?? 0) === 1 ? "" : "s"}
            </p>
          </div>
          <Badge variant={isMember ? "success" : "secondary"}>
            {isOwner ? "Owner" : isMember ? "Member" : "Open"}
          </Badge>
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

        <div className="flex items-center gap-2 border-t pt-3">
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
              <Button variant="secondary" size="sm" disabled className="gap-1.5">
                <Check className="h-4 w-4" /> Requested
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
    </Card>
  );
}
