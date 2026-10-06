import { GraduationCap } from "lucide-react";
import { LoadingAnimation } from "@/components/ui/lottie-animation";

/**
 * Route-level loading UI. Rendered while a segment's data resolves during
 * client-side navigation, so the user never sees a frozen previous page.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
        <GraduationCap className="h-6 w-6" />
      </div>
      <LoadingAnimation className="h-12 w-20" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
