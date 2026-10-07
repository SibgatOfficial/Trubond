"use client";

import * as React from "react";
import {
  Download,
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
import { timeAgo, isOwnedBy } from "@/lib/utils";
import { PdfPreviewDialog } from "@/components/shared/pdf-preview-dialog";
import type { Note, NoteFile, UserProfile } from "@/types";
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
  /** Which attached PDF the tap-to-preview dialog is showing, if any. */
  const [previewFile, setPreviewFile] = React.useState<NoteFile | null>(null);

  const handleDelete = async () => {
    const targetId = note.id;
    // Close FIRST so Radix runs exit cleanup before the parent removes
    // this card; defer onDeleted past the 200ms exit animation.
    setConfirmOpen(false);
    setBusy(true);
    try {
      await deleteNote(targetId);
      window.setTimeout(() => onDeleted(targetId), 250);
      toast.success("Note deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete note.");
    } finally {
      setBusy(false);
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
          {/* Uploader's real name is the primary line; old notes without
              `uploaderName` fall back to the handle. The note TITLE is
              deliberately not in the header — it confused people into thinking
              it was the author's name — it renders as the body's first line. */}
          <h3 className="truncate font-semibold leading-tight">
            <UserLink userId={note.uploaderId}>
              {note.uploaderName || note.uploaderUsername}
            </UserLink>
          </h3>
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
            {/* non-modal: a modal menu would set `body { pointer-events: none }`,
                and the delete dialog opened from it would inherit + restore that
                stale lock — freezing the page until reload. */}
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(note)}>
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
        {/* The note's own title, restyled as content rather than as the
            card header (which belongs to the author). */}
        <h4 className="text-sm font-semibold leading-snug text-foreground">
          {note.title}
        </h4>
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
            {note.files.map((file) => (
              <FileChip
                key={`${file.url}-${file.name}`}
                file={file}
                onDownload={handleDownload}
                onPreview={
                  file.type === "application/pdf" || /\.pdf$/i.test(file.name)
                    ? () => setPreviewFile(file)
                    : undefined
                }
              />
            ))}
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

        <PdfPreviewDialog
          file={previewFile}
          open={previewFile !== null}
          onOpenChange={(next) => {
            if (!next) setPreviewFile(null);
          }}
          onOpenFile={handleDownload}
        />
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
