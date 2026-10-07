"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarX2, Plus } from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { EventCard } from "@/components/events/event-card";
import { CreateEventDialog } from "@/components/events/create-event-dialog";
import { EditEventDialog } from "@/components/events/edit-event-dialog";
import { QrTicketDialog } from "@/components/events/qr-ticket-dialog";
import { EventAttendeesDialog } from "@/components/events/event-attendees-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/skeleton";
import {
  fetchOlderEvents,
  getJoinedEventIds,
  joinEvent,
  leaveEvent,
  subscribeToEvents,
} from "@/lib/services/events";
import { LoadMore } from "@/components/shared/load-more";
import { usePagedList } from "@/hooks/use-paged-list";
import type { EventItem } from "@/types";
import { notifySafely } from "@/lib/services/notifications";
import { toast } from "sonner";

export default function EventsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const {
    items: events,
    setItems: setEvents,
    hasMore,
    loadingMore,
    applyFirstPage,
    loadMore,
  } = usePagedList<EventItem>(fetchOlderEvents, () =>
    toast.error("Failed to load more events.")
  );
  const [joined, setJoined] = React.useState<Set<string>>(new Set());
  /**
   * Event ids whose membership the server has already answered for.
   *
   * Claimed BEFORE each async resolve and by join/leave handlers, so a slow
   * response can never re-check (and possibly revert) an optimistic toggle —
   * resolve results are only ever unioned in for ids still pending.
   */
  const joinedResolvedRef = React.useRef<Set<string>>(new Set());
  /**
   * Ids the user explicitly toggled (join/leave) this session.
   *
   * `joinedResolvedRef` alone can't close the race: a resolve started before
   * the toggle holds the id in its `pending` array and may return stale truth
   * ("still joined") after the leave committed. Unioning skips anything in
   * this set — the user's last click always wins until a fresh page load.
   */
  const joinedUserDecidedRef = React.useRef<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [ticketEvent, setTicketEvent] = React.useState<EventItem | null>(null);
  const [editEvent, setEditEvent] = React.useState<EventItem | null>(null);
  const [attendeesEvent, setAttendeesEvent] = React.useState<EventItem | null>(
    null
  );

  React.useEffect(() => {
    const unsubscribe = subscribeToEvents((page) => {
      applyFirstPage(page);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [applyFirstPage]);

  /**
   * Which of the loaded events this user has joined.
   *
   * Re-runs when the event list grows (first page, live updates, load-more)
   * but only ever resolves ids nobody has answered for yet. The service is
   * given those ids so its legacy per-doc probes are bounded to what's on
   * screen — and if its collection-group query fails, the probes still
   * answer correctly instead of the whole call rejecting into a void
   * (which is exactly how joins used to vanish on refresh).
   */
  const resolveJoined = React.useCallback(
    (eventIds: string[]) => {
      if (!profile || eventIds.length === 0) return;
      const pending = eventIds.filter(
        (id) => !joinedResolvedRef.current.has(id)
      );
      if (pending.length === 0) return;
      pending.forEach((id) => joinedResolvedRef.current.add(id));
      getJoinedEventIds(profile.id, pending)
        .then((serverSet) => {
          setJoined((prev) => {
            const next = new Set(prev);
            serverSet.forEach((id) => {
              if (pending.includes(id) && !joinedUserDecidedRef.current.has(id)) {
                next.add(id);
              }
            });
            return next;
          });
        })
        .catch((error) => console.error("Failed to resolve joins:", error));
    },
    [profile]
  );

  React.useEffect(() => {
    resolveJoined(events.map((event) => event.id));
  }, [events, resolveJoined]);

  if (!profile) return null;

  const handleJoin = async (event: EventItem) => {
    try {
      await joinEvent(event.id, profile.id);
      // Claim before mutating: an in-flight resolve must never undo this.
      joinedResolvedRef.current.add(event.id);
      joinedUserDecidedRef.current.add(event.id);
      setJoined((prev) => new Set(prev).add(event.id));
      toast.success("Registered for the event!");
      // Ping the organiser — never yourself.
      if (event.createdBy && event.createdBy !== profile.id) {
        notifySafely({
          recipientId: event.createdBy,
          actor: profile,
          type: "event_registration",
          targetId: event.id,
          href: "/events",
        });
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to register.");
    }
  };

  const handleLeave = async (event: EventItem) => {
    try {
      await leaveEvent(event.id, profile.id);
      // Claim before mutating: an in-flight resolve must never undo this.
      joinedResolvedRef.current.add(event.id);
      joinedUserDecidedRef.current.add(event.id);
      setJoined((prev) => {
        const next = new Set(prev);
        next.delete(event.id);
        return next;
      });
      toast.success("Registration cancelled.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to cancel registration.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Events"
        description="Campus events, registrations and QR tickets."
        action={
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Event
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <SkeletonCard key={i} media />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          animation="empty"
          icon={CalendarX2}
          title="No events yet"
          description="Create the first campus event and start collecting registrations."
        />
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              joined={joined.has(event.id)}
              currentUser={profile}
              onJoin={handleJoin}
              onLeave={handleLeave}
              onShowTicket={setTicketEvent}
              onEdit={setEditEvent}
              onScan={(item) =>
                router.push(`/scan?eventId=${encodeURIComponent(item.id)}`)
              }
              onViewAttendees={setAttendeesEvent}
              onDeleted={(id) =>
                setEvents((prev) => prev.filter((item) => item.id !== id))
              }
            />
          ))}
        </div>
      )}

      <LoadMore
        hasMore={hasMore}
        loading={loadingMore}
        onClick={loadMore}
        label="Load more events"
      />

      <CreateEventDialog
        currentUser={profile}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EditEventDialog
        event={editEvent}
        open={editEvent !== null}
        onOpenChange={(open) => {
          if (!open) setEditEvent(null);
        }}
        onSaved={(patch) =>
          setEvents((prev) =>
            prev.map((item) =>
              item.id === editEvent?.id ? { ...item, ...patch } : item
            )
          )
        }
      />
      <QrTicketDialog
        event={ticketEvent}
        currentUser={profile}
        open={ticketEvent !== null}
        onOpenChange={(open) => {
          if (!open) setTicketEvent(null);
        }}
      />
      <EventAttendeesDialog
        event={attendeesEvent}
        open={attendeesEvent !== null}
        onOpenChange={(open) => {
          if (!open) setAttendeesEvent(null);
        }}
      />
    </div>
  );
}
