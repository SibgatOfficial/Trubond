"use client";

import * as React from "react";
import { Check, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  approveRequest,
  denyRequest,
  getPendingRequests,
  getProjectMembers,
} from "@/lib/services/projects";
import { getUsersByIds } from "@/lib/services/users";
import { DEFAULT_AVATAR, initials } from "@/lib/utils";
import type { Project, ProjectRequest, UserProfile } from "@/types";
import { toast } from "sonner";

export function ManageProjectDialog({
  project,
  currentUser,
  open,
  onOpenChange,
}: {
  project: Project | null;
  currentUser: UserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [requests, setRequests] = React.useState<ProjectRequest[]>([]);
  const [members, setMembers] = React.useState<UserProfile[]>([]);
  const [loading, setLoading] = React.useState(true);

  const isOwner = project?.ownerId === currentUser.id;

  const load = React.useCallback(async () => {
    if (!project) return;
    setLoading(true);
    try {
      const [reqs, memberIds] = await Promise.all([
        getPendingRequests(project.id),
        getProjectMembers(project.id),
      ]);
      const memberProfiles = await getUsersByIds(memberIds);
      setRequests(reqs);
      setMembers(memberProfiles);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load project details.");
    } finally {
      setLoading(false);
    }
  }, [project]);

  React.useEffect(() => {
    if (open && project) load();
  }, [open, project, load]);

  const handleApprove = async (request: ProjectRequest) => {
    if (!project) return;
    try {
      await approveRequest(project.id, request.id, request.userId);
      toast.success(`Approved @${request.username}`);
      load();
    } catch (error) {
      console.error(error);
      toast.error("Failed to approve request.");
    }
  };

  const handleDeny = async (request: ProjectRequest) => {
    if (!project) return;
    try {
      await denyRequest(project.id, request.id);
      toast.success("Request denied");
      load();
    } catch (error) {
      console.error(error);
      toast.error("Failed to deny request.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project?.title ?? "Project"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={isOwner ? "requests" : "members"}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="requests" disabled={!isOwner}>
              Requests {requests.length > 0 && `(${requests.length})`}
            </TabsTrigger>
            <TabsTrigger value="members">
              Members ({members.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-3">
            {loading ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            ) : requests.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No pending requests.
              </p>
            ) : (
              requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="text-sm font-medium">
                    @{request.username}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => handleApprove(request)}
                    >
                      <Check className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => handleDeny(request)}
                    >
                      <X className="h-4 w-4" /> Deny
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-3">
            {loading ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={member.profilePhotoUrl || DEFAULT_AVATAR}
                      alt={member.name}
                    />
                    <AvatarFallback>{initials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      @{member.username}
                    </p>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
