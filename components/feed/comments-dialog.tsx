"use client";

import * as React from "react";
import { Loader2, Reply, Send, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addComment,
  deleteComment,
  subscribeToComments,
} from "@/lib/services/posts";
import { notifySafely } from "@/lib/services/notifications";
import { DEFAULT_AVATAR, initials, isOwnedBy, timeAgo } from "@/lib/utils";
import { UserLink } from "@/components/shared/user-link";
import type { Comment, UserProfile } from "@/types";
import { toast } from "sonner";

export function CommentsDialog({
  postId,
  open,
  onOpenChange,
  currentUser,
  postAuthorId,
}: {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: UserProfile;
  /** Author of the post being commented on, so they can be notified. */
  postAuthorId?: string | null;
}) {
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [replyTarget, setReplyTarget] = React.useState<Comment | null>(null);

  /** One level of threading: top-level comments plus their direct replies. */
  const topLevel = React.useMemo(
    () => comments.filter((comment) => !comment.parentId),
    [comments]
  );
  const repliesByParent = React.useMemo(() => {
    const map = new Map<string, Comment[]>();
    comments.forEach((comment) => {
      if (!comment.parentId) return;
      const list = map.get(comment.parentId) ?? [];
      list.push(comment);
      map.set(comment.parentId, list);
    });
    return map;
  }, [comments]);

  React.useEffect(() => {
    if (!open || !postId) return;
    const unsubscribe = subscribeToComments(postId, setComments);
    return () => unsubscribe();
  }, [open, postId]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!postId || !text.trim()) return;
    setSending(true);
    try {
      const body = text.trim();
      await addComment(postId, currentUser, body, replyTarget?.id ?? null);
      if (postAuthorId) {
        notifySafely({
          recipientId: postAuthorId,
          actor: currentUser,
          type: "comment",
          targetId: postId,
          href: "/home",
          text: body.length > 60 ? `${body.slice(0, 60)}…` : body,
        });
      }
      setText("");
      setReplyTarget(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to add comment.");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!postId) return;
    try {
      await deleteComment(postId, commentId);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete comment.");
    }
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <div className="flex gap-3">
      <UserLink userId={comment.authorId} stopPropagation={false}>
        <Avatar className="h-8 w-8">
          <AvatarImage
            src={comment.authorPhoto || DEFAULT_AVATAR}
            alt={comment.authorUsername}
          />
          <AvatarFallback>{initials(comment.authorUsername)}</AvatarFallback>
        </Avatar>
      </UserLink>
      <div className="min-w-0 flex-1">
        <div className="rounded-lg bg-muted px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <UserLink
              userId={comment.authorId}
              className="text-sm font-semibold text-foreground"
            >
              @{comment.authorUsername}
            </UserLink>
            <span className="text-xs text-muted-foreground">
              {timeAgo(comment.createdAt)}
            </span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
            {comment.text}
          </p>
        </div>
        {/* One level of nesting only — replies to replies attach to the same
            thread, which keeps the dialog readable on a phone. */}
        {!isReply && (
          <button
            type="button"
            onClick={() => setReplyTarget(comment)}
            className="mt-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Reply
          </button>
        )}
      </div>
      {isOwnedBy(comment.authorId, comment.authorUsername, currentUser) && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => handleDelete(comment.id)}
          aria-label="Delete comment"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto scrollbar-thin pr-1">
          {comments.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No comments yet. Start the conversation!
            </p>
          )}
          {topLevel.map((comment) => (
            <div key={comment.id} className="space-y-2">
              {renderComment(comment)}
              {(repliesByParent.get(comment.id) ?? []).length > 0 && (
                <div className="ml-11 space-y-2 border-l pl-3">
                  {(repliesByParent.get(comment.id) ?? []).map((reply) =>
                    renderComment(reply, true)
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {replyTarget && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
            <Reply className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">
              Replying to @{replyTarget.authorUsername}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setReplyTarget(null)}
              aria-label="Cancel reply"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-2 border-t pt-4">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment..."
          />
          <Button type="submit" size="icon" disabled={sending || !text.trim()}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
