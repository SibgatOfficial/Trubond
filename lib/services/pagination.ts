import {
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type CollectionReference,
  type QueryDocumentSnapshot,
} from "firebase/firestore";



export type SortDirection = "asc" | "desc";

export interface Page<T> {
  items: T[];
  /** Feed this to the next fetch. `null` once the list is exhausted. */
  cursor: QueryDocumentSnapshot | null;
  /**
   * `docs.length === pageSize` — a short page means the end. Note that a full
   * page can still be the last one, in which case one more (empty) fetch is
   * needed to discover that; callers should keep the button until a short page.
   */
  hasMore: boolean;
}

/** Maps raw Firestore docs into domain objects with their id attached. */
export type DocMapper<T> = (
  id: string,
  data: Record<string, unknown>,
  doc: QueryDocumentSnapshot
) => T;

export function pageFromDocs<T>(
  docs: QueryDocumentSnapshot[],
  mapper: DocMapper<T>,
  pageSize: number
): Page<T> {
  return {
    items: docs.map((doc) =>
      mapper(doc.id, doc.data() as Record<string, unknown>, doc)
    ),
    cursor: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore: docs.length === pageSize,
  };
}

export function firstPageQuery(
  collectionRef: CollectionReference,
  orderField: string,
  direction: SortDirection,
  pageSize: number
) {
  return query(
    collectionRef,
    orderBy(orderField, direction),
    limit(pageSize)
  );
}

/**
 * Fetches the page after `cursor`.
 *
 * Always discards the cursor when the page comes back empty, so a caller that
 * loops on `hasMore` cannot re-request the same page forever.
 */
export async function fetchOlderPage<T>(
  collectionRef: CollectionReference,
  orderField: string,
  direction: SortDirection,
  cursor: QueryDocumentSnapshot,
  pageSize: number,
  mapper: DocMapper<T>
): Promise<Page<T>> {
  const snap = await getDocs(
    query(
      collectionRef,
      orderBy(orderField, direction),
      startAfter(cursor),
      limit(pageSize)
    )
  );
  return pageFromDocs(snap.docs, mapper, pageSize);
}

/** Default page sizes, kept together so they are easy to tune. */
export const PAGE_SIZE = {
  feed: 20,
  notes: 24,
  projects: 24,
  events: 24,
  chat: 40,
  comments: 50,
  profilePosts: 20,
} as const;
