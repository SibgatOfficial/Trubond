"use client";

import * as React from "react";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { getEventScans } from "@/lib/services/events";
import { DEFAULT_AVATAR, initials, timeAgo } from "@/lib/utils";
import { UserLink } from "@/components/shared/user-link";
import type { Attendee, EventItem, EventScan } from "@/types";
import { toast } from "sonner";

/**
 * Owner-only attendee list: who registered vs who actually checked in.
 * Everyone else only ever sees counts on the event card.
 */
export function EventAttendeesDialog({
  event,
  open,
  onOpenChange,
}: {
  event: EventItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [attendees, setAttendees] = React.useState<Attendee[]>([]);
  const [scans, setScans] = React.useState<EventScan[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !event) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [attSnap, scanList] = await Promise.all([
          getDocs(
            query(collection(db, "events", event.id, "attendees"), limit(200))
          ),
          getEventScans(event.id).catch(() => [] as EventScan[]),
        ]);
        if (!active) return;
        setAttendees(
          attSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Attendee, "id">),
          }))
        );
        setScans(scanList);
      } catch (error) {
        console.error(error);
        if (active) toast.error("Failed to load attendees.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, event]);

  const scannedIds = React.useMemo(
    () => new Set(scans.map((s) => s.userId ?? s.id)),
    [scans]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Attendees{event ? ` · ${event.title}` : ""}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : attendees.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nobody registered yet.
          </p>
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {attendees.map((person) => {
              const checkedIn = scannedIds.has(person.id);
              return (
                <div
                  key={person.id}
                  className="flex items-center gap-3 rounded-lg border p-2.5"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={DEFAULT_AVATAR}
                      alt={person.username ?? person.id}
                    />
                    <AvatarFallback>
                      {initials(person.username ?? person.name ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <UserLink
                      userId={person.id}
                      className="truncate text-sm font-medium hover:text-primary hover:underline"
                    >
                      @{person.username ?? person.name ?? person.id}
                    </UserLink>
                    <p className="text-xs text-muted-foreground">
                      Registered{" "}
                      {person.joinedAt ? timeAgo(person.joinedAt) : ""} ago
                    </p>
                  </div>
                  <Badge variant={checkedIn ? "success" : "outline"}>
                    {checkedIn ? "Checked in" : "Registered"}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
