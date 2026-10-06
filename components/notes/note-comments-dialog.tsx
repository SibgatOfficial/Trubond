"use client";

import * as React from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
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
  addNoteComment,
  deleteNoteComment,
  subscribeToNoteComments,
} from "@/lib/services/notes";
import { DEFAULT_AVATAR, initials, isOwnedBy, timeAgo } from "@/lib/utils";
import type { NoteComment, UserProfile } from "@/types";
import { toast } from "sonner";

export function NoteCommentsDialog({
  noteId,
  open,
  onOpenChange,
  currentUser,
}: {
  noteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: UserProfile;
}) {
  const [comments, setComments] = React.useState<NoteComment[]>([]);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!open || !noteId) return;
    const unsubscribe = subscribeToNoteComments(noteId, setComments);
    return () => unsubscribe();
  }, [open, noteId]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!noteId || !text.trim()) return;
    setSending(true);
    try {
      await addNoteComment(noteId, currentUser, text);
      setText("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to add comment.");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!noteId) return;
    try {
      await deleteNoteComment(noteId, commentId);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete comment.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Discussion</DialogTitle>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto scrollbar-thin pr-1">
          {comments.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No comments yet. Ask a question about these notes!
            </p>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={comment.authorPhoto || DEFAULT_AVATAR}
                  alt={comment.authorUsername}
                />
                <AvatarFallback>
                  {initials(comment.authorUsername)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="rounded-lg bg-muted px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      @{comment.authorUsername}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(comment.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
                    {comment.text}
                  </p>
                </div>
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
          ))}
        </div>

        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 border-t pt-4"
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment…"
            aria-label="Write a comment"
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Post comment"
            disabled={sending || !text.trim()}
          >
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
