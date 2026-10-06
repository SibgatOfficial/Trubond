import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Platform-wide document counts.
 *
 * Uses Firestore **aggregation queries** (`getCountFromServer`) rather than
 * reading the collections: a count costs roughly one read per 1,000 documents
 * instead of one per document, so this stays cheap even as the platform grows.
 *
 * Every collection counted here is `allow read: if isSignedIn()` in
 * firestore.rules, so this works from the client with no backend.
 */

export interface PlatformStats {
  users: number;
  posts: number;
  events: number;
  projects: number;
  notes: number;
  follows: number;
  notifications: number;
}

/** Per-user activity counts, for the profile stats grid. */
export async function getUserActivityCounts(uid: string): Promise<{
  notes: number | null;
  projects: number | null;
}> {
  const count = async (q: Parameters<typeof getCountFromServer>[0]) => {
    try {
      const snapshot = await getCountFromServer(q);
      return snapshot.data().count;
    } catch (error) {
      console.error("Activity count failed:", error);
      return null;
    }
  };

  const [notes, projects] = await Promise.all([
    count(query(collection(db, "notes"), where("uploaderId", "==", uid))),
    count(
      query(collection(db, "projects"), where("members", "array-contains", uid))
    ),
  ]);

  return { notes, projects };
}

const COLLECTIONS = [
  "users",
  "posts",
  "events",
  "projects",
  "notes",
  "follows",
  "notifications",
] as const;

export type StatKey = (typeof COLLECTIONS)[number];

/**
 * Counts each collection.
 *
 * Individual failures resolve to `null` rather than throwing, so one collection
 * missing a rule does not blank the whole panel.
 */
export async function getPlatformStats(): Promise<
  Record<StatKey, number | null>
> {
  const entries = await Promise.all(
    COLLECTIONS.map(async (name) => {
      try {
        const snapshot = await getCountFromServer(collection(db, name));
        return [name, snapshot.data().count] as const;
      } catch (error) {
        console.error(`Count failed for ${name}:`, error);
        return [name, null] as const;
      }
    })
  );

  return Object.fromEntries(entries) as Record<StatKey, number | null>;
}
