import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EventItem, Note, Project, UserProfile } from "@/types";

/**
 * Search sources.
 *
 * Two different strategies, deliberately:
 *
 *  - People use a real Firestore prefix range query (`username >= term` and
 *    `<= term + \uf8ff`), which is the one search Firestore can do natively
 *    with a plain single-field index.
 *  - Notes / projects / events are loaded into a capped pool once and filtered
 *    in the browser, because Firestore has no substring search and a range
 *    query on a title would only match from the first character.
 */

export interface SearchPool {
  notes: Note[];
  projects: Project[];
  events: EventItem[];
  people: UserProfile[];
}

const POOL_LIMIT = 50;

const toProfile = (id: string, data: Record<string, unknown>) =>
  ({ id, ...data }) as unknown as UserProfile;

/**
 * Prefix search over usernames.
 *
 * `\uf8ff` is the highest code point Firestore accepts, so the range covers
 * every string starting with the term.
 */
export async function searchUsersByUsername(
  term: string,
  max = 8
): Promise<UserProfile[]> {
  const value = term.trim().toLowerCase();
  if (!value) return [];

  const snap = await getDocs(
    query(
      collection(db, "users"),
      where("username", ">=", value),
      where("username", "<=", `${value}\uf8ff`),
      limit(max)
    )
  );

  return snap.docs.map((d) => toProfile(d.id, d.data() as Record<string, unknown>));
}

/** One-shot load of everything the palette can browse. */
export async function fetchSearchPool(): Promise<SearchPool> {
  const [notesSnap, projectsSnap, eventsSnap, peopleSnap] = await Promise.all([
    getDocs(
      query(collection(db, "notes"), orderBy("createdAt", "desc"), limit(POOL_LIMIT))
    ),
    getDocs(
      query(collection(db, "projects"), orderBy("createdAt", "desc"), limit(POOL_LIMIT))
    ),
    getDocs(query(collection(db, "events"), orderBy("date", "asc"), limit(POOL_LIMIT))),
    getDocs(query(collection(db, "users"), limit(POOL_LIMIT))),
  ]);

  return {
    notes: notesSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Note, "id">),
    })),
    projects: projectsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Project, "id">),
    })),
    events: eventsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<EventItem, "id">),
    })),
    people: peopleSnap.docs.map((d) =>
      toProfile(d.id, d.data() as Record<string, unknown>)
    ),
  };
}

/** Case-insensitive "contains" over a set of fields. */
export function matchesTerm(
  term: string,
  ...fields: (string | undefined | null)[]
): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => field?.toLowerCase().includes(needle));
}
