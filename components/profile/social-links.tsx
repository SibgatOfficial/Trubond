"use client";

import { Github, Globe, Link2, Linkedin, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/types";

type SocialLinksMap = NonNullable<UserProfile["socialLinks"]>;

interface Platform {
  label: string;
  icon: LucideIcon;
  /** Turns whatever the user typed into an absolute URL. */
  toHref: (value: string) => string;
}

const stripScheme = (value: string) => value.trim().replace(/^https?:\/\//i, "");

const PLATFORMS: Record<keyof SocialLinksMap, Platform> = {
  linkedin: {
    label: "LinkedIn",
    icon: Linkedin,
    toHref: (value) => {
      const v = stripScheme(value).replace(/^@/, "");
      return v.includes("linkedin.com")
        ? `https://${v}`
        : `https://www.linkedin.com/in/${v.replace(/^\/+|^in\//, "")}`;
    },
  },
  github: {
    label: "GitHub",
    icon: Github,
    toHref: (value) => {
      const v = stripScheme(value).replace(/^@/, "");
      return v.includes("github.com")
        ? `https://${v}`
        : `https://github.com/${v.replace(/^\/+/, "")}`;
    },
  },
  portfolio: {
    label: "Portfolio",
    icon: Link2,
    toHref: (value) => `https://${stripScheme(value).replace(/^\/+/, "")}`,
  },
  website: {
    label: "Website",
    icon: Globe,
    toHref: (value) => `https://${stripScheme(value).replace(/^\/+/, "")}`,
  },
};

/**
 * Row of clickable social links shown on a profile (own and others').
 * Renders nothing when there are no links, so existing profiles are untouched.
 * Users may type bare handles (`@you`, `you`) or full URLs — both work.
 */
export function SocialLinks({
  links,
  className,
}: {
  links?: UserProfile["socialLinks"];
  className?: string;
}) {
  if (!links) return null;

  const entries = (Object.keys(PLATFORMS) as (keyof SocialLinksMap)[]).filter(
    (key) => links[key] && links[key]!.trim().length > 0
  );
  if (entries.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {entries.map((key) => {
        const platform = PLATFORMS[key];
        const value = links[key]!;
        const Icon = platform.icon;
        return (
          <a
            key={key}
            href={platform.toHref(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
            title={value}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {platform.label}
          </a>
        );
      })}
    </div>
  );
}