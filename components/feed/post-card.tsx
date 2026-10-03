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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deletePost, updatePost } from "@/lib/services/posts";
import { DEFAULT_AVATAR, initials, timeAgo } from "@/lib/utils";
import type { Post, UserProfile } from "@/types";
import { toast } from "sonner";

export function PostCard({
  post,
  currentUser,
  liked,
  onToggleLike,
  onOpenComments,
  onDeleted,
}: {
  post: Post;
  currentUser: UserProfile;
  liked: boolean;
  onToggleLike: (post: Post) => void;
  onOpenComments: (postId: string) => void;
  onDeleted: (postId: string) => void;
}) {
  const isOwner = post.authorId === currentUser.id;
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(post.text);
  const [busy, setBusy] = React.useState(false);

  const handleDelete = async () => {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    setBusy(true);
    try {
      await deletePost(post.id, post.authorId);
      onDeleted(post.id);
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
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <Avatar className="h-10 w-10">
          <AvatarImage
            src={post.authorPhoto || DEFAULT_AVATAR}
            alt={post.authorName || post.authorUsername}
          />
          <AvatarFallback>
            {initials(post.authorName || post.authorUsername)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {post.authorName || post.authorUsername}
          </p>
          <p className="text-xs text-muted-foreground">
            @{post.authorUsername} · {timeAgo(post.createdAt)}
          </p>
        </div>

        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
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
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDelete}
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
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt="Post attachment"
              className="max-h-[420px] w-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        <div className="flex items-center gap-1 border-t pt-3 text-sm text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            className={liked ? "text-rose-500 hover:text-rose-600" : ""}
            onClick={() => onToggleLike(post)}
          >
            <Heart className={liked ? "fill-current" : ""} />
            {post.likeCount ?? 0}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenComments(post.id)}
          >
            <MessageCircle />
            {post.commentCount ?? 0}
          </Button>
          <span className="ml-auto flex items-center gap-1.5 pr-2 text-xs">
            <Eye className="h-4 w-4" />
            {post.viewCount ?? 0}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
