"use client";

import * as React from "react";

/**
 * Registers the service worker.
 *
 * Production only: in `next dev` a worker caching navigations fights hot
 * reloading and produces very confusing "why is my change not showing" bugs.
 */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
