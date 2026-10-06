import { toMillis } from "@/lib/utils";
import type { Post, UserProfile } from "@/types";

/**
 * Client-side feed ranking.
 *
 * There is no backend (the app is a static export) and Firestore cannot rank,
 * so the feed fetches a recent window and scores it in the browser. Every
 * weight lives in `FEED_WEIGHTS` so the ordering can be tuned in one place
 * rather than hunted through the scorer.
 */

export type FeedTab = "for-you" | "latest" | "following";

export const FEED_TABS: { value: FeedTab; label: string }[] = [
  { value: "for-you", label: "For you" },
  { value: "latest", label: "Latest" },
  { value: "following", label: "Following" },
];

export const FEED_WEIGHTS = {
  /** A post loses half its recency score every N hours. */
  recencyHalfLifeHours: 12,
  recency: 1,
  engagement: 0.35,
  /** Rewards posts gaining traction fast, not just old posts with big totals. */
  velocity: 0.6,
  affinity: 0.9,
  media: 0.2,
  /** Diversity: how many posts one author may hold in the top block. */
  maxPostsPerAuthor: 2,
  /** Multiplier applied to posts beyond that allowance. */
  repeatPenalty: 0.45,
} as const;

export interface FeedContext {
  viewer: UserProfile;
  followingIds: Set<string>;
  /** Injectable for deterministic tests. */
  now?: number;
}

export interface RankedPost extends Post {
  /** Exposed for debugging/inspection; the UI does not currently show it. */
  score: number;
}

/**
 * Engagement, compressed with `log1p`.
 *
 * Without the log a single viral post would permanently outrank everything
 * else; comments are weighted above likes because they cost more effort.
 */
export function engagementScore(post: Post): number {
  const likes = post.likeCount ?? 0;
  const comments = post.commentCount ?? 0;
  const views = post.viewCount ?? 0;
  return Math.log1p(likes * 3 + comments * 5 + views * 0.2);
}

/**
 * Ranks posts for "For you".
 *
 * Signals: exponential recency decay, compressed engagement, engagement
 * velocity (catches something trending now), follow affinity, and a small bonus
 * for posts carrying an image. A final pass limits how many consecutive posts
 * one author can own.
 */
export function rankFeed(posts: Post[], ctx: FeedContext): RankedPost[] {
  const now = ctx.now ?? Date.now();
  const halfLifeMs = FEED_WEIGHTS.recencyHalfLifeHours * 60 * 60 * 1000;
  const { recency, engagement, velocity, affinity, media } = FEED_WEIGHTS;

  const scored: RankedPost[] = posts.map((post) => {
    const ageMs = Math.max(0, now - toMillis(post.createdAt));
    const recencyValue = Math.pow(0.5, ageMs / halfLifeMs);
    const engagementValue = engagementScore(post);
    const hours = ageMs / (60 * 60 * 1000);
    // +2 avoids dividing by ~0 for a brand-new post.
    const velocityValue = engagementValue / (hours + 2);
    const affinityValue = ctx.followingIds.has(post.authorId) ? 1 : 0;
    const mediaValue = post.imageUrl ? 1 : 0;

    return {
      ...post,
      score:
        recency * recencyValue +
        engagement * engagementValue +
        velocity * velocityValue +
        affinity * affinityValue +
        media * mediaValue,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Diversity pass: keep the list from becoming one person's wall.
  const shown = new Map<string, number>();
  return scored
    .map((post) => {
      const count = shown.get(post.authorId) ?? 0;
      shown.set(post.authorId, count + 1);
      if (count < FEED_WEIGHTS.maxPostsPerAuthor) return post;
      return { ...post, score: post.score * FEED_WEIGHTS.repeatPenalty };
    })
    .sort((a, b) => b.score - a.score);
}

/** Applies the selected tab. "Latest" is a plain chronological sort. */
export function selectFeed(
  posts: Post[],
  tab: FeedTab,
  ctx: FeedContext
): Post[] {
  if (tab === "following") {
    const followed = posts.filter((post) => ctx.followingIds.has(post.authorId));
    return rankFeed(followed, ctx);
  }
  if (tab === "latest") {
    return [...posts].sort(
      (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)
    );
  }
  return rankFeed(posts, ctx);
}
