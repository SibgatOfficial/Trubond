import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
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
 * Requiring a composite index:
 *   notifications: recipientId ASC, createdAt DESC
 * (documented in firestore.indexes.json)
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
  const q = query(
    collection(db, "notifications"),
    where("recipientId", "==", recipientId),
    orderBy("createdAt", "desc"),
    limit(30)
  );

  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, "id">) })
        )
      );
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
    case "follow":
      return `${who} started following you`;
    case "note_upvote":
      return `${who} upvoted your note`;
    case "project_approved":
      return `${who} approved your request to join a project`;
    default:
      return `${who} interacted with your content`;
  }
}
