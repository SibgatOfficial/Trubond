import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  fetchOlderPage,
  PAGE_SIZE,
  pageFromDocs,
  type DocMapper,
} from "@/lib/services/pagination";
import type { ChatMessage, ChatRoom, ChatType, MessageReply, UserProfile } from "@/types";

const nowIso = () => new Date().toISOString();

export const GLOBAL_ROOM_ID = "live_chat";

export function chatCollectionPath(type: ChatType, roomId: string): string {
  switch (type) {
    case "global":
      return `global_chat/${roomId}/messages`;
    case "branch":
      return `branch_chats/${roomId}/messages`;
    case "project":
      return `project_chats/${roomId}/messages`;
    default:
      throw new Error(`Unknown chat type: ${type}`);
  }
}

const messageMapper: DocMapper<ChatMessage> = (id, data) =>
  ({ id, ...data }) as unknown as ChatMessage;

/**
 * The newest page of a room, delivered OLDEST-first for rendering.
 *
 * Ordered DESC + `limit` so Firestore returns the newest N (an ascending query
 * can only limit from the *start* of history); the array is reversed here so
 * callers can render top-to-bottom.
 *
 * Previously this was an unbounded ascending listener — it streamed every
 * message ever sent in the room, on every client.
 *
 * `cursor` is the oldest message on this page; pass it to `fetchOlderMessages`.
 */
export function subscribeToMessages(
  type: ChatType,
  roomId: string,
  callback: (
    messages: ChatMessage[],
    cursor: QueryDocumentSnapshot | null,
    hasMore: boolean
  ) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const path = chatCollectionPath(type, roomId);
  const q = query(
    collection(db, path),
    orderBy("createdAt", "desc"),
    limit(PAGE_SIZE.chat)
  );
  return onSnapshot(
    q,
    (snap) => {
      const page = pageFromDocs(snap.docs, messageMapper, PAGE_SIZE.chat);
      callback([...page.items].reverse(), page.cursor, page.hasMore);
    },
    (error) => onError?.(error as Error)
  );
}

/** Older messages, returned oldest-first so they can be prepended. */
export async function fetchOlderMessages(
  type: ChatType,
  roomId: string,
  cursor: QueryDocumentSnapshot
): Promise<{
  messages: ChatMessage[];
  cursor: QueryDocumentSnapshot | null;
  hasMore: boolean;
}> {
  const page = await fetchOlderPage(
    collection(db, chatCollectionPath(type, roomId)),
    "createdAt",
    "desc",
    cursor,
    PAGE_SIZE.chat,
    messageMapper
  );
  return {
    messages: [...page.items].reverse(),
    cursor: page.cursor,
    hasMore: page.hasMore,
  };
}

export async function sendTextMessage(
  type: ChatType,
  roomId: string,
  sender: UserProfile,
  text: string,
  replyTo?: MessageReply | null
): Promise<void> {
  await addDoc(collection(db, chatCollectionPath(type, roomId)), {
    senderId: sender.id,
    senderUsername: sender.username,
    senderPhoto: sender.profilePhotoUrl,
    text,
    replyTo: replyTo ?? null,
    createdAt: nowIso(),
  });
}

/** Edits a message's text and stamps it, so the UI can show "edited". */
export async function editMessage(
  type: ChatType,
  roomId: string,
  messageId: string,
  text: string
): Promise<void> {
  await updateDoc(doc(db, chatCollectionPath(type, roomId), messageId), {
    text: text.trim(),
    editedAt: nowIso(),
  });
}

export async function deleteMessage(
  type: ChatType,
  roomId: string,
  messageId: string
): Promise<void> {
  await deleteDoc(doc(db, chatCollectionPath(type, roomId), messageId));
}

export async function sendFileMessage(
  type: ChatType,
  roomId: string,
  sender: UserProfile,
  file: { url: string; name: string; size: number; type: string },
  replyTo?: MessageReply | null
): Promise<void> {
  await addDoc(collection(db, chatCollectionPath(type, roomId)), {
    type: "file",
    senderId: sender.id,
    senderUsername: sender.username,
    senderPhoto: sender.profilePhotoUrl,
    fileUrl: file.url,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    replyTo: replyTo ?? null,
    createdAt: nowIso(),
  });
}

export async function createPoll(
  type: ChatType,
  roomId: string,
  sender: UserProfile,
  question: string,
  options: string[],
  durationDays: number
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + durationDays * 24 * 60 * 60 * 1000
  ).toISOString();

  await addDoc(collection(db, chatCollectionPath(type, roomId)), {
    type: "poll",
    senderId: sender.id,
    senderUsername: sender.username,
    senderPhoto: sender.profilePhotoUrl,
    createdAt: nowIso(),
    poll: {
      question,
      options: options.map((text) => ({ text, votes: 0, voters: [] })),
      totalVotes: 0,
      expiresAt,
      isActive: true,
    },
  });
}

/** Votes using a transaction so concurrent votes can't clobber each other. */
export async function votePoll(
  type: ChatType,
  roomId: string,
  messageId: string,
  optionIndex: number,
  userId: string
): Promise<void> {
  const path = chatCollectionPath(type, roomId);
  const messageRef = doc(db, path, messageId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(messageRef);
    if (!snap.exists()) throw new Error("Poll not found");

    const data = snap.data() as ChatMessage;
    const poll = data.poll;
    if (!poll) throw new Error("Not a poll");
    if (!poll.isActive) throw new Error("Poll has ended");
    if (poll.expiresAt && new Date(poll.expiresAt as string) < new Date()) {
      throw new Error("Poll has expired");
    }

    const options = poll.options.map((o) => ({
      ...o,
      voters: o.voters ?? [],
      votes: o.votes ?? 0,
    }));

    // Remove any existing vote by this user (single-choice poll).
    let removed = false;
    options.forEach((option) => {
      if (option.voters.includes(userId)) {
        option.voters = option.voters.filter((v) => v !== userId);
        option.votes = Math.max(0, option.votes - 1);
        removed = true;
      }
    });

    // If the user clicked the same option they already had, treat as unvote.
    const target = options[optionIndex];
    if (!target) throw new Error("Invalid option");

    let delta = removed ? 0 : 1;
    const wasSameOption =
      poll.options[optionIndex]?.voters?.includes(userId) ?? false;
    if (wasSameOption) {
      delta = -1;
    } else {
      target.voters = [...target.voters, userId];
      target.votes = target.votes + 1;
      delta = 1;
    }

    transaction.update(messageRef, {
      poll: {
        ...poll,
        options,
        totalVotes: Math.max(
          0,
          options.reduce((sum, o) => sum + o.votes, 0)
        ),
      },
    });
    void delta;
  });
}

/** Global + branch + project chat rooms the user can access. */
export async function getChatRooms(user: UserProfile): Promise<ChatRoom[]> {
  const rooms: ChatRoom[] = [
    {
      id: GLOBAL_ROOM_ID,
      type: "global",
      name: "Global Live Chat",
      subtitle: "Everyone on Trubond",
    },
  ];

  if (user.branch) {
    rooms.push({
      id: user.branch,
      type: "branch",
      name: `${user.branch} Department Chat`,
      subtitle: "Your branch",
    });
  }

  try {
    const snap = await getDocs(
      query(
        collection(db, "projects"),
        orderBy("createdAt", "desc"),
        limit(50)
      )
    );
    snap.forEach((d) => {
      const data = d.data();
      if ((data.members as string[])?.includes(user.id)) {
        rooms.push({
          id: d.id,
          type: "project",
          name: data.title as string,
          subtitle: "Project group",
        });
      }
    });
  } catch {
    /* ignore project room errors */
  }

  return rooms;
}
