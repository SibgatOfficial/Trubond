"use client";

import * as React from "react";
import { CalendarX2, Plus } from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { EventCard } from "@/components/events/event-card";
import { CreateEventDialog } from "@/components/events/create-event-dialog";
import { EditEventDialog } from "@/components/events/edit-event-dialog";
import { QrTicketDialog } from "@/components/events/qr-ticket-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { toast } from "sonner";

export default function EventsPage() {
  const { profile } = useAuth();
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
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [ticketEvent, setTicketEvent] = React.useState<EventItem | null>(null);
  const [editEvent, setEditEvent] = React.useState<EventItem | null>(null);

  React.useEffect(() => {
    const unsubscribe = subscribeToEvents((page) => {
      applyFirstPage(page);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [applyFirstPage]);

  React.useEffect(() => {
    if (!profile) return;
    let active = true;
    getJoinedEventIds(profile.id)
      .then((set) => {
        if (active) setJoined(set);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // Deliberately NOT keyed on events.length: that re-ran the whole scan every
    // time any event anywhere changed. Joins/leaves update the set locally.
  }, [profile]);

  if (!profile) return null;

  const handleJoin = async (event: EventItem) => {
    try {
      await joinEvent(event.id, profile.id);
      setJoined((prev) => new Set(prev).add(event.id));
      toast.success("Registered for the event!");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to register.");
    }
  };

  const handleLeave = async (event: EventItem) => {
    try {
      await leaveEvent(event.id, profile.id);
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
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
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
    </div>
  );
}
