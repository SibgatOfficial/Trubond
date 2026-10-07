import { Suspense } from "react";
import { PostDetailView } from "@/components/feed/post-detail-view";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * A single shareable post, addressed as `/post?id=<postId>`.
 *
 * Query param (not `/post/[id]`): the app is a static export
 * (`output: "export"`), so a dynamic segment would need `generateStaticParams`
 * listing every post id at build time. The `<Suspense>` boundary is mandatory
 * for the same reason — `useSearchParams()` forces a client-side bailout.
 */
export default function PostPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      }
    >
      <PostDetailView />
    </Suspense>
  );
}
