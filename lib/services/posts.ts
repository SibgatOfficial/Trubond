import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  increment,
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
import {
  fetchOlderPage,
  firstPageQuery,
  PAGE_SIZE,
  pageFromDocs,
  type DocMapper,
  type Page,
} from "@/lib/services/pagination";
import type { Comment, Post, UserProfile } from "@/types";

const nowIso = () => new Date().toISOString();

const postMapper: DocMapper<Post> = (id, data) =>
  ({ id, ...data }) as unknown as Post;

const commentMapper: DocMapper<Comment> = (id, data) =>
  ({ id, ...data }) as unknown as Comment;

/**
 * Live first page of the feed.
 *
 * Bounded to one page: Firestore cannot keep an unbounded paginated set live,
 * so newer pages are fetched on demand via `fetchOlderPosts`.
 */
export function subscribeToFeed(
  callback: (page: Page<Post>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    firstPageQuery(collection(db, "posts"), "createdAt", "desc", PAGE_SIZE.feed),
    (snap) => callback(pageFromDocs(snap.docs, postMapper, PAGE_SIZE.feed)),
    (error) => onError?.(error as Error)
  );
}

export async function fetchOlderPosts(
  cursor: QueryDocumentSnapshot
): Promise<Page<Post>> {
  return fetchOlderPage(
    collection(db, "posts"),
    "createdAt",
    "desc",
    cursor,
    PAGE_SIZE.feed,
    postMapper
  );
}

export function subscribeToUserPosts(
  userId: string,
  callback: (posts: Post[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "posts"),
    where("authorId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(PAGE_SIZE.profilePosts)
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Post, "id">) }))
    );
  });
}

export async function createPost(
  author: UserProfile,
  text: string,
  imageUrl: string | null
): Promise<void> {
  const batch = writeBatch(db);
  const postRef = doc(collection(db, "posts"));
  batch.set(postRef, {
    authorId: author.id,
    authorUsername: author.username,
    authorName: author.name,
    authorPhoto: author.profilePhotoUrl,
    text,
    imageUrl: imageUrl ?? null,
    createdAt: nowIso(),
    likeCount: 0,
    commentCount: 0,
    viewCount: 0,
  });
  batch.update(doc(db, "users", author.id), {
    postCount: increment(1),
  });
  await batch.commit();
}

export async function updatePost(postId: string, text: string): Promise<void> {
  await updateDoc(doc(db, "posts", postId), { text });
}

export async function deletePost(
  postId: string,
  authorId: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "posts", postId));
  batch.update(doc(db, "users", authorId), { postCount: increment(-1) });
  await batch.commit();
}

export async function hasLiked(postId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "posts", postId, "likes", userId));
  return snap.exists();
}

export async function toggleLike(
  postId: string,
  userId: string
): Promise<boolean> {
  const likeRef = doc(db, "posts", postId, "likes", userId);
  const postRef = doc(db, "posts", postId);

  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(likeRef);
    if (existing.exists()) {
      transaction.delete(likeRef);
      transaction.update(postRef, { likeCount: increment(-1) });
      return false;
    }
    transaction.set(likeRef, { userId, likedAt: nowIso() });
    transaction.update(postRef, { likeCount: increment(1) });
    return true;
  });
}

export function subscribeToComments(
  postId: string,
  callback: (comments: Comment[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "posts", postId, "comments"),
    orderBy("createdAt", "asc"),
    limit(PAGE_SIZE.comments)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => commentMapper(d.id, d.data() as Record<string, unknown>, d)));
  });
}

export async function addComment(
  postId: string,
  author: UserProfile,
  text: string,
  parentId?: string | null,
  replyToUsername?: string | null
): Promise<void> {
  const batch = writeBatch(db);
  const commentRef = doc(collection(db, "posts", postId, "comments"));
  batch.set(commentRef, {
    authorId: author.id,
    authorUsername: author.username,
    authorName: author.name,
    authorPhoto: author.profilePhotoUrl,
    text,
    parentId: parentId ?? null,
    replyToUsername: replyToUsername ?? null,
    createdAt: nowIso(),
  });
  batch.update(doc(db, "posts", postId), { commentCount: increment(1) });
  await batch.commit();
}

export async function deleteComment(
  postId: string,
  commentId: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "posts", postId, "comments", commentId));
  batch.update(doc(db, "posts", postId), { commentCount: increment(-1) });
  await batch.commit();
}

const VIEW_THROTTLE_PREFIX = "trubond:viewed:";
const VIEW_THROTTLE_MS = 24 * 60 * 60 * 1000;

function hasRecentlyViewed(postId: string): boolean {
  // Never write during prerender; there is no browser to throttle against.
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(VIEW_THROTTLE_PREFIX + postId);
    if (!raw) return false;
    return Date.now() - Number(raw) < VIEW_THROTTLE_MS;
  } catch {
    return false;
  }
}

function markViewed(postId: string): void {
  try {
    window.localStorage.setItem(
      VIEW_THROTTLE_PREFIX + postId,
      String(Date.now())
    );
  } catch {
    /* storage blocked or full — the view just won't be throttled */
  }
}

/**
 * Records a view, at most once per post per day per browser.
 *
 * The feed used to call this for every post on every load, producing 30 batch
 * writes per visit regardless of whether anything was actually read. Callers
 * now fire it from an IntersectionObserver, and the throttle here means even a
 * careless caller cannot cause write amplification.
 */
export async function incrementViewCount(
  postId: string,
  userId: string
): Promise<void> {
  if (hasRecentlyViewed(postId)) return;
  markViewed(postId);

  const batch = writeBatch(db);
  batch.update(doc(db, "posts", postId), { viewCount: increment(1) });
  batch.set(doc(db, "posts", postId, "views", userId), {
    viewedAt: nowIso(),
  });
  await batch.commit();
}

/**
 * Which of `postIds` the user has liked.
 *
 * Filters on the `userId` FIELD: in a collection-group `documentId()` is the
 * full path, so matching it against a bare uid throws. New likes store
 * `userId`; legacy likes (uid as id only) fall back to direct per-post reads
 * (`hasLiked` — 1 read each, rules already allow it).
 */
export async function getLikedPostIds(
  postIds: string[],
  userId: string
): Promise<Set<string>> {
  const liked = new Set<string>();
  if (postIds.length === 0) return liked;

  // Non-fatal: if this query fails (rules/offline/index), the legacy per-doc
  // probes below still answer — a throw here used to reject the whole call
  // and make every like look like it never saved.
  try {
    const snap = await getDocs(
      query(collectionGroup(db, "likes"), where("userId", "==", userId))
    );

    const wanted = new Set(postIds);
    snap.forEach((d) => {
      // posts/{postId}/likes/{userId} — two parents up is the post document.
      const postId = d.ref.parent.parent?.id;
      if (postId && wanted.has(postId)) liked.add(postId);
    });
  } catch (error) {
    console.error("likes collection-group query failed:", error);
  }

  // Legacy fallback for likes written before `userId` was stored.
  const missing = postIds.filter((id) => !liked.has(id));
  if (missing.length > 0) {
    try {
      const checks = await Promise.all(
        missing.map(async (postId) => ({
          postId,
          exists: await hasLiked(postId, userId),
        }))
      );
      checks.forEach(({ postId, exists }) => {
        if (exists) liked.add(postId);
      });
    } catch (error) {
      console.error("Legacy like sweep failed:", error);
    }
  }

  return liked;
}

export function getPostRef(postId: string) {
  return doc(db, "posts", postId);
}

/**
 * Live single post, for the shareable `/post?id=` detail page.
 *
 * Emits `null` when the post is deleted so the page can show "not available".
 */
export function subscribeToPost(
  postId: string,
  callback: (post: Post | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "posts", postId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(postMapper(snap.id, snap.data() as Record<string, unknown>, snap));
    },
    (error) => onError?.(error as Error)
  );
}
