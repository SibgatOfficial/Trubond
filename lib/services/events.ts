import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  deleteDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EventItem } from "@/types";

const nowIso = () => new Date().toISOString();

export interface NewEventInput {
  title: string;
  description: string;
  location: string;
  date: string;
  maxAttendees: number;
  coverPhotoUrl?: string | null;
}

export function subscribeToEvents(
  callback: (events: EventItem[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "events"),
    orderBy("date", "asc"),
    limit(30)
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventItem, "id">) }))
    );
  });
}

export async function createEvent(
  createdBy: string,
  input: NewEventInput
): Promise<void> {
  const { addDoc } = await import("firebase/firestore");
  await addDoc(collection(db, "events"), {
    title: input.title,
    description: input.description,
    location: input.location,
    date: input.date,
    maxAttendees: input.maxAttendees,
    attendeeCount: 0,
    coverPhotoUrl: input.coverPhotoUrl ?? null,
    createdBy,
    createdAt: nowIso(),
  });
}

export async function getJoinedEventIds(userId: string): Promise<Set<string>> {
  // A user is an attendee doc under each event; query them via collection group.
  const snap = await getDocs(
    query(
      collection(db, "events"),
      limit(200)
    )
  );
  const joined = new Set<string>();
  await Promise.all(
    snap.docs.map(async (eventDoc) => {
      const attendee = await getDocs(
        query(collection(db, "events", eventDoc.id, "attendees"), limit(500))
      );
      if (attendee.docs.some((a) => a.id === userId)) joined.add(eventDoc.id);
    })
  );
  return joined;
}

export async function joinEvent(
  eventId: string,
  userId: string
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const eventRef = doc(db, "events", eventId);
    const eventDoc = await transaction.get(eventRef);
    if (!eventDoc.exists()) throw new Error("Event not found");

    const data = eventDoc.data();
    const current = data.attendeeCount || 0;
    const max = data.maxAttendees as number | undefined;
    if (max && current >= max) throw new Error("Event is full");

    transaction.set(doc(db, "events", eventId, "attendees", userId), {
      joinedAt: nowIso(),
    });
    transaction.update(eventRef, { attendeeCount: current + 1 });
  });
}

export async function leaveEvent(
  eventId: string,
  userId: string
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const eventRef = doc(db, "events", eventId);
    const eventDoc = await transaction.get(eventRef);
    if (!eventDoc.exists()) throw new Error("Event not found");
    const current = eventDoc.data().attendeeCount || 0;
    transaction.delete(doc(db, "events", eventId, "attendees", userId));
    transaction.update(eventRef, { attendeeCount: Math.max(0, current - 1) });
  });
}

export async function hasJoinedEvent(
  eventId: string,
  userId: string
): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, "events", eventId, "attendees"), limit(500))
  );
  return snap.docs.some((d) => d.id === userId);
}

export async function getEvent(eventId: string): Promise<EventItem | null> {
  const { getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(db, "events", eventId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<EventItem, "id">) };
}

export { increment, setDoc, serverTimestamp, deleteDoc };
