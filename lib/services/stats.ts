import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";


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
  /** Projects this user created (owns). */
  ownedProjects: number | null;
  /** Events this user created (organised). */
  createdEvents: number | null;
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

  const [notes, projects, ownedProjects, createdEvents] = await Promise.all([
    count(query(collection(db, "notes"), where("uploaderId", "==", uid))),
    count(
      query(collection(db, "projects"), where("members", "array-contains", uid))
    ),
    count(query(collection(db, "projects"), where("ownerId", "==", uid))),
    count(query(collection(db, "events"), where("createdBy", "==", uid))),
  ]);

  return { notes, projects, ownedProjects, createdEvents };
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
