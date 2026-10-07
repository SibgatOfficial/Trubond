"use client";

import * as React from "react";
import {
  CalendarDays,
  ListChecks,
  Loader2,
  MapPin,
  MoreHorizontal,
  Pencil,
  QrCode,
  ScanLine,
  Ticket,
  Trash2,
  Users,
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
import { SafeImage } from "@/components/shared/safe-image";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { UserLink } from "@/components/shared/user-link";
import { deleteEvent } from "@/lib/services/events";
import { eventTiming, isOwnedBy, seedGradient } from "@/lib/utils";
import type { EventItem, UserProfile } from "@/types";
import { toast } from "sonner";

export function EventCard({
  event,
  joined,
  currentUser,
  onJoin,
  onLeave,
  onShowTicket,
  onEdit,
  onDeleted,
  onScan,
  onViewAttendees,
}: {
  event: EventItem;
  joined: boolean;
  currentUser: UserProfile;
  onJoin: (event: EventItem) => Promise<void> | void;
  onLeave: (event: EventItem) => Promise<void> | void;
  onShowTicket: (event: EventItem) => void;
  onEdit: (event: EventItem) => void;
  onDeleted: (eventId: string) => void;
  /** Owner-only: open the event-specific scanner. */
  onScan?: (event: EventItem) => void;
  /** Owner-only: show who registered / scanned. */
  onViewAttendees?: (event: EventItem) => void;
}) {
  // Uid OR username — events created before the auth migration carry only the
  // creator's old uid, so the uid check alone would hide their own controls.
  const isOwner = isOwnedBy(
    event.createdBy,
    event.createdByUsername,
    currentUser
  );
  const [busy, setBusy] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const capacity = event.maxAttendees ?? 0;
  const count = event.attendeeCount ?? 0;
  const isFull = capacity > 0 && count >= capacity && !joined;
  const percent = capacity > 0 ? Math.min(100, (count / capacity) * 100) : 0;

  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const targetId = event.id;
    // Close FIRST so Radix runs exit cleanup before the parent removes
    // this card; defer onDeleted one frame so the animation can start.
    setConfirmOpen(false);
    setDeleting(true);
    try {
      await deleteEvent(targetId);
      // Defer past the 200ms Radix exit animation so body cleanup finishes.
      window.setTimeout(() => onDeleted(targetId), 250);
      toast.success("Event deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete event.");
    } finally {
      setDeleting(false);
    }
  };

  const timing = eventTiming(event);
  const scanned = event.scanCount ?? 0;

  return (
    <Card className="overflow-hidden animate-item-in">
      {event.coverPhotoUrl ? (
        <SafeImage
          src={event.coverPhotoUrl}
          alt={`${event.title} cover`}
          className="h-36 w-full object-cover bg-muted/40"
          wrapperClassName="h-36 w-full bg-muted/40"
        />
      ) : (
        <div
          aria-hidden="true"
          className="h-36 w-full"
          style={{ background: seedGradient(event.id) }}
        />
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-start gap-2 text-base">
            <Ticket className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            {event.title}
          </CardTitle>

          <div className="flex shrink-0 items-center gap-1">
            {joined && <Badge variant="success">Registered</Badge>}
            {isOwner && <Badge variant="secondary">Organizer</Badge>}
            {timing.status && (
              <Badge variant={timing.status === "Ended" ? "outline" : "default"}>
                {timing.status}
              </Badge>
            )}
            {isFull && <Badge variant="destructive">Full</Badge>}

            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Event options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                {/* non-modal so the delete/edit dialogs opened from here never
                    inherit a stale `body { pointer-events: none }` lock. */}
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onEdit(event)}>
                    <Pencil /> Edit event
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setConfirmOpen(true)}
                  >
                    <Trash2 /> Delete event
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {event.description && (
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {event.description}
          </p>
        )}

        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" />
            {timing.line}
          </p>
          {event.location && (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              {event.location}
            </p>
          )}
          <p className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0" />
            {count}
            {capacity > 0 ? ` / ${capacity}` : ""} attending
            {isOwner || scanned > 0 ? ` · ${scanned} checked in` : ""}
          </p>
          {event.createdByUsername && (
            <p className="flex items-center gap-2 text-xs">
              Organized by{" "}
              <UserLink
                userId={event.createdBy ?? ""}
                className="font-medium text-foreground hover:text-primary hover:underline"
              >
                @{event.createdByUsername}
              </UserLink>
            </p>
          )}
        </div>

        {capacity > 0 && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-3">
          {isOwner ? (
            <>
              {onScan && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onScan(event)}
                >
                  <ScanLine className="h-4 w-4" /> Scan tickets
                </Button>
              )}
              {onViewAttendees && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onViewAttendees(event)}
                >
                  <ListChecks className="h-4 w-4" /> Attendees
                </Button>
              )}
            </>
          ) : joined ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => onShowTicket(event)}
              >
                <QrCode className="h-4 w-4" /> Show ticket
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => run(() => onLeave(event))}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Cancel registration
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="gap-1.5"
              disabled={busy || isFull}
              onClick={() => run(() => onJoin(event))}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isFull ? "Event full" : "Register"}
            </Button>
          )}
        </div>
      </CardContent>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && deleting) return;
          setConfirmOpen(open);
        }}
        title={`Delete "${event.title}"?`}
        description={
          count > 0
            ? `${count} ${count === 1 ? "person is" : "people are"} registered. Their registrations and QR tickets will stop working.`
            : "This removes the event and its registrations. It can't be undone."
        }
        confirmLabel="Delete event"
        busy={deleting}
        onConfirm={handleDelete}
      />
    </Card>
  );
}
