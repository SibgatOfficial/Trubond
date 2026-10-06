"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

import loadingAnimation from "@/lib/lottie/loading.json";
import emptyAnimation from "@/lib/lottie/empty.json";
import successAnimation from "@/lib/lottie/success.json";
import likeAnimation from "@/lib/lottie/like.json";
import commentAnimation from "@/lib/lottie/comment.json";
import sendAnimation from "@/lib/lottie/send.json";

/**
 * Props we actually use from `lottie-react`'s `LottieSvg`.
 *
 * Declared locally because the real component is generic over its element,
 * children and renderer, which does not line up with `next/dynamic`'s
 * `ComponentType`.
 */
interface LottiePlayerProps {
  src: object;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
}

/**
 * `lottie-web` touches `window`/`document` as it initialises, and this app is
 * statically exported — every page is prerendered in Node at build time — so the
 * player is loaded in the browser only. `ssr: false` guarantees the module is
 * never evaluated on the server.
 */
const LottieSvg = dynamic(
  () =>
    import("lottie-react").then(
      (mod) => mod.LottieSvg as unknown as React.ComponentType<LottiePlayerProps>
    ),
  { ssr: false, loading: () => null }
);

const ANIMATIONS = {
  loading: loadingAnimation,
  empty: emptyAnimation,
  success: successAnimation,
  like: likeAnimation,
  comment: commentAnimation,
  send: sendAnimation,
} as const;

export type LottieAnimationName = keyof typeof ANIMATIONS;

/** How long each one-shot animation runs, used to unmount it afterwards. */
const BURST_DURATION_MS: Partial<Record<LottieAnimationName, number>> = {
  like: 700,
  comment: 800,
  send: 750,
};

/**
 * Tracks the OS-level "reduce motion" preference.
 *
 * Lottie runs in a canvas/SVG loop that CSS cannot reach, so the global
 * `prefers-reduced-motion` rule in globals.css does not cover it — animations
 * have to opt out here.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Renders one of the bundled brand animations.
 *
 * The files in `lib/lottie/` are hand-authored, tiny (a few KB each) and use the
 * brand palette, so they add no network requests and no third-party assets.
 */
export function LottieAnimation({
  name,
  className,
  loop = true,
}: {
  name: LottieAnimationName;
  className?: string;
  loop?: boolean;
}) {
  return (
    <LottieSvg
      src={ANIMATIONS[name]}
      loop={loop}
      autoplay
      aria-hidden="true"
      className={cn("pointer-events-none select-none", className)}
    />
  );
}

/**
 * Plays a one-shot animation whenever `trigger` changes.
 *
 * Remounting via `key` restarts the animation from frame 0, which avoids
 * needing an imperative lottie handle. Renders nothing when motion is reduced.
 */
export function AnimationBurst({
  name,
  trigger,
  className,
}: {
  name: LottieAnimationName;
  /** Increment to replay. A value of 0 means "never played yet". */
  trigger: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (trigger === 0 || reduced) return;
    setVisible(true);
    const timeout = setTimeout(
      () => setVisible(false),
      BURST_DURATION_MS[name] ?? 700
    );
    return () => clearTimeout(timeout);
  }, [trigger, reduced, name]);

  if (!visible) return null;

  return (
    <LottieAnimation
      key={trigger}
      name={name}
      loop={false}
      className={className}
    />
  );
}

/** Convenience wrappers for the common cases. */

export function LoadingAnimation({ className }: { className?: string }) {
  return <LottieAnimation name="loading" className={cn("h-16 w-28", className)} />;
}

export function EmptyAnimation({ className }: { className?: string }) {
  return <LottieAnimation name="empty" className={cn("h-40 w-40", className)} />;
}

export function SuccessAnimation({ className }: { className?: string }) {
  return (
    <LottieAnimation
      name="success"
      loop={false}
      className={cn("h-20 w-20", className)}
    />
  );
}
