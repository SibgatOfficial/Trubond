"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-provider";
import { cn } from "@/lib/utils";

/**
 * A link to somebody's profile.
 *
 * Your own name goes to `/profile` (the editable self view); everyone else's
 * goes to `/user?u=<uid>`.
 *
 * Why a query parameter and not `/user/[uid]`: the app is a static export
 * (`output: "export"`), so a dynamic segment would need `generateStaticParams`
 * listing every user id at build time — impossible for data that changes.
 */
export function UserLink({
  userId,
  children,
  className,
  onClick,
  stopPropagation = true,
}: {
  userId: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  /** Prevent a parent card's own click handler from also firing. */
  stopPropagation?: boolean;
}) {
  const { profile } = useAuth();

  const href =
    profile?.id === userId
      ? "/profile"
      : `/user?u=${encodeURIComponent(userId)}`;

  return (
    <Link
      href={href}
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "underline-offset-2 transition-colors hover:text-primary hover:underline",
        className
      )}
    >
      {children}
    </Link>
  );
}
