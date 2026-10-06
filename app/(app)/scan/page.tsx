"use client";

import * as React from "react";
import jsQR from "jsqr";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Camera, CheckCircle2, Loader2, ScanLine, XCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { getEvent, recordEventScan } from "@/lib/services/events";
import { notifySafely } from "@/lib/services/notifications";
import { formatTimestamp, isOwnedBy } from "@/lib/utils";
import type { EventItem } from "@/types";
import { toast } from "sonner";

type ScanResult =
  | { status: "success"; title: string; details: string[] }
  | { status: "error"; title: string; details: string[] }
  | null;

export default function ScanPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId") ?? "";
  const { profile } = useAuth();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const [scanning, setScanning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ScanResult>(null);
  const [event, setEvent] = React.useState<EventItem | null>(null);
  const [loadingEvent, setLoadingEvent] = React.useState(Boolean(eventId));

  React.useEffect(() => {
    if (!eventId) return;
    let active = true;
    setLoadingEvent(true);
    getEvent(eventId)
      .then((item) => {
        if (active) setEvent(item);
      })
      .catch((err) => {
        console.error(err);
        if (active) setError("Couldn't load that event.");
      })
      .finally(() => {
        if (active) setLoadingEvent(false);
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  const isOwner =
    profile && event
      ? isOwnedBy(event.createdBy, event.createdByUsername, profile)
      : false;

  const stopScanner = React.useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const verifyQr = React.useCallback(
    async (raw: string) => {
      try {
        const data = JSON.parse(raw) as {
          eventId?: string;
          userId?: string;
          username?: string;
          name?: string;
        };
        if (!data.eventId || !data.userId || !data.username) {
          throw new Error("Invalid QR code format");
        }
        // Event-specific scanner: a ticket for event A never verifies at event B.
        if (eventId && data.eventId !== eventId) {
          throw new Error("This ticket is for a different event");
        }

        const eventDoc = await getDoc(doc(db, "events", data.eventId));
        if (!eventDoc.exists()) throw new Error("Event not found");
        const eventData = eventDoc.data();

        const attendeeDoc = await getDoc(
          doc(db, "events", data.eventId, "attendees", data.userId)
        );
        if (!attendeeDoc.exists()) {
          throw new Error("User is not registered for this event");
        }

        const scan = await recordEventScan(data.eventId, {
          userId: data.userId,
          username: data.username,
          name: data.name,
        });

        if (profile && data.userId) {
          notifySafely({
            recipientId: data.userId,
            actor: profile,
            type: "event_scan",
            targetId: data.eventId,
            href: "/events",
            text: scan.alreadyScanned
              ? "your ticket was scanned again"
              : "you checked in",
          });
        }

        const at = new Date(scan.scannedAt).toLocaleString();
        setResult({
          status: "success",
          title: scan.alreadyScanned
            ? "Already checked in"
            : "Ticket verified",
          details: [
            `Event: ${eventData.title as string}`,
            `Name: ${data.name ?? "—"}`,
            `Username: @${data.username}`,
            scan.alreadyScanned
              ? `First checked in: ${at} — no double count`
              : `Checked in: ${at}`,
          ],
        });
        stopScanner();
      } catch (err) {
        setResult({
          status: "error",
          title: "Verification failed",
          details: [
            err instanceof Error ? err.message : "Unknown error",
            "Please check the QR code and try again.",
          ],
        });
        stopScanner();
      }
    },
    [stopScanner, eventId, profile]
  );

  const startScanner = React.useCallback(async () => {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      const tick = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code?.data) {
              void verifyQr(code.data);
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error(err);
      setError(
        "Unable to access the camera. Please grant camera permission and try again."
      );
      setScanning(false);
    }
  }, [verifyQr]);

  React.useEffect(() => {
    return () => stopScanner();
  }, [stopScanner]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">QR Ticket Scanner</h1>
        <p className="text-sm text-muted-foreground">
          {event ? (
            <>
              Scanning for <span className="font-medium text-foreground">{event.title}</span>
              {event.location ? ` · ${event.location}` : ""} ·{" "}
              {formatTimestamp(event.startsAt ?? event.date)}
            </>
          ) : (
            "Scan an attendee's ticket to verify it."
          )}
        </p>
      </div>

      {loadingEvent ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading event…
          </CardContent>
        </Card>
      ) : eventId && !event ? (
        <EmptyState
          icon={ScanLine}
          title="Event not found"
          description="That scan link doesn't match any event."
        />
      ) : eventId && event && profile && !isOwner ? (
        <EmptyState
          icon={ScanLine}
          title="Organizers only"
          description="Only the event organizer can scan tickets for this event. Everyone else sees the checked-in count on the event card."
        />
      ) : (
        <>
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-black/90">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              playsInline
            />
            {!scanning && !result && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
                <Camera className="h-10 w-10" />
                <p className="text-sm">Camera preview</p>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {!scanning ? (
            <Button className="w-full" onClick={startScanner}>
              <Camera className="h-4 w-4" /> Start scanning
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={stopScanner}>
              <Loader2 className="h-4 w-4 animate-spin" /> Scanning… tap to stop
            </Button>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card
          className={
            result.status === "success"
              ? "border-emerald-300 bg-emerald-50"
              : "border-red-300 bg-red-50"
          }
        >
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              {result.status === "success" ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" />
              )}
              <p className="font-semibold">{result.title}</p>
            </div>
            <div className="space-y-1 text-sm">
              {result.details.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setResult(null);
                startScanner();
              }}
            >
              Scan another
            </Button>
          </CardContent>
        </Card>
      )}
        </>
      )}
    </div>
  );
}
