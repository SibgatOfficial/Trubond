"use client";

import * as React from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import type { Page } from "@/lib/services/pagination";

/**
 * Accumulates a live first page plus on-demand older pages.
 *
 * Two details that matter:
 *
 *  1. **The cursor only comes from the first page until the user loads more.**
 *     After that it always comes from the most recent older fetch. A new post
 *     arriving shifts the first page's cursor forward, which would otherwise
 *     re-request documents that are already rendered.
 *  2. **Merging is by id.** The live first page replaces itself wholesale, while
 *     anything already loaded that is no longer on page one is kept below it.
 *
 * `fetchOlder` must be referentially stable — pass the module-level service
 * function, or wrap it in `useCallback`.
 */
export function usePagedList<T extends { id: string }>(
  fetchOlder: (cursor: QueryDocumentSnapshot) => Promise<Page<T>>,
  onError?: (error: unknown) => void
) {
  const [items, setItems] = React.useState<T[]>([]);
  const [hasMore, setHasMore] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const cursorRef = React.useRef<QueryDocumentSnapshot | null>(null);
  const loadedMoreRef = React.useRef(false);

  const onErrorRef = React.useRef(onError);
  React.useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  /** Feed this from the realtime `onSnapshot` callback. */
  const applyFirstPage = React.useCallback((page: Page<T>) => {
    setItems((previous) => {
      const freshIds = new Set(page.items.map((item) => item.id));
      const older = previous.filter((item) => !freshIds.has(item.id));
      return [...page.items, ...older];
    });
    if (!loadedMoreRef.current) cursorRef.current = page.cursor;
    setHasMore(page.hasMore);
  }, []);

  const loadMore = React.useCallback(async () => {
    const cursor = cursorRef.current;
    if (!cursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const page = await fetchOlder(cursor);
      loadedMoreRef.current = true;
      cursorRef.current = page.cursor;
      setHasMore(page.hasMore);
      setItems((previous) => {
        const known = new Set(previous.map((item) => item.id));
        return [
          ...previous,
          ...page.items.filter((item) => !known.has(item.id)),
        ];
      });
    } catch (error) {
      onErrorRef.current?.(error);
      // Stop offering "load more" rather than looping on a failing query.
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchOlder, loadingMore]);

  return { items, setItems, hasMore, loadingMore, applyFirstPage, loadMore };
}
