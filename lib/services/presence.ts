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
