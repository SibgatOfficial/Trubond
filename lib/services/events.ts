import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { adjustUserStat } from "@/lib/services/users";
import {
  fetchOlderPage,
  firstPageQuery,
  PAGE_SIZE,
  pageFromDocs,
  type DocMapper,
  type Page,
} from "@/lib/services/pagination";
import type { EventItem, UserProfile } from "@/types";

const nowIso = () => new Date().toISOString();

export interface NewEventInput {
  title: string;
  description: string;
  location: string;
  /** Legacy single date — kept so old reads keep working. New writes set startsAt/endsAt. */
  date: string;
  startsAt: string;
  endsAt: string;
  maxAttendees: number;
  coverPhotoUrl?: string | null;
}

const eventMapper: DocMapper<EventItem> = (id, data) =>
  ({ id, ...data }) as unknown as EventItem;

export function subscribeToEvents(
  callback: (page: Page<EventItem>) => void
): Unsubscribe {
  return onSnapshot(
    firstPageQuery(collection(db, "events"), "date", "asc", PAGE_SIZE.events),
    (snap) => callback(pageFromDocs(snap.docs, eventMapper, PAGE_SIZE.events))
  );
}

export async function fetchOlderEvents(
  cursor: QueryDocumentSnapshot
): Promise<Page<EventItem>> {
  // Upcoming first, then later dates — `date` ascending, same as page one.
  return fetchOlderPage(
    collection(db, "events"),
    "date",
    "asc",
    cursor,
    PAGE_SIZE.events,
    eventMapper
  );
}

/**
 * Events the user created (organised). Single-field query — no composite index.
 *
 * Like projects, old events may carry the creator's pre-migration uid, so
 * callers ALSO match `createdByUsername` client-side via `isOwnedBy`.
 */
export function subscribeToCreatedEvents(
  userId: string,
  callback: (events: EventItem[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "events"),
    where("createdBy", "==", userId),
    limit(PAGE_SIZE.events)
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => eventMapper(d.id, d.data() as Record<string, unknown>, d))
    );
  });
}

/** One-shot fetch of events organised under a legacy username (see projects.ts). */
export async function getCreatedEventsByUsername(
  username: string
): Promise<EventItem[]> {
  const clean = username.trim().toLowerCase();
  if (!clean) return [];
  const snap = await getDocs(
    query(
      collection(db, "events"),
      where("createdByUsername", "==", username),
      limit(PAGE_SIZE.events)
    )
  );
  return snap.docs.map((d) =>
    eventMapper(d.id, d.data() as Record<string, unknown>, d)
  );
}

/**
 * The full event documents for a set of joined ids, in 30-id `in` chunks.
 *
 * The profile used to take only the first events page and filter it by joined
 * ids — any joined event outside that page silently vanished. Fetching by id
 * instead shows every joined event regardless of pagination.
 */
export async function getEventsByIds(ids: string[]): Promise<EventItem[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  const results: EventItem[] = [];
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    const snap = await getDocs(
      query(collection(db, "events"), where(documentId(), "in", chunk))
    );
    snap.forEach((d) =>
      results.push(eventMapper(d.id, d.data() as Record<string, unknown>, d))
    );
  }
  return results;
}

export async function createEvent(
  creator: UserProfile,
  input: NewEventInput
): Promise<void> {
  await addDoc(collection(db, "events"), {
    title: input.title,
    description: input.description,
    location: input.location,
    date: input.date,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    maxAttendees: input.maxAttendees,
    attendeeCount: 0,
    scanCount: 0,
    coverPhotoUrl: input.coverPhotoUrl ?? null,
    createdBy: creator.id,
    // Stored alongside the uid so ownership still resolves for this user after
    // any future auth-provider change. Existing events simply lack the field.
    createdByUsername: creator.username,
    createdAt: nowIso(),
  });
}

/**
 * Every event the user has joined.
 *
 * Two sources, BOTH non-fatal to each other:
 *  1. Collection-group query on the `userId` FIELD (`documentId()` can't be
 *     matched against a bare uid in a collection-group — that crash is what
 *     made joins look like they never saved). Covers attendee docs written
 *     after the fix.
 *  2. Direct per-doc reads for legacy docs (uid as doc id only) — and as
 *     insurance if (1) fails for any reason (rules, offline, index): without
 *     the try/catch below a single failed query used to reject the whole
 *     function, the caller's `.catch(() => empty)` swallowed it, and every
 *     join silently vanished on refresh.
 *
 * Pass `eventIds` (the events the caller actually renders) to bound the
 * legacy probes; without it a recent-events window is swept instead.
 */
export async function getJoinedEventIds(
  userId: string,
  eventIds?: string[]
): Promise<Set<string>> {
  const joined = new Set<string>();

  try {
    const snap = await getDocs(
      query(collectionGroup(db, "attendees"), where("userId", "==", userId))
    );
    snap.forEach((d) => {
      // events/{eventId}/attendees/{userId} — two parents up is the event.
      const eventId = d.ref.parent.parent?.id;
      if (eventId) joined.add(eventId);
    });
  } catch (error) {
    console.error("attendees collection-group query failed:", error);
  }

  try {
    let targets: string[];
    if (eventIds) {
      targets = eventIds.filter((id) => !joined.has(id));
    } else {
      // No id list given — sweep a recent window so legacy joins still show.
      const recent = await getDocs(
        query(collection(db, "events"), orderBy("date", "desc"), limit(50))
      );
      targets = recent.docs.map((d) => d.id).filter((id) => !joined.has(id));
    }
    await Promise.all(
      targets.map(async (eventId) => {
        const attendee = await getDoc(
          doc(db, "events", eventId, "attendees", userId)
        );
        if (attendee.exists()) joined.add(eventId);
      })
    );
  } catch (error) {
    console.error("Legacy attendee probe failed:", error);
  }

  return joined;
}

export async function joinEvent(
  eventId: string,
  userId: string
): Promise<void> {
  const joined = await runTransaction(db, async (transaction) => {
    const eventRef = doc(db, "events", eventId);
    const attendeeRef = doc(db, "events", eventId, "attendees", userId);

    const eventDoc = await transaction.get(eventRef);
    if (!eventDoc.exists()) throw new Error("Event not found");

    // Idempotent: a second click must not double-count the seat.
    const existing = await transaction.get(attendeeRef);
    if (existing.exists()) return false;

    const data = eventDoc.data();
    const current = data.attendeeCount || 0;
    const max = data.maxAttendees as number | undefined;
    if (max && current >= max) throw new Error("Event is full");

    transaction.set(attendeeRef, { userId, joinedAt: nowIso() });
    transaction.update(eventRef, { attendeeCount: current + 1 });
    return true;
  });

  // Runs outside the transaction because it needs its own read of the profile.
  if (joined) await adjustUserStat(userId, "eventsJoined", 1);
}

export async function leaveEvent(
  eventId: string,
  userId: string
): Promise<void> {
  const left = await runTransaction(db, async (transaction) => {
    const eventRef = doc(db, "events", eventId);
    const attendeeRef = doc(db, "events", eventId, "attendees", userId);

    const eventDoc = await transaction.get(eventRef);
    if (!eventDoc.exists()) throw new Error("Event not found");

    const existing = await transaction.get(attendeeRef);
    if (!existing.exists()) return false;

    const current = eventDoc.data().attendeeCount || 0;
    transaction.delete(attendeeRef);
    transaction.update(eventRef, { attendeeCount: Math.max(0, current - 1) });
    return true;
  });

  if (left) await adjustUserStat(userId, "eventsJoined", -1);
}

/**
 * Whether the user is an attendee of one event.
 *
 * A direct document read (1 read) rather than fetching every attendee. Prefer
 * `getJoinedEventIds` when checking more than one event at a time.
 */
export async function hasJoinedEvent(
  eventId: string,
  userId: string
): Promise<boolean> {
  const snap = await getDoc(doc(db, "events", eventId, "attendees", userId));
  return snap.exists();
}

export async function getEvent(eventId: string): Promise<EventItem | null> {
  const snap = await getDoc(doc(db, "events", eventId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<EventItem, "id">) };
}

/**
 * Per-event QR check-in.
 *
 * Scans live at `events/{eventId}/scans/{userId}` so re-scanning the same
 * ticket is idempotent — the second scan returns the prior time instead of
 * double-counting. `scanCount` mirrors the subcollection size for cheap reads.
 */
export async function recordEventScan(
  eventId: string,
  attendee: { userId: string; username?: string; name?: string }
): Promise<{ alreadyScanned: boolean; scannedAt: string }> {
  const scanRef = doc(db, "events", eventId, "scans", attendee.userId);
  const eventRef = doc(db, "events", eventId);
  const result = await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(scanRef);
    if (existing.exists()) {
      const data = existing.data();
      return {
        alreadyScanned: true,
        scannedAt: (data.scannedAt as string) ?? (data.joinedAt as string) ?? nowIso(),
      };
    }
    const at = nowIso();
    transaction.set(scanRef, {
      userId: attendee.userId,
      username: attendee.username ?? null,
      name: attendee.name ?? null,
      scannedAt: at,
      joinedAt: at,
    });
    const eventDoc = await transaction.get(eventRef);
    const current = (eventDoc.data()?.scanCount as number | undefined) ?? 0;
    transaction.update(eventRef, { scanCount: current + 1 });
    return { alreadyScanned: false, scannedAt: at };
  });
  return result;
}

export async function getEventScans(eventId: string): Promise<import("@/types").EventScan[]> {
  const snap = await getDocs(
    query(
      collection(db, "events", eventId, "scans"),
      orderBy("scannedAt", "desc"),
      limit(200)
    )
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<import("@/types").EventScan, "id">),
  }));
}

/** Partially updates an event. Only the creator should call this (see rules). */
export async function updateEvent(
  eventId: string,
  input: Partial<NewEventInput>
): Promise<void> {
  await updateDoc(doc(db, "events", eventId), input);
}

/**
 * Deletes an event *and* its attendee documents.
 *
 * Firestore has no cascade delete: leaving the `attendees` subcollection behind
 * would both orphan data and keep matching the collection-group query that works
 * out which events a user has joined — so a deleted event would still show as
 * "registered" on their profile.
 *
 * Capped at 400 attendee docs per commit, comfortably inside the 500-write
 * batch limit. An event larger than that is not a realistic campus case.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const attendees = await getDocs(
    query(collection(db, "events", eventId, "attendees"), limit(400))
  );
  const batch = writeBatch(db);
  attendees.forEach((attendee) => batch.delete(attendee.ref));
  batch.delete(doc(db, "events", eventId));
  await batch.commit();
}
