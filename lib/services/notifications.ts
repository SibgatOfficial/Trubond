import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppNotification, NotificationType } from "@/types";

/** The minimum actor shape a notification needs — not a full profile. */
export interface NotificationActor {
  id: string;
  username: string;
  name?: string;
  profilePhotoUrl?: string;
}

/**
 * In-app notifications.
 *
 * Written by the *acting* user (the person who liked/commented/followed), so the
 * Firestore rules can allow creating a notification only when
 * `request.auth.uid == actorId`, and reading only when `recipientId == auth.uid`.
 *
 * Reads use a plain equality filter (covered by Firestore's automatic
 * single-field index — no composite index to deploy) and sort client-side;
 * `pruneNotifications` keeps each recipient's set tiny so that sort is cheap.
 */

const nowIso = () => new Date().toISOString();

export interface NotificationInput {
  recipientId: string;
  actor: NotificationActor;
  type: NotificationType;
  targetId?: string;
  href?: string;
  text?: string;
}

/**
 * Creates a notification, unless you are acting on your own content.
 *
 * Fire-and-forget by design: a notification failing must never fail the action
 * that triggered it (liking a post should still work if this write is denied).
 */
export async function createNotification(
  input: NotificationInput
): Promise<void> {
  if (!input.recipientId || input.recipientId === input.actor.id) return;

  await addDoc(collection(db, "notifications"), {
    recipientId: input.recipientId,
    actorId: input.actor.id,
    actorUsername: input.actor.username,
    actorName: input.actor.name,
    actorPhoto: input.actor.profilePhotoUrl,
    type: input.type,
    targetId: input.targetId ?? null,
    href: input.href ?? null,
    text: input.text ?? null,
    read: false,
    createdAt: nowIso(),
  });
}

/** Safe wrapper for call sites: never throws into the caller's flow. */
export function notifySafely(input: NotificationInput): void {
  createNotification(input).catch((error) => {
    console.error("Notification write failed:", error);
  });
}

export function subscribeToNotifications(
  recipientId: string,
  callback: (notifications: AppNotification[]) => void
): Unsubscribe {
  // Equality-only query: an orderBy here would demand a composite
  // (recipientId + createdAt) whose absence fails with "failed-precondition"
  // and silently empties the bell. Sorting client-side removes that whole
  // class of failure; pruning keeps the doc count small.
  const q = query(
    collection(db, "notifications"),
    where("recipientId", "==", recipientId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const items: AppNotification[] = snap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, "id">) })
      );
      // Newest first — createdAt is written as an ISO string everywhere.
      items.sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
      );
      callback(items.slice(0, 30));
    },
    (error) => {
      console.error("Notification subscription failed:", error);
      callback([]);
    }
  );
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, "notifications", id), { read: true }));
  await batch.commit();
}

/**
 * Keeps only the newest `keep` notifications for a recipient.
 *
 * Firestore rules only allow the RECIPIENT to delete their own docs, so this
 * runs on the recipient's own session (the bell calls it once per mount).
 * Fire-and-forget: a pruning failure must never affect the visible list.
 */
export async function pruneNotifications(
  recipientId: string,
  keep = 20
): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, "notifications"),
      where("recipientId", "==", recipientId)
    )
  );
  const sorted = snap.docs
    .map((d) => ({
      ref: d.ref,
      createdAt: (d.data() as Partial<AppNotification>).createdAt,
    }))
    .sort((a, b) =>
      String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    );
  const excess = sorted.slice(keep);
  if (excess.length === 0) return;
  // Batches cap at 500 writes — stay well under with 400 per pass.
  const batch = writeBatch(db);
  excess.slice(0, 400).forEach(({ ref }) => batch.delete(ref));
  await batch.commit();
}

/**
 * Deletes EVERY notification belonging to `recipientId` — the confirm
 * dialog's "Clear all". Only the recipient may delete their own docs (see
 * firestore.rules). Batches loop, so backlogs larger than one 500-write
 * batch still clear.
 */
export async function clearNotifications(recipientId: string): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, "notifications"),
      where("recipientId", "==", recipientId)
    )
  );
  const refs = snap.docs.map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

/** Human-readable line, built in one place so the UI stays dumb. */
export function describeNotification(notification: AppNotification): string {
  const who = notification.actorName || `@${notification.actorUsername}`;
  switch (notification.type) {
    case "like":
      return `${who} liked your post`;
    case "comment":
      return notification.text
        ? `${who} commented: "${notification.text}"`
        : `${who} commented on your post`;
    case "reply":
      return notification.text
        ? `${who} replied: "${notification.text}"`
        : `${who} replied to you`;
    case "follow":
      return `${who} started following you`;
    case "note_upvote":
      return `${who} upvoted your note`;
    case "note_comment":
      return notification.text
        ? `${who} commented on your note: "${notification.text}"`
        : `${who} commented on your note`;
    case "project_approved":
      return `${who} approved your request to join a project`;
    case "event_registration":
      return `${who} registered for your event`;
    case "event_scan":
      return `${who} checked in to your event`;
    case "dm_request":
      return `${who} sent you a message request`;
    case "dm_accepted":
      return `${who} accepted your message request`;
    default:
      return `${who} interacted with your content`;
  }
}
