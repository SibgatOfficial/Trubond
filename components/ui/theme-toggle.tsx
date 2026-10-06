"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Light/dark toggle.
 *
 * The icon is only decided after mount: the server has no idea which theme the
 * browser will resolve to, so rendering a specific icon during SSR causes a
 * hydration mismatch. Until then a neutral placeholder keeps the layout stable.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative overflow-hidden", className)}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted ? (
        <span className="relative flex h-5 w-5 items-center justify-center">
          <Sun
            className={cn(
              "absolute h-5 w-5 transition-all duration-300",
              isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
            )}
          />
          <Moon
            className={cn(
              "absolute h-5 w-5 transition-all duration-300",
              isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
            )}
          />
        </span>
      ) : (
        <span className="h-5 w-5" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
