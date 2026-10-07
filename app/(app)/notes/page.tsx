"use client";

import * as React from "react";
import { FileText, Plus, Search } from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { NoteCard } from "@/components/notes/note-card";
import { CreateNoteDialog } from "@/components/notes/create-note-dialog";
import { NoteCommentsDialog } from "@/components/notes/note-comments-dialog";
import { EditNoteDialog } from "@/components/notes/edit-note-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  collectSubjects,
  fetchOlderNotes,
  filterNotes,
  getUpvotedNoteIds,
  subscribeToNotes,
  toggleNoteUpvote,
  type NoteSort,
} from "@/lib/services/notes";
import { notifySafely } from "@/lib/services/notifications";
import { LoadMore } from "@/components/shared/load-more";
import { usePagedList } from "@/hooks/use-paged-list";
import { BRANCHES, SEMESTERS } from "@/lib/constants";
import { usePresenceMap } from "@/hooks/use-presence";
import type { Note } from "@/types";
import { toast } from "sonner";

const ALL = "all";

const SORT_OPTIONS: { value: NoteSort; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "top", label: "Most upvoted" },
  { value: "downloads", label: "Most downloaded" },
];

export default function NotesPage() {
  const { profile } = useAuth();
  const {
    items: notes,
    setItems: setNotes,
    hasMore,
    loadingMore,
    applyFirstPage,
    loadMore,
  } = usePagedList<Note>(fetchOlderNotes, () =>
    toast.error("Failed to load more notes.")
  );
  const [upvoted, setUpvoted] = React.useState<Set<string>>(new Set());
  /**
   * Note ids whose upvote state the server has already answered for.
   *
   * The resolver below runs again whenever the note list grows (first page,
   * load-more), but it must never re-query ids we already know — otherwise a
   * slow collection-group response could overwrite an optimistic toggle.
   */
  const upvoteCheckedRef = React.useRef<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [subject, setSubject] = React.useState(ALL);
  const [branch, setBranch] = React.useState(ALL);
  const [semester, setSemester] = React.useState(ALL);
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<NoteSort>("recent");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [commentsNoteId, setCommentsNoteId] = React.useState<string | null>(null);
  const [editNote, setEditNote] = React.useState<Note | null>(null);

  React.useEffect(() => {
    const unsubscribe = subscribeToNotes(
      (page) => {
        applyFirstPage(page);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        toast.error("Failed to load notes.");
      }
    );
    return () => unsubscribe();
  }, [applyFirstPage]);

  /**
   * Which of the loaded notes this user has upvoted.
   *
   * Passing `noteIds` lets the service probe legacy upvote docs (written
   * before the `userId` field existed) directly instead of skipping them.
   * Ids are claimed BEFORE the async call so a re-run (e.g. load-more, or an
   * optimistic toggle rewriting `notes`) never re-checks or reverts them —
   * results are only ever unioned in, never replaced.
   */
  const resolveUpvotes = React.useCallback(
    (noteIds: string[]) => {
      if (!profile || noteIds.length === 0) return;
      const pending = noteIds.filter((id) => !upvoteCheckedRef.current.has(id));
      if (pending.length === 0) return;
      pending.forEach((id) => upvoteCheckedRef.current.add(id));
      getUpvotedNoteIds(profile.id, pending)
        .then((serverSet) => {
          setUpvoted((prev) => {
            const next = new Set(prev);
            serverSet.forEach((id) => next.add(id));
            return next;
          });
        })
        .catch((error) => console.error("Failed to resolve upvotes:", error));
    },
    [profile]
  );

  React.useEffect(() => {
    resolveUpvotes(notes.map((note) => note.id));
  }, [notes, resolveUpvotes]);

  const subjects = React.useMemo(() => collectSubjects(notes), [notes]);

  const visible = React.useMemo(
    () =>
      filterNotes(
        notes,
        {
          subject: subject === ALL ? undefined : subject,
          branch: branch === ALL ? undefined : branch,
          semester: semester === ALL ? undefined : semester,
          search,
        },
        sort
      ),
    [notes, subject, branch, semester, search, sort]
  );

  const presence = usePresenceMap(visible.map((note) => note.uploaderId));

  const handleToggleUpvote = async (note: Note) => {
    if (!profile) return;
    const isUpvoted = upvoted.has(note.id);

    // Optimistic, so the count responds instantly.
    setUpvoted((prev) => {
      const next = new Set(prev);
      if (isUpvoted) next.delete(note.id);
      else next.add(note.id);
      return next;
    });
    setNotes((prev) =>
      prev.map((item) =>
        item.id === note.id
          ? {
              ...item,
              upvoteCount: Math.max(0, (item.upvoteCount ?? 0) + (isUpvoted ? -1 : 1)),
            }
          : item
      )
    );

    try {
      const nowUpvoted = await toggleNoteUpvote(note.id, profile.id);
      if (nowUpvoted) {
        notifySafely({
          recipientId: note.uploaderId,
          actor: profile,
          type: "note_upvote",
          targetId: note.id,
          href: "/notes",
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to update upvote.");
    }
  };

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Notes & Assignments"
        description="Share and find study material from your campus."
        action={
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Share Notes
          </Button>
        }
      />

      <div className="space-y-3 rounded-xl border bg-card p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, subjects, tags…"
            aria-label="Search notes"
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger aria-label="Filter by subject">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All subjects</SelectItem>
              {subjects.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger aria-label="Filter by semester">
              <SelectValue placeholder="Semester" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All semesters</SelectItem>
              {SEMESTERS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value} semester
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger aria-label="Filter by branch">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All branches</SelectItem>
              {BRANCHES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(value) => setSort(value as NoteSort)}>
            <SelectTrigger aria-label="Sort notes">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          animation="empty"
          icon={FileText}
          title={notes.length === 0 ? "No notes yet" : "No notes match your filters"}
          description={
            notes.length === 0
              ? "Be the first to share lecture notes or an assignment with your campus."
              : "Try clearing the search or picking a different subject."
          }
        />
      ) : (
        <div className="space-y-4">
          {visible.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              currentUser={profile}
              upvoted={upvoted.has(note.id)}
              authorOnline={presence.get(note.uploaderId) ?? false}
              onToggleUpvote={handleToggleUpvote}
              onOpenComments={setCommentsNoteId}
              onDeleted={(id) =>
                setNotes((prev) => prev.filter((item) => item.id !== id))
              }
              onEdit={setEditNote}
            />
          ))}
        </div>
      )}

      <LoadMore
        hasMore={hasMore}
        loading={loadingMore}
        onClick={loadMore}
        label="Load more notes"
      />

      <CreateNoteDialog
        currentUser={profile}
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingNotes={notes}
      />
      <NoteCommentsDialog
        noteId={commentsNoteId}
        open={commentsNoteId !== null}
        onOpenChange={(open) => {
          if (!open) setCommentsNoteId(null);
        }}
        currentUser={profile}
        noteUploaderId={
          notes.find((note) => note.id === commentsNoteId)?.uploaderId ?? null
        }
      />

      <EditNoteDialog
        note={editNote}
        open={editNote !== null}
        onOpenChange={(open) => {
          if (!open) setEditNote(null);
        }}
        onSaved={(patch) =>
          setNotes((prev) =>
            prev.map((item) =>
              item.id === editNote?.id ? { ...item, ...patch } : item
            )
          )
        }
      />
    </div>
  );
}
