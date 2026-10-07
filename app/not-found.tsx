import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyAnimation } from "@/components/ui/lottie-animation";

export default function NotFound() {
  return (
    <main className="flex min-h-screen animate-fade-in flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <EmptyAnimation className="h-36 w-36" />
      <p className="font-display text-sm font-semibold uppercase tracking-widest text-primary">
        Error 404
      </p>
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Page not found
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have been
        moved.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild className="gap-2">
          <Link href="/home">
            <Home className="h-4 w-4" /> Back to feed
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/projects">
            <Compass className="h-4 w-4" /> Explore projects
          </Link>
        </Button>
      </div>
    </main>
  );
}
