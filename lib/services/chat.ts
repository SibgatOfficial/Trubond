import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ChatMessage, ChatRoom, ChatType, UserProfile } from "@/types";

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

export function subscribeToMessages(
  type: ChatType,
  roomId: string,
  callback: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const path = chatCollectionPath(type, roomId);
  const q = query(collection(db, path), orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, "id">) })
        )
      );
    },
    (error) => onError?.(error as Error)
  );
}

export async function sendTextMessage(
  type: ChatType,
  roomId: string,
  sender: UserProfile,
  text: string
): Promise<void> {
  await addDoc(collection(db, chatCollectionPath(type, roomId)), {
    senderId: sender.id,
    senderUsername: sender.username,
    senderPhoto: sender.profilePhotoUrl,
    text,
    createdAt: nowIso(),
  });
}

export async function sendFileMessage(
  type: ChatType,
  roomId: string,
  sender: UserProfile,
  file: { url: string; name: string; size: number; type: string }
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
