"use client";

import * as React from "react";
import { CalendarX2, Plus } from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { EventCard } from "@/components/events/event-card";
import { CreateEventDialog } from "@/components/events/create-event-dialog";
import { QrTicketDialog } from "@/components/events/qr-ticket-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getJoinedEventIds,
  joinEvent,
  leaveEvent,
  subscribeToEvents,
} from "@/lib/services/events";
import type { EventItem } from "@/types";
import { toast } from "sonner";

export default function EventsPage() {
  const { profile } = useAuth();
  const [events, setEvents] = React.useState<EventItem[]>([]);
  const [joined, setJoined] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [ticketEvent, setTicketEvent] = React.useState<EventItem | null>(null);

  React.useEffect(() => {
    const unsubscribe = subscribeToEvents((next) => {
      setEvents(next);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
  }, [profile, events.length]);

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
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Events</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Event
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
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
              onJoin={handleJoin}
              onLeave={handleLeave}
              onShowTicket={setTicketEvent}
            />
          ))}
        </div>
      )}

      <CreateEventDialog
        currentUserId={profile.id}
        open={createOpen}
        onOpenChange={setCreateOpen}
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
