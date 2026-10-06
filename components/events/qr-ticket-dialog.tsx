"use client";

import * as React from "react";
import type QRCodeStylingType from "qr-code-styling";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import type { EventItem, UserProfile } from "@/types";

/**
 * Renders a QR "ticket" for an event. The QR payload matches the format the
 * legacy scan.html verifier expects:
 * { eventId, userId, username, name, eventTitle, timestamp }
 */
export function QrTicketDialog({
  event,
  currentUser,
  open,
  onOpenChange,
}: {
  event: EventItem | null;
  currentUser: UserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!open || !event) return;
    let disposed = false;
    setLoading(true);

    (async () => {
      try {
        const mod = await import("qr-code-styling");
        const QRCodeStyling = (mod.default ?? mod) as unknown as typeof QRCodeStylingType;
        if (disposed || !containerRef.current) return;

        const qrData = JSON.stringify({
          eventId: event.id,
          userId: currentUser.id,
          username: currentUser.username,
          name: currentUser.name,
          eventTitle: event.title,
          timestamp: new Date().toISOString(),
        });

        const qr = new QRCodeStyling({
          width: 260,
          height: 260,
          data: qrData,
          dotsOptions: { color: "#1d4ed8", type: "rounded" },
          backgroundOptions: { color: "#ffffff" },
          cornersSquareOptions: { type: "extra-rounded", color: "#1d4ed8" },
        });

        containerRef.current.innerHTML = "";
        qr.append(containerRef.current);
        setLoading(false);
      } catch (error) {
        console.error("Failed to render QR code:", error);
        setLoading(false);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [open, event, currentUser]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Event ticket</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div className="qr-surface flex min-h-[260px] min-w-[260px] items-center justify-center rounded-xl border p-4">
            {loading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
            <div ref={containerRef} />
          </div>
          <div className="w-full rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="font-semibold text-primary">{event?.title}</p>
            <p className="mt-1 text-muted-foreground">
              {currentUser.name} · @{currentUser.username}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Show this QR code at the entrance.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
