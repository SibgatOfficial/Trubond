import { Suspense } from "react";
import { UserProfileView } from "@/components/profile/user-profile-view";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Another user's profile, addressed as `/user?u=<uid>`.
 *
 * The `<Suspense>` boundary is mandatory, not cosmetic: `useSearchParams()`
 * inside a statically exported page forces a client-side bailout, and `next
 * build` fails without a boundary above it.
 */
export default function UserPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      }
    >
      <UserProfileView />
    </Suspense>
  );
}
