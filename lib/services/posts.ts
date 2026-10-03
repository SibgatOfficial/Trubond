import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Comment, Post, UserProfile } from "@/types";

const nowIso = () => new Date().toISOString();

export function subscribeToFeed(
  callback: (posts: Post[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc"),
    limit(30)
  );
  return onSnapshot(
    q,
    (snap) => {
      const posts = snap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as Omit<Post, "id">) })
      );
      callback(posts);
    },
    (error) => onError?.(error as Error)
  );
}

export function subscribeToUserPosts(
  userId: string,
  callback: (posts: Post[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "posts"),
    where("authorId", "==", userId),
    orderBy("createdAt", "desc")
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
  userId: string,
  currentlyLiked: boolean
): Promise<void> {
  const batch = writeBatch(db);
  const likeRef = doc(db, "posts", postId, "likes", userId);
  const postRef = doc(db, "posts", postId);
  if (currentlyLiked) {
    batch.delete(likeRef);
    batch.update(postRef, { likeCount: increment(-1) });
  } else {
    batch.set(likeRef, { likedAt: nowIso() });
    batch.update(postRef, { likeCount: increment(1) });
  }
  await batch.commit();
}

export function subscribeToComments(
  postId: string,
  callback: (comments: Comment[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "posts", postId, "comments"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, "id">) }))
    );
  });
}

export async function addComment(
  postId: string,
  author: UserProfile,
  text: string
): Promise<void> {
  const batch = writeBatch(db);
  const commentRef = doc(collection(db, "posts", postId, "comments"));
  batch.set(commentRef, {
    authorId: author.id,
    authorUsername: author.username,
    authorPhoto: author.profilePhotoUrl,
    text,
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

export async function incrementViewCount(
  postId: string,
  userId: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "posts", postId), { viewCount: increment(1) });
  batch.set(doc(db, "posts", postId, "views", userId), {
    viewedAt: nowIso(),
  });
  await batch.commit();
}

export async function getLikedPostIds(
  postIds: string[],
  userId: string
): Promise<Set<string>> {
  const liked = new Set<string>();
  await Promise.all(
    postIds.map(async (postId) => {
      const snap = await getDocs(
        query(
          collection(db, "posts", postId, "likes"),
          where(documentId(), "==", userId)
        )
      );
      if (!snap.empty) liked.add(postId);
    })
  );
  return liked;
}

export function getPostRef(postId: string) {
  return doc(db, "posts", postId);
}

export { setDoc, updateDoc, serverTimestamp };
