"use client";

import * as React from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PresenceAvatar } from "@/components/shared/presence-dot";
import { UserLink } from "@/components/shared/user-link";
import { ReactionButton } from "@/components/shared/reaction-button";
import { FileChip } from "@/components/shared/file-chip";
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
import { deleteNote, incrementNoteDownload } from "@/lib/services/notes";
import { cloudinaryPdfPageUrl, timeAgo, isOwnedBy } from "@/lib/utils";
import type { Note, UserProfile } from "@/types";
import { toast } from "sonner";

export function NoteCard({
  note,
  currentUser,
  upvoted,
  authorOnline = false,
  onToggleUpvote,
  onOpenComments,
  onDeleted,
  onEdit,
}: {
  note: Note;
  currentUser: UserProfile;
  upvoted: boolean;
  authorOnline?: boolean;
  onToggleUpvote: (note: Note) => void;
  onOpenComments: (noteId: string) => void;
  onDeleted: (noteId: string) => void;
  onEdit: (note: Note) => void;
}) {
  const isOwner = isOwnedBy(note.uploaderId, note.uploaderUsername, currentUser);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteNote(note.id);
      onDeleted(note.id);
      toast.success("Note deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete note.");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const handleDownload = () => {
    incrementNoteDownload(note.id).catch(() => undefined);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <UserLink userId={note.uploaderId} stopPropagation={false}>
          <PresenceAvatar
            src={note.uploaderPhoto}
            name={note.uploaderName || note.uploaderUsername}
            online={authorOnline}
            avatarClassName="h-10 w-10"
          />
        </UserLink>

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold leading-tight">{note.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <UserLink userId={note.uploaderId}>
              @{note.uploaderUsername}
            </UserLink>
            {" · "}
            {timeAgo(note.createdAt)}
          </p>
        </div>

        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Note options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(note)}>
                <Pencil /> Edit details
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
        <div className="flex flex-wrap items-center gap-1.5">
          {note.subject ? (
            <Badge variant="secondary">{note.subject}</Badge>
          ) : null}
          {note.semester ? <Badge variant="outline">{note.semester}</Badge> : null}
          {note.branch ? <Badge variant="outline">{note.branch}</Badge> : null}
          {(note.tags ?? []).map((tag) => (
            <Badge key={tag} variant="outline" className="font-normal">
              #{tag}
            </Badge>
          ))}
        </div>

        {note.description ? (
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {note.description}
          </p>
        ) : null}

        {note.files?.length ? (
          <div className="space-y-2">
            {note.files.map((file) => {
              const preview = cloudinaryPdfPageUrl(file.url);
              return (
                <div key={`${file.url}-${file.name}`} className="space-y-1.5">
                  <FileChip file={file} onDownload={handleDownload} />
                  {preview ? (
                    <div className="overflow-hidden rounded-lg border">
                      <div className="flex items-center gap-1.5 border-b bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        <span className="truncate">Preview</span>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={handleDownload}
                          className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Open
                        </a>
                      </div>
                      <img
                        src={preview}
                        alt={`First page preview of ${file.name}`}
                        className="max-h-64 w-full bg-muted/30 object-contain"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="flex items-center gap-1 border-t pt-3 text-sm text-muted-foreground">
          <ReactionButton
            icon={Heart}
            label={upvoted ? "Remove upvote" : "Upvote this note"}
            count={note.upvoteCount ?? 0}
            active={upvoted}
            activeClassName="text-primary hover:text-primary"
            burst="like"
            onActivate={() => onToggleUpvote(note)}
          />
          <ReactionButton
            icon={MessageCircle}
            label="View comments"
            count={note.commentCount ?? 0}
            burst="comment"
            burstOnlyWhenActivating={false}
            onActivate={() => onOpenComments(note.id)}
          />
          <span className="ml-auto flex items-center gap-1.5 pr-2 text-xs">
            <Download className="h-4 w-4" aria-hidden="true" />
            {note.downloadCount ?? 0}
            <span className="sr-only">downloads</span>
          </span>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              The note and its comments are removed from Trubond. Files already
              uploaded to Cloudinary are not deleted.
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
              {busy ? "Deleting…" : "Delete note"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
