"use client";

import * as React from "react";
import { startPresence, subscribeToPresence } from "@/lib/services/presence";

/**
 * Online flags for a set of user ids.
 *
 * Keyed on the sorted id list rather than the array reference, so a caller can
 * build the array inline on every render without tearing down the listener.
 */
export function usePresenceMap(userIds: string[]): Map<string, boolean> {
  const [presence, setPresence] = React.useState<Map<string, boolean>>(
    () => new Map()
  );

  const key = React.useMemo(
    () => Array.from(new Set(userIds.filter(Boolean))).sort().join("|"),
    [userIds]
  );

  React.useEffect(() => {
    if (!key) {
      setPresence(new Map());
      return;
    }
    return subscribeToPresence(key.split("|"), setPresence);
  }, [key]);

  return presence;
}

/**
 * Runs the presence heartbeat for the signed-in user.
 *
 * Mount exactly once, near the root of the authenticated tree.
 */
export function usePresenceHeartbeat(uid: string | undefined): void {
  React.useEffect(() => {
    if (!uid) return;
    return startPresence(uid);
  }, [uid]);
}
