import {
  collection,
  doc,
  documentId,
  onSnapshot,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toMillis } from "@/lib/utils";
import type { FirestoreDate, UserProfile } from "@/types";

/**
 * Online presence, stored on the user document.
 *
 * Deliberately built on Firestore rather than the Realtime Database: RTDB is
 * Firebase's usual recommendation for presence, but enabling it would add a
 * second product (and another billing surface) for a single boolean. A
 * heartbeat plus a staleness window is accurate enough here and needs no new
 * infrastructure.
 *
 * The important consequence: a tab that is closed or killed can never write
 * "offline", so `isOnline` must ALWAYS be read through `isUserOnline`, which
 * also checks how fresh `lastSeen` is.
 */

const HEARTBEAT_MS = 60_000;

/** How long a heartbeat stays valid. Comfortably above the heartbeat interval. */
export const PRESENCE_STALE_MS = 2 * 60 * 1000;

/** Re-evaluate staleness on a timer, since expiry produces no data change. */
const TICK_MS = 45_000;

/** Firestore allows at most 30 values in an `in` filter. */
const MAX_SUBSCRIBERS = 30;

export function isUserOnline(
  user: Pick<UserProfile, "isOnline" | "lastSeen">,
  now: number = Date.now()
): boolean {
  if (!user.isOnline) return false;
  const seen = toMillis(user.lastSeen);
  return seen > 0 && now - seen < PRESENCE_STALE_MS;
}

/**
 * Begins the presence heartbeat for the signed-in user.
 *
 * Only beats while the tab is actually visible — a backgrounded tab should not
 * look "online". Returns a cleanup function that stops the heartbeat and marks
 * the user offline.
 */
export function startPresence(uid: string): () => void {
  if (typeof window === "undefined") return () => undefined;

  const ref = doc(db, "users", uid);
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const write = (isOnline: boolean) => {
    updateDoc(ref, {
      isOnline,
      lastSeen: new Date().toISOString(),
    }).catch(() => undefined);
  };

  const beat = () => write(true);

  const start = () => {
    if (heartbeat) return;
    beat();
    heartbeat = setInterval(beat, HEARTBEAT_MS);
  };

  const stop = () => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      start();
    } else {
      stop();
      write(false);
    }
  };

  if (document.visibilityState === "visible") start();
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    stop();
    write(false);
  };
}

/**
 * Live online/offline flags for a set of users.
 *
 * One batched query rather than one listener per user. Callers should pass only
 * the users actually on screen — cap is 30.
 */
export function subscribeToPresence(
  userIds: string[],
  callback: (presence: Map<string, boolean>) => void
): Unsubscribe {
  const unique = Array.from(new Set(userIds.filter(Boolean))).slice(
    0,
    MAX_SUBSCRIBERS
  );
  if (unique.length === 0) {
    callback(new Map());
    return () => undefined;
  }

  let raw = new Map<string, Pick<UserProfile, "isOnline" | "lastSeen">>();

  const emit = () => {
    const now = Date.now();
    const result = new Map<string, boolean>();
    for (const id of unique) {
      const data = raw.get(id);
      result.set(
        id,
        data
          ? isUserOnline(
              {
                isOnline: data.isOnline,
                lastSeen: data.lastSeen as FirestoreDate,
              },
              now
            )
          : false
      );
    }
    callback(result);
  };

  const unsubscribe = onSnapshot(
    query(collection(db, "users"), where(documentId(), "in", unique)),
    (snap) => {
      raw = new Map();
      snap.forEach((d) => {
        const data = d.data() as { isOnline?: boolean; lastSeen?: FirestoreDate };
        raw.set(d.id, { isOnline: data.isOnline, lastSeen: data.lastSeen });
      });
      emit();
    },
    () => emit()
  );

  // A user going stale produces no document change, so re-evaluate on a timer.
  const tick = setInterval(emit, TICK_MS);

  return () => {
    unsubscribe();
    clearInterval(tick);
  };
}
