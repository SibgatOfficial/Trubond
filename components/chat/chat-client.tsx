"use client";

import * as React from "react";
import {
  BarChart3,
  Check,
  FileText,
  Hash,
  Loader2,
  Menu,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Reply,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { PresenceAvatar } from "@/components/shared/presence-dot";
import { UserLink } from "@/components/shared/user-link";
import { usePresenceMap } from "@/hooks/use-presence";
import { PollMessage } from "@/components/chat/poll-message";
import { CreatePollDialog } from "@/components/chat/create-poll-dialog";
import { ChatFileMessage } from "@/components/chat/chat-file-message";
import { AnimationBurst } from "@/components/ui/lottie-animation";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  deleteMessage,
  editMessage,
  fetchOlderMessages,
  getChatRooms,
  sendFileMessage,
  sendTextMessage,
  subscribeToMessages,
  votePoll,
} from "@/lib/services/chat";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import type { MessageReply } from "@/types";
import { uploadChatFile } from "@/lib/services/storage";
import {
  acceptAttribute,
  checkUpload,
  CHAT_UPLOAD_POLICY,
} from "@/lib/upload-policy";
import { isOwnedBy, timeAgo } from "@/lib/utils";
import type { ChatMessage, ChatRoom, UserProfile } from "@/types";
import { toast } from "sonner";

export function ChatClient({ currentUser }: { currentUser: UserProfile }) {
  const [rooms, setRooms] = React.useState<ChatRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = React.useState(true);
  const [activeRoom, setActiveRoom] = React.useState<ChatRoom | null>(null);
  const [channelsOpen, setChannelsOpen] = React.useState(false);
  const [sendTrigger, setSendTrigger] = React.useState(0);
  const [uploadPercent, setUploadPercent] = React.useState<number | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [messagesCursor, setMessagesCursor] =
    React.useState<QueryDocumentSnapshot | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = React.useState(false);
  const [loadingEarlier, setLoadingEarlier] = React.useState(false);
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState("");
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [deletingMessage, setDeletingMessage] = React.useState(false);
  const [replyTarget, setReplyTarget] = React.useState<MessageReply | null>(null);
  /** Staged attachment: picked but NOT sent until the user hits Send. */
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const messageRefs = React.useRef(new Map<string, HTMLDivElement>());
  const [dmStatus, setDmStatus] = React.useState<string | null>(null);

  const scrollToMessage = (messageId: string) => {
    const node = messageRefs.current.get(messageId);
    if (!node) {
      toast.error("That message isn't loaded — load earlier messages first.");
      return;
    }
    node.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  /** Set before prepending history so the auto-scroll effect stands down. */
  const skipAutoScrollRef = React.useRef(false);
  /**
   * The message scroll container.
   *
   * Deliberately a plain `overflow-y-auto` div rather than Radix's ScrollArea:
   * Radix wraps its children in `<div style="display: table">`, whose height is
   * content-based, so a child's `min-height: 100%` resolves against the wrapper
   * instead of the viewport. That made the bottom-alignment below a no-op and
   * left the messages pinned to the top.
   */
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = React.useState(false);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [pollOpen, setPollOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    getChatRooms(currentUser)
      .then((next) => {
        setRooms(next);
        setActiveRoom((prev) => prev ?? next[0] ?? null);
      })
      .catch(() => toast.error("Failed to load chat rooms."))
      .finally(() => setRoomsLoading(false));
  }, [currentUser]);

  React.useEffect(() => {
    if (!activeRoom) return;
    setMessagesLoading(true);
    setMessagesCursor(null);
    setHasMoreMessages(false);
    setDmStatus(null);
    const unsubscribe = subscribeToMessages(
      activeRoom.type,
      activeRoom.id,
      (next, cursor, hasMore) => {
        setMessages(next);
        setMessagesCursor(cursor);
        setHasMoreMessages(hasMore);
        setMessagesLoading(false);
      },
      () => {
        setMessagesLoading(false);
        toast.error("Failed to load messages.");
      }
    );
    // DM threads carry a pending/accepted/blocked status — recipients must
    // accept before the conversation continues.
    if (activeRoom.type === "dm") {
      import("@/lib/services/chat").then(({ getDmThread }) => {
        getDmThread(activeRoom.id)
          .then((thread) => setDmStatus(thread?.status ?? null))
          .catch(() => setDmStatus(null));
      });
    }
    return () => unsubscribe();
  }, [activeRoom]);

  React.useEffect(() => {
    // Prepending older history must not yank the reader to the bottom.
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLoadEarlier = async () => {
    if (!activeRoom || !messagesCursor || loadingEarlier) return;

    const scroller = scrollRef.current;
    const previousHeight = scroller?.scrollHeight ?? 0;

    setLoadingEarlier(true);
    skipAutoScrollRef.current = true;
    try {
      const page = await fetchOlderMessages(
        activeRoom.type,
        activeRoom.id,
        messagesCursor
      );
      setMessages((prev) => [...page.messages, ...prev]);
      setMessagesCursor(page.cursor);
      setHasMoreMessages(page.hasMore);
      // Restore the visual position after the content grows above the viewport.
      requestAnimationFrame(() => {
        if (scroller) {
          scroller.scrollTop = scroller.scrollHeight - previousHeight;
        }
      });
    } catch (error) {
      console.error(error);
      skipAutoScrollRef.current = false;
      toast.error("Failed to load earlier messages.");
    } finally {
      setLoadingEarlier(false);
    }
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeRoom || sending) return;
    const value = text.trim();
    if (!value && !pendingFile) return;
    const quoted = replyTarget;
    const fileToSend = pendingFile;
    setSendTrigger((n) => n + 1);
    setText("");
    setPendingFile(null);
    setSending(true);
    setReplyTarget(null);
    try {
      if (fileToSend) {
        setUploadPercent(0);
        const url = await uploadChatFile(
          activeRoom.type,
          activeRoom.id,
          fileToSend,
          setUploadPercent
        );
        await sendFileMessage(
          activeRoom.type,
          activeRoom.id,
          currentUser,
          {
            url,
            name: fileToSend.name,
            size: fileToSend.size,
            type: fileToSend.type,
          },
          quoted,
          value || undefined
        );
      } else {
        await sendTextMessage(
          activeRoom.type,
          activeRoom.id,
          currentUser,
          value,
          quoted
        );
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send message."
      );
      setText(value);
      setPendingFile(fileToSend);
      setReplyTarget(quoted);
    } finally {
      setSending(false);
      setUploadPercent(null);
    }
  };

  /**
   * Stage a file — never uploads here. User adds optional caption, then Send
   * uploads + posts together.
   */
  const handleFile = (file: File) => {
    // Checked here for instant feedback; `uploadChatFile` enforces it again.
    const check = checkUpload(file, CHAT_UPLOAD_POLICY);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    setPendingFile(file);
  };

  const handleEditSave = async (message: ChatMessage) => {
    if (!activeRoom || !editDraft.trim()) return;
    setSavingEdit(true);
    try {
      await editMessage(activeRoom.type, activeRoom.id, message.id, editDraft);
      setEditingMessageId(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to edit the message.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!activeRoom || !confirmDeleteId) return;
    setDeletingMessage(true);
    try {
      await deleteMessage(activeRoom.type, activeRoom.id, confirmDeleteId);
      setConfirmDeleteId(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete the message.");
    } finally {
      setDeletingMessage(false);
    }
  };

  const handleVote = async (
    roomType: ChatRoom["type"],
    roomId: string,
    messageId: string,
    optionIndex: number
  ) => {
    try {
      await votePoll(roomType, roomId, messageId, optionIndex, currentUser.id);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to vote.");
    }
  };

  /**
   * Presence for the people who have posted in this room.
   *
   * Scoped to loaded senders rather than "everyone in the room" — there is no
   * membership document to read, and this keeps the subscription well inside
   * the 30-id cap.
   */
  const senderIds = React.useMemo(
    () => messages.map((message) => message.senderId),
    [messages]
  );
  const presence = usePresenceMap(senderIds);

  const onlineCount = React.useMemo(() => {
    const unique = new Set(senderIds);
    let count = 0;
    unique.forEach((id) => {
      if (presence.get(id)) count += 1;
    });
    return count;
  }, [senderIds, presence]);

  const renderMessage = (message: ChatMessage) => {
    // Matches uid OR username. Messages sent before the phone→Google auth
    // migration carry the sender's OLD uid, which is why an own-message check on
    // uid alone rendered the user's own history on the wrong side — most visible
    // in the global chat, which holds the oldest messages.
    const isOwn = isOwnedBy(
      message.senderId,
      message.senderUsername,
      currentUser
    );
    const type = message.type ?? "text";

    return (
      <div
        key={message.id}
        ref={(node) => {
          if (node) messageRefs.current.set(message.id, node);
          else messageRefs.current.delete(message.id);
        }}
        className={`flex gap-2 scroll-mt-20 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      >
        {!isOwn && (
          <UserLink userId={message.senderId} stopPropagation={false}>
            <PresenceAvatar
              src={message.senderPhoto}
              name={message.senderUsername}
              online={presence.get(message.senderId) ?? false}
              avatarClassName="h-8 w-8"
            />
          </UserLink>
        )}

        <div
          className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
            isOwn
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm bg-muted text-foreground"
          }`}
        >
          {!isOwn && (
            <p className="mb-0.5 text-xs font-semibold">
              <UserLink
                userId={message.senderId}
                className="opacity-80 hover:opacity-100"
              >
                @{message.senderUsername}
              </UserLink>
            </p>
          )}

          {message.replyTo ? (
            <button
              type="button"
              onClick={() => scrollToMessage(message.replyTo!.id)}
              title="Jump to quoted message"
              className={`mb-1.5 block w-full rounded-md border-l-2 px-2 py-1 text-left text-xs transition-opacity hover:opacity-80 ${
                isOwn
                  ? "border-primary-foreground/40 bg-primary-foreground/10"
                  : "border-primary/50 bg-background/40"
              }`}
            >
              <span className="block font-semibold opacity-80">
                @{message.replyTo.senderUsername}
              </span>
              <span className="line-clamp-2 block opacity-70">{message.replyTo.text}</span>
            </button>
          ) : null}

          {type === "poll" && message.poll ? (
            <div className="text-foreground">
              <PollMessage
                poll={message.poll}
                currentUserId={currentUser.id}
                roomType={activeRoom!.type}
                roomId={activeRoom!.id}
                messageId={message.id}
                onVote={handleVote}
              />
            </div>
          ) : type === "file" && message.fileUrl ? (
            <ChatFileMessage
              url={message.fileUrl}
              name={message.fileName ?? "Attachment"}
              size={message.fileSize}
              type={message.fileType}
            />
          ) : editingMessageId === message.id ? (
            <div className="space-y-2">
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                aria-label="Edit message"
                rows={2}
                className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 gap-1"
                  onClick={() => handleEditSave(message)}
                  disabled={savingEdit || !editDraft.trim()}
                >
                  {savingEdit ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() => setEditingMessageId(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          )}

          <div className="mt-1 flex items-center justify-end gap-1.5">
            {message.editedAt ? (
              <span
                className={`text-[10px] italic ${
                  isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
                }`}
              >
                edited
              </span>
            ) : null}
            <span
              className={`text-[10px] ${
                isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}
            >
              {timeAgo(message.createdAt)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
                  aria-label="Message options"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    setReplyTarget({
                      id: message.id,
                      senderUsername: message.senderUsername,
                      text: message.text || message.fileName || "Attachment",
                    })
                  }
                >
                  <Reply /> Reply
                </DropdownMenuItem>
                {isOwn && type === "text" ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingMessageId(message.id);
                        setEditDraft(message.text ?? "");
                      }}
                    >
                      <Pencil /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => setConfirmDeleteId(message.id)}
                    >
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );
  };

  // Shared by the desktop sidebar and the mobile sheet, so the two can't drift.
  const roomList = (
    <div className="p-2">
      {roomsLoading ? (
        <div className="space-y-2 p-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        rooms.map((room) => {
          const isActive =
            activeRoom?.id === room.id && activeRoom?.type === room.type;
          return (
            <button
              key={`${room.type}-${room.id}`}
              type="button"
              onClick={() => {
                setActiveRoom(room);
                setChannelsOpen(false);
              }}
              aria-current={isActive ? "true" : undefined}
              className={`mb-1 flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition-colors ${
                isActive ? "bg-primary/10 text-primary" : "hover:bg-accent"
              }`}
            >
              <span className="truncate text-sm font-medium">{room.name}</span>
              {room.subtitle && (
                <span className="text-xs text-muted-foreground">
                  {room.subtitle}
                </span>
              )}
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <div className="mx-auto flex h-[calc(100dvh-9.5rem)] max-w-4xl gap-4 md:h-[calc(100dvh-7rem)] min-h-[480px]">
      <aside className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-xl border bg-card md:flex">
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
          <Hash className="h-4 w-4 text-primary" />
          <span className="font-semibold">Channels</span>
        </div>
        {/* Plain scroller, not Radix ScrollArea: Radix wraps children in a
            `display: table` div, which breaks any height-based layout inside. */}
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {roomList}
        </div>
      </aside>

      <section
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card"
        onDragOver={(event) => {
          event.preventDefault();
          if (!dragActive) setDragActive(true);
        }}
        onDragLeave={(event) => {
          // Only clear when leaving the panel itself, otherwise the overlay
          // flickers as the pointer crosses child elements.
          if (event.currentTarget === event.target) setDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          const file = event.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        {dragActive && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/85 text-sm font-medium text-primary">
            Drop a file to attach
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
          {/* The channel list is desktop-only otherwise, which left mobile with
              no way to switch rooms. */}
          <Sheet open={channelsOpen} onOpenChange={setChannelsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Browse channels"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b px-4 py-3">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <Hash className="h-4 w-4 text-primary" /> Channels
                </SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100%-3.5rem)]">{roomList}</ScrollArea>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              {activeRoom?.name ?? "Select a chat"}
            </p>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              {activeRoom?.subtitle ? <span>{activeRoom.subtitle}</span> : null}
              {onlineCount > 0 ? (
                <>
                  {activeRoom?.subtitle ? <span>·</span> : null}
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {onlineCount} online
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        {/* The scroller is absolutely positioned inside a `flex-1` box, so its
            height comes from the panel and never from its own content. That
            removes every flexbox sizing quirk that could collapse it — which is
            what pushed the composer to the top of the panel. */}
        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            className="absolute inset-0 overflow-y-auto scrollbar-thin"
          >
            <div className="flex min-h-full flex-col p-4">
              <div className="mt-auto flex flex-col gap-4">
            {hasMoreMessages && (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadEarlier}
                  disabled={loadingEarlier}
                  className="gap-2 text-xs text-muted-foreground"
                >
                  {loadingEarlier ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {loadingEarlier ? "Loading…" : "Load earlier messages"}
                </Button>
              </div>
            )}
            {!activeRoom ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Pick a channel to start chatting.
              </p>
            ) : messagesLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-2/3" />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No messages yet. Start the conversation!
              </p>
            ) : (
              messages.map(renderMessage)
            )}
              <div ref={bottomRef} />
              </div>
            </div>
          </div>
        </div>

        {activeRoom && replyTarget && (
          <div className="flex shrink-0 items-center gap-2 border-t bg-muted/50 px-3 py-2 text-xs">
            <Reply className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                Replying to @{replyTarget.senderUsername}
              </p>
              <p className="truncate text-muted-foreground">
                {replyTarget.text}
              </p>
            </div>
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

        {activeRoom && pendingFile && (
          <div className="flex shrink-0 items-center gap-2 border-t bg-muted/50 px-3 py-2 text-xs">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{pendingFile.name}</p>
              <p className="text-muted-foreground">
                Ready to send — add a caption below, then hit Send.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setPendingFile(null)}
              aria-label="Remove attachment"
              disabled={sending}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {activeRoom?.type === "dm" && dmStatus === "pending" && (
          <div className="shrink-0 space-y-2 border-b bg-amber-500/10 px-4 py-3 text-sm">
            <p className="font-medium">
              {activeRoom.recipientId === currentUser.id
                ? "This person wants to message you. Accept to continue the conversation."
                : "Request sent. They need to accept before you can keep chatting."}
            </p>
            {activeRoom.recipientId === currentUser.id && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      const { respondToDmRequest } = await import(
                        "@/lib/services/chat"
                      );
                      const { notifySafely } = await import(
                        "@/lib/services/notifications"
                      );
                      await respondToDmRequest(activeRoom.id, true);
                      setDmStatus("accepted");
                      if (activeRoom.requesterId) {
                        notifySafely({
                          recipientId: activeRoom.requesterId,
                          actor: currentUser,
                          type: "dm_accepted",
                          href: "/chat",
                          text: "accepted your message request",
                        });
                      }
                      toast.success("Message request accepted");
                    } catch (error) {
                      console.error(error);
                      toast.error("Failed to accept request.");
                    }
                  }}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const { respondToDmRequest } = await import(
                        "@/lib/services/chat"
                      );
                      await respondToDmRequest(activeRoom.id, false);
                      setDmStatus("blocked");
                      toast.success("Request declined");
                    } catch (error) {
                      console.error(error);
                      toast.error("Failed to decline request.");
                    }
                  }}
                >
                  Decline
                </Button>
              </div>
            )}
          </div>
        )}

        {activeRoom && (
          <form
            onSubmit={handleSend}
            className="flex shrink-0 items-center gap-2 border-t p-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptAttribute(CHAT_UPLOAD_POLICY)}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Attach a file"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Create a poll"
              onClick={() => setPollOpen(true)}
              disabled={sending}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={(event) => {
                // Paste-to-upload: a copied image arrives as a File, not text.
                const file = Array.from(event.clipboardData.files)[0];
                if (file) {
                  event.preventDefault();
                  handleFile(file);
                }
              }}
              placeholder={
                pendingFile ? "Add a caption (optional)..." : "Type a message..."
              }
              aria-label="Message"
              className="flex-1"
            />
            <div className="relative inline-flex">
              <Button
                type="submit"
                size="icon"
                aria-label="Send message"
                disabled={sending || (!text.trim() && !pendingFile)}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
              <AnimationBurst
                name="send"
                trigger={sendTrigger}
                className="pointer-events-none absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2"
              />
            </div>
          </form>
        )}

        {uploadPercent !== null && (
          <div className="shrink-0 space-y-1.5 border-t px-3 py-2">
            <Progress value={uploadPercent} aria-label="Upload progress" />
            <p className="text-xs text-muted-foreground">
              Uploading… {uploadPercent}%
            </p>
          </div>
        )}
      </section>

      <ConfirmDeleteDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
        title="Delete this message?"
        description="It's removed for everyone in this channel. This can't be undone."
        confirmLabel="Delete message"
        busy={deletingMessage}
        onConfirm={handleDeleteMessage}
      />

      {activeRoom && (
        <CreatePollDialog
          roomType={activeRoom.type}
          roomId={activeRoom.id}
          currentUser={currentUser}
          open={pollOpen}
          onOpenChange={setPollOpen}
        />
      )}
    </div>
  );
}

