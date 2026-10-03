"use client";

import * as React from "react";
import { CalendarDays, Loader2, MapPin, QrCode, Ticket, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/utils";
import type { EventItem } from "@/types";

export function EventCard({
  event,
  joined,
  onJoin,
  onLeave,
  onShowTicket,
}: {
  event: EventItem;
  joined: boolean;
  onJoin: (event: EventItem) => Promise<void> | void;
  onLeave: (event: EventItem) => Promise<void> | void;
  onShowTicket: (event: EventItem) => void;
}) {
  const [busy, setBusy] = React.useState(false);
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-start gap-2 text-base">
            <Ticket className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            {event.title}
          </CardTitle>
          {joined && <Badge variant="success">Registered</Badge>}
          {isFull && <Badge variant="destructive">Full</Badge>}
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
            <CalendarDays className="h-4 w-4" />
            {formatTimestamp(event.date)}
          </p>
          {event.location && (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {event.location}
            </p>
          )}
          <p className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {count}
            {capacity > 0 ? ` / ${capacity}` : ""} attending
          </p>
        </div>

        {capacity > 0 && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}

        <div className="flex gap-2 border-t pt-3">
          {joined ? (
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
    </Card>
  );
}
