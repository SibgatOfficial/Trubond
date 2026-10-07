"use client";

import * as React from "react";

/**
 * Global safety net for the "frozen page" bug.
 *
 * Radix modals (Dialog / AlertDialog / Sheet / DropdownMenu / Select) set
 * `document.body.style.pointerEvents = "none"` while open and restore it on
 * close. When a dialog opens from a dropdown item — or a card unmounts
 * mid-close — the restore step can be skipped and the whole page stops
 * responding to clicks (looks fine, needs a reload).
 *
 * This watcher lives once in the root layout. Whenever `body` ends up with
 * `pointer-events: none` while NO Radix layer is open, it clears the stale
 * lock. When a layer genuinely is open it does nothing, so modal behaviour
 * (backdrop blocking clicks) is preserved.
 */
export function BodyLockGuard() {
  React.useEffect(() => {
    if (typeof document === "undefined") return;

    const isAnyLayerOpen = () =>
      document.querySelector(
        '[data-radix-popper-content-wrapper]:not([style*="display: none"]), [data-state="open"]'
      ) !== null;

    const releaseStaleLock = () => {
      if (
        document.body.style.pointerEvents === "none" &&
        !isAnyLayerOpen()
      ) {
        document.body.style.pointerEvents = "";
      }
    };

    // Radix writes the lock synchronously on close; a microtask/frame delay
    // lets a legitimate close finish before we inspect.
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        window.setTimeout(releaseStaleLock, 350);
      });
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style"],
      childList: true,
      subtree: true,
    });

    // Fallback poll for cases where no DOM mutation fires (mid-close unmount).
    const interval = window.setInterval(releaseStaleLock, 1000);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  return null;
}
