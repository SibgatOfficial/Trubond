"use client";

import * as React from "react";
import { BarChart3, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatType, Poll } from "@/types";

export function PollMessage({
  poll,
  currentUserId,
  roomType,
  roomId,
  messageId,
  onVote,
}: {
  poll: Poll;
  currentUserId: string;
  roomType: ChatType;
  roomId: string;
  messageId: string;
  onVote: (
    roomType: ChatType,
    roomId: string,
    messageId: string,
    optionIndex: number
  ) => Promise<void>;
}) {
  const [voting, setVoting] = React.useState<number | null>(null);
  const options = poll.options ?? [];
  const total = poll.totalVotes ?? options.reduce((s, o) => s + (o.votes || 0), 0);
  const expired = poll.expiresAt ? new Date(poll.expiresAt as string) < new Date() : false;
  const closed = !poll.isActive || expired;

  const handleVote = async (index: number) => {
    if (closed) return;
    setVoting(index);
    try {
      await onVote(roomType, roomId, messageId, index);
    } finally {
      setVoting(null);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <BarChart3 className="h-4 w-4 text-primary" />
        {poll.question}
      </div>
      <div className="space-y-2">
        {options.map((option, index) => {
          const hasVoted = option.voters?.includes(currentUserId);
          const percent = total > 0 ? ((option.votes || 0) / total) * 100 : 0;
          return (
            <button
              key={index}
              type="button"
              disabled={closed || voting !== null}
              onClick={() => handleVote(index)}
              className={cn(
                "relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition",
                hasVoted ? "border-primary" : "hover:bg-accent",
                closed && "cursor-default opacity-90"
              )}
            >
              <div
                className="absolute inset-y-0 left-0 bg-primary/10 transition-all"
                style={{ width: `${percent}%` }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {hasVoted && <Check className="h-3.5 w-3.5 text-primary" />}
                  {option.text || `Option ${index + 1}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {option.votes || 0} · {percent.toFixed(0)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {total} vote{total === 1 ? "" : "s"}
        {closed ? " · Poll closed" : ""}
      </p>
    </div>
  );
}
