import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  runTransaction,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserProfile } from "@/types";

/**
 * The follow graph.
 *
 * A follow is a single document at `follows/{followerId}_{followingId}`. The
 * deterministic id is what makes following idempotent: the transaction reads it
 * first, so a double-click cannot inflate either counter.
 *
 * `followingCount` / `followerCount` already existed on `UserProfile` but were
 * initialised to 0 and never written by anything — these functions are what
 * finally keep them honest.
 */

const nowIso = () => new Date().toISOString();

export function followDocId(followerId: string, followingId: string): string {
  return `${followerId}_${followingId}`;
}

export async function isFollowing(
  followerId: string,
  followingId: string
): Promise<boolean> {
  if (followerId === followingId) return false;
  const snap = await getDoc(doc(db, "follows", followDocId(followerId, followingId)));
  return snap.exists();
}

/** Follow, updating both users' counters in one transaction. */
export async function follow(
  followerId: string,
  followingId: string
): Promise<void> {
  if (followerId === followingId) {
    throw new Error("You can't follow yourself.");
  }

  const ref = doc(db, "follows", followDocId(followerId, followingId));

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists()) return;

    transaction.set(ref, { followerId, followingId, createdAt: nowIso() });
    transaction.update(doc(db, "users", followerId), {
      followingCount: increment(1),
    });
    transaction.update(doc(db, "users", followingId), {
      followerCount: increment(1),
    });
  });
}

/** Unfollow. Also idempotent, so the counters cannot drift below zero. */
export async function unfollow(
  followerId: string,
  followingId: string
): Promise<void> {
  const ref = doc(db, "follows", followDocId(followerId, followingId));

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    if (!existing.exists()) return;

    transaction.delete(ref);
    transaction.update(doc(db, "users", followerId), {
      followingCount: increment(-1),
    });
    transaction.update(doc(db, "users", followingId), {
      followerCount: increment(-1),
    });
  });
}

/** Everyone `userId` follows. One query, single-field index. */
export async function getFollowingIds(userId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const snap = await getDocs(
    query(collection(db, "follows"), where("followerId", "==", userId))
  );
  snap.forEach((d) => {
    const id = d.data().followingId as string | undefined;
    if (id) ids.add(id);
  });
  return ids;
}

/** Everyone who follows `userId`. */
export async function getFollowerIds(userId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const snap = await getDocs(
    query(collection(db, "follows"), where("followingId", "==", userId))
  );
  snap.forEach((d) => {
    const id = d.data().followerId as string | undefined;
    if (id) ids.add(id);
  });
  return ids;
}

/** Live follow state for one pair, so the button stays correct across tabs. */
export function subscribeToFollowState(
  followerId: string,
  followingId: string,
  callback: (following: boolean) => void
): Unsubscribe {
  if (followerId === followingId) {
    callback(false);
    return () => undefined;
  }
  return onSnapshot(
    doc(db, "follows", followDocId(followerId, followingId)),
    (snap) => callback(snap.exists()),
    () => callback(false)
  );
}

/** How many candidates to pull before ranking. */
const POOL_LIMIT = 60;
/** Firestore allows at most 30 values in an `in` filter. */
const IN_FILTER_LIMIT = 30;

/**
 * "People you may know".
 *
 * A client-side heuristic, not a trained model — there is no backend, and the
 * app is a static export. Signals, roughly in order of how much they actually
 * matter:
 *
 *   1. **Mutual follows** — "3 people you follow follow them". This is the
 *      signal that drives friend suggestions on real platforms, far more than
 *      location does.
 *   2. **Shared projects** — you already work together.
 *   3. **Same branch and batch year** — a better campus proxy than GPS, since
 *      everyone is in the same buildings anyway.
 *   4. **Profile completeness and activity** — tie-breakers.
 *
 * Costs two extra queries on top of the candidate pool: one over `follows` for
 * the candidate set, one over `projects` for your own memberships.
 */
export async function suggestPeople(
  me: UserProfile,
  excludeIds: Set<string>,
  max = 5
): Promise<UserProfile[]> {
  const toProfile = (id: string, data: Record<string, unknown>) =>
    ({ id, ...data }) as unknown as UserProfile;

  // --- candidate pool -----------------------------------------------------
  const pool: UserProfile[] = [];
  const seen = new Set<string>();

  const collect = (snap: Awaited<ReturnType<typeof getDocs>>) => {
    snap.forEach((d) => {
      if (d.id === me.id || excludeIds.has(d.id) || seen.has(d.id)) return;
      const data = d.data() as Record<string, unknown>;
      // Skip the viewer's own pre-migration profile. Phone → Google auth issued
      // them a NEW uid, so their old profile is still in `users` under the
      // previous uid and would otherwise be suggested back to them.
      if (data.username && data.username === me.username) return;
      seen.add(d.id);
      pool.push(toProfile(d.id, data));
    });
  };

  // Same branch first; fall back to a general pool so a new user with an
  // unusual branch still sees suggestions.
  if (me.branch) {
    collect(
      await getDocs(
        query(
          collection(db, "users"),
          where("branch", "==", me.branch),
          limit(POOL_LIMIT)
        )
      )
    );
  }
  if (pool.length < max) {
    collect(await getDocs(query(collection(db, "users"), limit(POOL_LIMIT))));
  }
  if (pool.length === 0) return [];

  // --- mutual follows -----------------------------------------------------
  // One query: everyone who follows any candidate, then keep only the rows where
  // the follower is somebody *I* follow.
  const mutuals = new Map<string, number>();
  const candidateIds = pool.map((person) => person.id).slice(0, IN_FILTER_LIMIT);
  if (candidateIds.length > 0 && excludeIds.size > 0) {
    try {
      const snap = await getDocs(
        query(
          collection(db, "follows"),
          where("followingId", "in", candidateIds),
          limit(200)
        )
      );
      snap.forEach((d) => {
        const data = d.data();
        const followerId = data.followerId as string | undefined;
        const followingId = data.followingId as string | undefined;
        if (!followerId || !followingId) return;
        if (!excludeIds.has(followerId)) return;
        mutuals.set(followingId, (mutuals.get(followingId) ?? 0) + 1);
      });
    } catch (error) {
      // Optional signal — never let it break the whole suggestion list.
      console.error("Mutual-follow lookup failed:", error);
    }
  }

  // --- shared projects ----------------------------------------------------
  const projectPeers = new Set<string>();
  try {
    const snap = await getDocs(
      query(
        collection(db, "projects"),
        where("members", "array-contains", me.id),
        limit(30)
      )
    );
    snap.forEach((d) => {
      const members = (d.data().members as string[] | undefined) ?? [];
      members.forEach((id) => {
        if (id !== me.id) projectPeers.add(id);
      });
    });
  } catch (error) {
    console.error("Shared-project lookup failed:", error);
  }

  // --- score --------------------------------------------------------------
  const score = (candidate: UserProfile): number => {
    let total = 0;

    const mutual = mutuals.get(candidate.id) ?? 0;
    if (mutual > 0) total += Math.min(6, mutual * 2);

    if (projectPeers.has(candidate.id)) total += 2.5;

    if (candidate.branch && candidate.branch === me.branch) total += 3;
    if (candidate.startYear && candidate.startYear === me.startYear) total += 2;

    if (
      candidate.profilePhotoUrl &&
      !candidate.profilePhotoUrl.includes("placehold")
    ) {
      total += 1;
    }
    total += Math.min(3, (candidate.postCount ?? 0) * 0.3);
    total += Math.min(2, (candidate.followerCount ?? 0) * 0.1);
    if (candidate.about) total += 0.5;

    return total;
  };

  return pool.sort((a, b) => score(b) - score(a)).slice(0, max);
}
