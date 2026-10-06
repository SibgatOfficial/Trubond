"use client";

import * as React from "react";

/**
 * The `beforeinstallprompt` event is not in TypeScript's DOM lib.
 * Only the parts we use are declared.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Progressive-web-app install affordance.
 *
 * Browsers surface the install prompt only on their own schedule, so this
 * captures `beforeinstallprompt` and lets the UI offer a button at a sensible
 * moment instead.
 *
 * Notes:
 *  - The event only fires on a **secure origin** (https or localhost) and only
 *    after the manifest and a service worker with a fetch handler are in place.
 *  - Our service worker registers in production only, so this will not fire
 *    under `next dev`. Install works on the deployed build.
 *  - iOS Safari never fires this event; installation there is Share → Add to
 *    Home Screen, which is why the Settings row always shows instructions.
 */
export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // Already launched from the home screen / installed app window.
    if (window.matchMedia?.("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    const onBeforeInstall = (event: Event) => {
      // Suppress the browser's own mini-infobar so our button drives it.
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = React.useCallback(async (): Promise<boolean> => {
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setPromptEvent(null);
    return choice.outcome === "accepted";
  }, [promptEvent]);

  return {
    /** True only when the browser has offered a prompt we can trigger. */
    canInstall: Boolean(promptEvent) && !installed,
    installed,
    promptInstall,
  };
}
