import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
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
import { normalizeText } from "@/lib/utils";
import {
  fetchOlderPage,
  firstPageQuery,
  PAGE_SIZE,
  pageFromDocs,
  type DocMapper,
  type Page,
} from "@/lib/services/pagination";
import type { FirestoreDate, Note, NoteComment, NoteFile, UserProfile } from "@/types";

/**
 * Notes & assignment sharing.
 *
 * Upvotes use the user id as the sub-document id, which is what makes
 * `toggleNoteUpvote` idempotent and lets `getUpvotedNoteIds` filter the whole
 * collection group in one query (the same trick the likes in `posts.ts` use).
 */

const nowIso = () => new Date().toISOString();

export interface NewNoteInput {
  title: string;
  description: string;
  subject: string;
  branch: string;
  semester: string;
  tags: string[];
  files: NoteFile[];
  /** SHA-256 per file, used to spot re-uploads of the same bytes. */
  fileHashes?: string[];
}

const noteMapper: DocMapper<Note> = (id, data) =>
  ({ id, ...data }) as unknown as Note;

const noteCommentMapper: DocMapper<NoteComment> = (id, data) =>
  ({ id, ...data }) as unknown as NoteComment;

export function subscribeToNotes(
  callback: (page: Page<Note>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    firstPageQuery(collection(db, "notes"), "createdAt", "desc", PAGE_SIZE.notes),
    (snap) => callback(pageFromDocs(snap.docs, noteMapper, PAGE_SIZE.notes)),
    (error) => onError?.(error as Error)
  );
}

export async function fetchOlderNotes(
  cursor: QueryDocumentSnapshot
): Promise<Page<Note>> {
  return fetchOlderPage(
    collection(db, "notes"),
    "createdAt",
    "desc",
    cursor,
    PAGE_SIZE.notes,
    noteMapper
  );
}

export async function createNote(
  uploader: UserProfile,
  input: NewNoteInput
): Promise<void> {
  await addDoc(collection(db, "notes"), {
    title: input.title.trim(),
    description: input.description.trim(),
    subject: input.subject.trim(),
    branch: input.branch,
    semester: input.semester,
    tags: input.tags,
    files: input.files,
    fileHashes: input.fileHashes ?? [],
    uploaderId: uploader.id,
    uploaderUsername: uploader.username,
    uploaderName: uploader.name,
    uploaderPhoto: uploader.profilePhotoUrl,
    upvoteCount: 0,
    downloadCount: 0,
    commentCount: 0,
    createdAt: nowIso(),
  });
}

export async function deleteNote(noteId: string): Promise<void> {
  await deleteDoc(doc(db, "notes", noteId));
}

/**
 * Notes that already contain any of these file hashes.
 *
 * `array-contains-any` handles up to 30 values, so one query covers every file
 * on a note (we cap at 5 anyway).
 */
export async function findNotesByHashes(hashes: string[]): Promise<Note[]> {
  const wanted = hashes.filter(Boolean).slice(0, 30);
  if (wanted.length === 0) return [];

  const snap = await getDocs(
    query(
      collection(db, "notes"),
      where("fileHashes", "array-contains-any", wanted),
      limit(5)
    )
  );
  return snap.docs.map((d) =>
    noteMapper(d.id, d.data() as Record<string, unknown>, d)
  );
}

/**
 * Titles of loaded notes that look like the same submission: same subject and
 * semester, with an identical normalised title.
 *
 * Deliberately conservative — it warns, never blocks. Two genuinely different
 * assignments can share a title.
 */
export function findSimilarNotes(
  candidate: { title: string; subject?: string; semester?: string; excludeId?: string },
  existing: Note[]
): Note[] {
  const title = normalizeText(candidate.title);
  if (title.length < 6) return [];

  return existing.filter((note) => {
    if (note.id === candidate.excludeId) return false;
    if (candidate.subject && note.subject !== candidate.subject) return false;
    if (candidate.semester && note.semester !== candidate.semester) return false;
    return normalizeText(note.title) === title;
  });
}

/** Partially updates a note's own fields. Only the uploader may (see rules). */
export async function updateNote(
  noteId: string,
  input: Partial<Omit<NewNoteInput, "files">>
): Promise<void> {
  await updateDoc(doc(db, "notes", noteId), input);
}

/**
 * Toggles an upvote and returns the new state.
 *
 * Reading inside the transaction means a rapid double-click can't add two votes
 * or push the counter below zero.
 */
export async function toggleNoteUpvote(
  noteId: string,
  userId: string
): Promise<boolean> {
  const voteRef = doc(db, "notes", noteId, "upvotes", userId);
  const noteRef = doc(db, "notes", noteId);

  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(voteRef);
    if (existing.exists()) {
      transaction.delete(voteRef);
      transaction.update(noteRef, { upvoteCount: increment(-1) });
      return false;
    }
    transaction.set(voteRef, { userId, votedAt: nowIso() });
    transaction.update(noteRef, { upvoteCount: increment(1) });
    return true;
  });
}

/**
 * Every note the user has upvoted — one collection-group query on the `userId`
 * field (`documentId()` cannot be matched against a bare uid in a
 * collection-group). Legacy upvotes (uid as id only) are probed per note.
 */
export async function getUpvotedNoteIds(
  userId: string,
  /** When given, legacy upvotes are probed only within these notes. */
  noteIds?: string[]
): Promise<Set<string>> {
  const ids = new Set<string>();
  // Non-fatal: the legacy per-doc probes below still run if this fails.
  try {
    const snap = await getDocs(
      query(collectionGroup(db, "upvotes"), where("userId", "==", userId))
    );
    snap.forEach((d) => {
      // notes/{noteId}/upvotes/{userId} — two parents up is the note.
      const noteId = d.ref.parent.parent?.id;
      if (noteId) ids.add(noteId);
    });
  } catch (error) {
    console.error("upvotes collection-group query failed:", error);
  }
  if (noteIds && noteIds.length > 0) {
    try {
      const checks = await Promise.all(
        noteIds
          .filter((id) => !ids.has(id))
          .map(async (noteId) => ({
            noteId,
            exists: (
              await getDoc(doc(db, "notes", noteId, "upvotes", userId))
            ).exists(),
          }))
      );
      checks.forEach(({ noteId, exists }) => {
        if (exists) ids.add(noteId);
      });
    } catch (error) {
      console.error("Legacy upvote sweep failed:", error);
    }
  }
  return ids;
}

export async function incrementNoteDownload(noteId: string): Promise<void> {
  await updateDoc(doc(db, "notes", noteId), { downloadCount: increment(1) });
}

export function subscribeToNoteComments(
  noteId: string,
  callback: (comments: NoteComment[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "notes", noteId, "comments"),
    orderBy("createdAt", "asc"),
    limit(PAGE_SIZE.comments)
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) =>
        noteCommentMapper(d.id, d.data() as Record<string, unknown>, d)
      )
    );
  });
}

export async function addNoteComment(
  noteId: string,
  author: UserProfile,
  text: string,
  parentId?: string | null,
  replyToUsername?: string | null
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "notes", noteId, "comments")), {
    authorId: author.id,
    authorUsername: author.username,
    authorName: author.name,
    authorPhoto: author.profilePhotoUrl,
    text: text.trim(),
    parentId: parentId ?? null,
    replyToUsername: replyToUsername ?? null,
    createdAt: nowIso(),
  });
  batch.update(doc(db, "notes", noteId), { commentCount: increment(1) });
  await batch.commit();
}

export async function deleteNoteComment(
  noteId: string,
  commentId: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "notes", noteId, "comments", commentId));
  batch.update(doc(db, "notes", noteId), { commentCount: increment(-1) });
  await batch.commit();
}

export type NoteSort = "recent" | "top" | "downloads";

export interface NoteFilters {
  subject?: string;
  branch?: string;
  semester?: string;
  search?: string;
}

function toMillis(value: FirestoreDate): number {
  if (!value) return 0;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      /* fall through */
    }
  }
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value as string).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Subjects present in the loaded set, for the filter dropdown. */
export function collectSubjects(notes: Note[]): string[] {
  const subjects = new Set<string>();
  notes.forEach((note) => {
    if (note.subject) subjects.add(note.subject);
  });
  return Array.from(subjects).sort((a, b) => a.localeCompare(b));
}

/**
 * Filtering and sorting happen client-side.
 *
 * Firestore cannot combine several equality filters with an ordering without a
 * composite index per combination, and the working set here is capped at 60
 * notes — so filtering in the browser is both simpler and cheaper.
 */
export function filterNotes(
  notes: Note[],
  filters: NoteFilters,
  sort: NoteSort
): Note[] {
  const search = filters.search?.trim().toLowerCase();

  const result = notes.filter((note) => {
    if (filters.subject && note.subject !== filters.subject) return false;
    if (filters.branch && note.branch !== filters.branch) return false;
    if (filters.semester && note.semester !== filters.semester) return false;
    if (search) {
      const haystack = [
        note.title,
        note.description,
        note.subject,
        ...(note.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  return result.sort((a, b) => {
    if (sort === "top") return (b.upvoteCount ?? 0) - (a.upvoteCount ?? 0);
    if (sort === "downloads")
      return (b.downloadCount ?? 0) - (a.downloadCount ?? 0);
    return toMillis(b.createdAt) - toMillis(a.createdAt);
  });
}
