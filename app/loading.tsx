import { GraduationCap } from "lucide-react";
import { LoadingAnimation } from "@/components/ui/lottie-animation";

/**
 * Route-level loading UI. Rendered while a segment's data resolves during
 * client-side navigation, so the user never sees a frozen previous page.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-wash text-white shadow-soft"
        aria-hidden="true"
      >
        <GraduationCap className="h-6 w-6" />
      </div>
      <LoadingAnimation className="h-12 w-20" />
      <p className="text-sm text-muted-foreground" role="status">
        Loading…
      </p>
    </div>
  );
}
