"use client";

import * as React from "react";
import Link from "next/link";
import { Hash, MessageSquare, Users } from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getChatRooms } from "@/lib/services/chat";
import type { ChatRoom } from "@/types";

export default function GroupsPage() {
  const { profile } = useAuth();
  const [rooms, setRooms] = React.useState<ChatRoom[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!profile) return;
    getChatRooms(profile)
      .then(setRooms)
      .finally(() => setLoading(false));
  }, [profile]);

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Groups"
        description="Your global, department and project groups."
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <EmptyState
          animation="empty"
          icon={Users}
          title="No groups yet"
          description="Join a project or set your branch to unlock department groups."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rooms.map((room) => (
            <Link key={`${room.type}-${room.id}`} href="/chat">
              <Card className="transition hover:border-primary hover:shadow-md">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {room.type === "global" ? (
                      <Hash className="h-5 w-5" />
                    ) : (
                      <MessageSquare className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{room.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {room.subtitle}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {room.type}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
