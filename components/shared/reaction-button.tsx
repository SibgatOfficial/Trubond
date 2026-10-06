"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  AnimationBurst,
  type LottieAnimationName,
} from "@/components/ui/lottie-animation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * A like/comment/send style button that plays a Lottie burst when activated.
 *
 * The burst element sits *outside* `Button` on purpose: the button's base class
 * applies `[&_svg]:size-4` to every descendant svg, which would squash the
 * animation to 16px. Positioning it as a sibling inside a relative wrapper also
 * keeps it centred on the icon rather than the whole button.
 */
export function ReactionButton({
  icon: Icon,
  label,
  count,
  active = false,
  /** Extra classes applied to the button while `active`. */
  activeClassName,
  /** Lottie to play. */
  burst,
  /** Only burst when turning the reaction *on* (likes should not pop on unlike). */
  burstOnlyWhenActivating = true,
  onActivate,
  className,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  active?: boolean;
  activeClassName?: string;
  burst: LottieAnimationName;
  burstOnlyWhenActivating?: boolean;
  onActivate: () => void;
  className?: string;
}) {
  const [trigger, setTrigger] = React.useState(0);

  const handleClick = () => {
    if (!(burstOnlyWhenActivating && active)) {
      setTrigger((n) => n + 1);
    }
    onActivate();
  };

  return (
    <div className="relative inline-flex">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        aria-pressed={active}
        aria-label={label}
        className={cn(active && activeClassName, className)}
      >
        <Icon className={cn(active && "fill-current")} aria-hidden="true" />
        {count}
      </Button>
      <AnimationBurst
        name={burst}
        trigger={trigger}
        className="pointer-events-none absolute left-3 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2"
      />
    </div>
  );
}
