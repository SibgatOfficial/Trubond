"use client";

import * as React from "react";
import { BarChart3, Hash, Loader2, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PollMessage } from "@/components/chat/poll-message";
import { CreatePollDialog } from "@/components/chat/create-poll-dialog";
import {
  getChatRooms,
  sendFileMessage,
  sendTextMessage,
  subscribeToMessages,
  votePoll,
} from "@/lib/services/chat";
import { uploadChatFile } from "@/lib/services/storage";
import { DEFAULT_AVATAR, formatBytes, initials, timeAgo } from "@/lib/utils";
import type { ChatMessage, ChatRoom, UserProfile } from "@/types";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function ChatClient({ currentUser }: { currentUser: UserProfile }) {
  const [rooms, setRooms] = React.useState<ChatRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = React.useState(true);
  const [activeRoom, setActiveRoom] = React.useState<ChatRoom | null>(null);
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
    const unsubscribe = subscribeToMessages(
      activeRoom.type,
      activeRoom.id,
      (next) => {
        setMessages(next);
        setMessagesLoading(false);
      },
      () => {
        setMessagesLoading(false);
        toast.error("Failed to load messages.");
      }
    );
    return () => unsubscribe();
  }, [activeRoom]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeRoom || !text.trim()) return;
    const value = text.trim();
    setText("");
    setSending(true);
    try {
      await sendTextMessage(activeRoom.type, activeRoom.id, currentUser, value);
    } catch (error) {
      console.error(error);
      toast.error("Failed to send message.");
      setText(value);
    } finally {
      setSending(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!activeRoom) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be smaller than 10MB.");
      return;
    }
    setSending(true);
    try {
      const url = await uploadChatFile(activeRoom.type, activeRoom.id, file);
      await sendFileMessage(activeRoom.type, activeRoom.id, currentUser, {
        url,
        name: file.name,
        size: file.size,
        type: file.type,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload file.");
    } finally {
      setSending(false);
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

  const renderMessage = (message: ChatMessage) => {
    const isOwn = message.senderId === currentUser.id;
    const type = message.type ?? "text";

    return (
      <div
        key={message.id}
        className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      >
        {!isOwn && (
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage
              src={message.senderPhoto || DEFAULT_AVATAR}
              alt={message.senderUsername}
            />
            <AvatarFallback>{initials(message.senderUsername)}</AvatarFallback>
          </Avatar>
        )}

        <div
          className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
            isOwn
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm bg-muted text-foreground"
          }`}
        >
          {!isOwn && (
            <p className="mb-0.5 text-xs font-semibold opacity-80">
              @{message.senderUsername}
            </p>
          )}

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
          ) : type === "file" ? (
            <a
              href={message.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 underline-offset-2 hover:underline"
            >
              <Paperclip className="h-4 w-4 shrink-0" />
              <span className="truncate">{message.fileName}</span>
              {message.fileSize ? (
                <span className="text-xs opacity-70">
                  {formatBytes(message.fileSize)}
                </span>
              ) : null}
            </a>
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          )}

          <p
            className={`mt-1 text-right text-[10px] ${
              isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
            }`}
          >
            {timeAgo(message.createdAt)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto grid h-[calc(100vh-9rem)] max-w-4xl grid-cols-1 gap-4 md:grid-cols-[16rem_1fr]">
      <aside className="hidden overflow-hidden rounded-xl border bg-card md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Hash className="h-4 w-4 text-primary" />
          <span className="font-semibold">Channels</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {roomsLoading ? (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              rooms.map((room) => (
                <button
                  key={`${room.type}-${room.id}`}
                  onClick={() => setActiveRoom(room)}
                  className={`mb-1 flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition ${
                    activeRoom?.id === room.id && activeRoom?.type === room.type
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  <span className="truncate text-sm font-medium">{room.name}</span>
                  {room.subtitle && (
                    <span className="text-xs text-muted-foreground">
                      {room.subtitle}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      <section className="flex flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="font-semibold">{activeRoom?.name ?? "Select a chat"}</p>
            {activeRoom?.subtitle && (
              <p className="text-xs text-muted-foreground">{activeRoom.subtitle}</p>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-4">
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
        </ScrollArea>

        {activeRoom && (
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 border-t p-3"
          >
            <input
              ref={fileInputRef}
              type="file"
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
              title="Attach file"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Create poll"
              onClick={() => setPollOpen(true)}
              disabled={sending}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={sending || !text.trim()}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        )}
      </section>

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

