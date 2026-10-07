"use client";

import * as React from "react";
import {
  Eye,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PresenceAvatar } from "@/components/shared/presence-dot";
import { SafeImage } from "@/components/shared/safe-image";
import { UserLink } from "@/components/shared/user-link";
import { Button } from "@/components/ui/button";
import { ReactionButton } from "@/components/shared/reaction-button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deletePost, updatePost } from "@/lib/services/posts";
import { timeAgo, isOwnedBy } from "@/lib/utils";
import type { Post, UserProfile } from "@/types";
import { toast } from "sonner";

export function PostCard({
  post,
  currentUser,
  liked,
  onToggleLike,
  onOpenComments,
  onDeleted,
  onView,
  authorOnline = false,
}: {
  post: Post;
  currentUser: UserProfile;
  liked: boolean;
  onToggleLike: (post: Post) => void;
  onOpenComments: (postId: string) => void;
  onDeleted: (postId: string) => void;
  /** Called once, when the post is actually scrolled into view. */
  onView?: (post: Post) => void;
  /** Whether the author is currently online, from the presence subscription. */
  authorOnline?: boolean;
}) {
  // Matches on uid OR username: posts written before the phone→Google auth
  // migration still carry the author's old uid.
  const isOwner = isOwnedBy(post.authorId, post.authorUsername, currentUser);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(post.text);
  const [busy, setBusy] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const countedRef = React.useRef(false);

  // Count an impression only when half the card is genuinely on screen.
  // `incrementViewCount` throttles per post per day on top of this.
  React.useEffect(() => {
    const node = cardRef.current;
    if (!node || !onView || countedRef.current) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !countedRef.current) {
            countedRef.current = true;
            onView(post);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [post, onView]);

  // The dialog is controlled by state rather than nested in the menu item:
  // a Radix dropdown unmounts its content on select, which would tear the
  // dialog down with it.
  const handleDelete = async () => {
    const targetId = post.id;
    const authorId = post.authorId;
    // Close FIRST so Radix runs exit cleanup before the parent removes
    // this card; defer onDeleted one frame so the animation can start.
    setConfirmOpen(false);
    setBusy(true);
    try {
      await deletePost(targetId, authorId);
      // Defer past the 200ms Radix exit animation so body cleanup finishes.
      window.setTimeout(() => onDeleted(targetId), 250);
      toast.success("Post deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete post.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await updatePost(post.id, draft.trim());
      setEditing(false);
      toast.success("Post updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update post.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card ref={cardRef} className="overflow-hidden">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <UserLink userId={post.authorId} stopPropagation={false}>
          <PresenceAvatar
            src={post.authorPhoto}
            name={post.authorName || post.authorUsername}
            online={authorOnline ?? false}
            avatarClassName="h-10 w-10"
          />
        </UserLink>
        <div className="min-w-0 flex-1">
          <UserLink
            userId={post.authorId}
            className="block truncate text-sm font-semibold text-foreground"
          >
            {post.authorName || post.authorUsername}
          </UserLink>
          <p className="text-xs text-muted-foreground">
            @{post.authorUsername} · {timeAgo(post.createdAt)}
          </p>
        </div>

        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Post options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setDraft(post.text);
                  setEditing(true);
                }}
              >
                <Pencil /> Edit post
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirmOpen(true)}
                disabled={busy}
              >
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Edit post text"
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} disabled={busy}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          post.text && (
            <p className="whitespace-pre-wrap break-words text-sm">
              {post.text}
            </p>
          )
        )}

        {post.imageUrl && (
          <div className="relative overflow-hidden rounded-lg border">
            <SafeImage
              src={post.imageUrl}
              alt={`Attachment shared by ${post.authorName || post.authorUsername}`}
              className="max-h-[520px] w-full object-contain"
              wrapperClassName="min-h-40 w-full"
              fallbackLabel="This image is no longer available"
            />
          </div>
        )}

        <div className="flex items-center gap-1 border-t pt-3 text-sm text-muted-foreground">
          <ReactionButton
            icon={Heart}
            label={liked ? "Unlike this post" : "Like this post"}
            count={post.likeCount ?? 0}
            active={liked}
            activeClassName="text-rose-500 hover:text-rose-600"
            burst="like"
            onActivate={() => onToggleLike(post)}
          />
          <ReactionButton
            icon={MessageCircle}
            label="View comments"
            count={post.commentCount ?? 0}
            burst="comment"
            burstOnlyWhenActivating={false}
            onActivate={() => onOpenComments(post.id)}
          />
          <span className="ml-auto flex items-center gap-1.5 pr-2 text-xs">
            <Eye className="h-4 w-4" aria-hidden="true" />
            {post.viewCount ?? 0}
            <span className="sr-only">views</span>
          </span>
        </div>
      </CardContent>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && busy) return;
          setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the post and its likes and comments. It
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Deleting…" : "Delete post"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
