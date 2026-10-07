import type { Timestamp } from "firebase/firestore";

/** Firestore timestamps may be a real Timestamp, ISO string or missing. */
export type FirestoreDate = Timestamp | string | Date | null | undefined;

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  email: string;
  about: string;
  profilePhotoUrl: string;
  coverPhotoUrl?: string | null;
  socialLinks?: {
    linkedin?: string;
    portfolio?: string;
    github?: string;
    website?: string;
  };
  branch: string;
  startYear: number | null;
  passingYear: number | null;
  gender: string;
  dob: string;
  createdAt: FirestoreDate;
  followingCount: number;
  followerCount: number;
  postCount: number;
  projectsJoined: number;
  eventsJoined: number;
  /**
   * Presence, maintained by `lib/services/presence.ts` via a visibility-aware
   * heartbeat. `isOnline` alone is not trustworthy — a closed tab can never
   * write "offline" — so read it together with `lastSeen`.
   */
  isOnline?: boolean;
  lastSeen?: FirestoreDate;
}

export interface Post {
  id: string;
  authorId: string;
  authorUsername: string;
  authorName?: string;
  authorPhoto?: string;
  text: string;
  imageUrl?: string | null;
  createdAt: FirestoreDate;
  likeCount: number;
  commentCount: number;
  viewCount: number;
}

export interface Comment {
  id: string;
  authorId: string;
  authorUsername: string;
  /** Real name; absent on comments written before it was stored. */
  authorName?: string;
  authorPhoto?: string;
  text: string;
  createdAt: FirestoreDate;
  /**
   * Parent comment id for a one-level reply thread; `null` for a top-level
   * comment. Absent on comments written before replies existed.
   */
  parentId?: string | null;
  replyToUsername?: string | null;
}

export interface Project {
  id: string;
  ownerId: string;
  ownerUsername: string;
  title: string;
  description: string;
  skillsRequired: string[];
  members: string[];
  membersNeeded?: number;
  status?: string;
  createdAt: FirestoreDate;
  /** Optional banner. Absent on projects created before this field existed. */
  coverPhotoUrl?: string | null;
}

/** Stored at projects/{projectId}/requests/{requestId}. */
export interface ProjectRequest {
  id: string;
  userId: string;
  username: string;
  requestedAt: FirestoreDate;
  status: "pending" | "approved" | "denied";
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  location: string;
  date: FirestoreDate;
  startsAt?: FirestoreDate;
  endsAt?: FirestoreDate;
  maxAttendees: number;
  attendeeCount: number;
  scanCount?: number;
  coverPhotoUrl?: string | null;
  createdBy?: string;
  /**
   * Creator's username, stored so ownership survives the phone→Google auth
   * migration (which issues a new uid). Absent on events created before this
   * field existed.
   */
  createdByUsername?: string;
  createdAt?: FirestoreDate;
}

export interface Attendee {
  id: string;
  username?: string;
  name?: string;
  joinedAt?: FirestoreDate;
}

export interface EventScan {
  id: string;
  userId: string;
  username?: string;
  name?: string;
  scannedAt?: FirestoreDate;
  joinedAt?: FirestoreDate;
}

export interface PollOption {
  text: string;
  votes: number;
  voters: string[];
}

export interface Poll {
  question: string;
  options: PollOption[];
  totalVotes: number;
  expiresAt: FirestoreDate;
  isActive: boolean;
}

export type ChatMessageType = "text" | "file" | "poll";

/**
 * A snapshot of the message being replied to.
 *
 * Denormalised on purpose: the original may be deleted, and we still want the
 * reply to render its quote rather than a dangling id.
 */
export interface MessageReply {
  id: string;
  senderUsername: string;
  text: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderUsername: string;
  senderPhoto?: string;
  /** Absent for legacy text messages; infer "text" when missing. */
  type?: ChatMessageType;
  text?: string;
  createdAt: FirestoreDate;
  // file messages
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  // poll messages
  poll?: Poll;
  /** Set when the sender edits their message, so the UI can show "edited". */
  editedAt?: FirestoreDate;
  /** Quoted message when this is a reply. */
  replyTo?: MessageReply | null;
}

export type ChatType = "global" | "branch" | "project" | "dm";

export interface ChatRoom {
  id: string;
  type: ChatType;
  name: string;
  subtitle?: string;
  status?: "pending" | "accepted" | "blocked";
  recipientId?: string;
  requesterId?: string;
}

/** A file attached to a note. Mirrors the chat attachment shape. */
export interface NoteFile {
  url: string;
  name: string;
  size: number;
  type: string;
}

/**
 * Shared study material — lecture notes, assignments, past papers, slide decks.
 *
 * Stored at `notes/{noteId}`. Upvotes live in a subcollection
 * (`notes/{id}/upvotes/{uid}`) rather than an array on the document, because an
 * array of voter ids would eventually hit Firestore's 1 MB document limit.
 */
export interface Note {
  id: string;
  title: string;
  description: string;
  subject: string;
  branch: string;
  semester: string;
  tags: string[];
  files: NoteFile[];
  /**
   * SHA-256 of each attached file's bytes, for duplicate detection. Absent on
   * notes created before this field existed.
   */
  fileHashes?: string[];
  uploaderId: string;
  uploaderUsername: string;
  uploaderName?: string;
  uploaderPhoto?: string;
  upvoteCount: number;
  downloadCount: number;
  commentCount: number;
  createdAt: FirestoreDate;
}

export interface NoteComment {
  id: string;
  authorId: string;
  authorUsername: string;
  /** Real name; absent on comments written before it was stored. */
  authorName?: string;
  authorPhoto?: string;
  text: string;
  createdAt: FirestoreDate;
  parentId?: string | null;
  replyToUsername?: string | null;
}

export interface DmThread {
  id: string;
  participantIds: string[];
  participantUsernames: string[];
  requesterId: string;
  recipientId: string;
  status: "pending" | "accepted" | "blocked";
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
}

export type NotificationType =
  | "like"
  | "comment"
  | "reply"
  | "follow"
  | "note_upvote"
  | "note_comment"
  | "project_approved"
  | "event_registration"
  | "event_scan"
  | "dm_request"
  | "dm_accepted";

/**
 * An in-app notification, stored at `notifications/{id}`.
 *
 * Deliberately a TOP-LEVEL collection rather than a per-user subcollection
 * (`users/{uid}/notifications`): a subcollection would force security rules
 * that let one signed-in user write into another user's tree. A flat collection
 * with a `recipientId` field can instead be ruled as "create only when you are
 * the actor, read only when you are the recipient".
 */
export interface AppNotification {
  id: string;
  recipientId: string;
  actorId: string;
  actorUsername: string;
  actorName?: string;
  actorPhoto?: string;
  type: NotificationType;
  /** The post / note / user the action targeted. */
  targetId?: string | null;
  /** Where clicking the notification should take the user. */
  href?: string | null;
  /** Optional extra context, e.g. a comment excerpt. */
  text?: string | null;
  read: boolean;
  createdAt: FirestoreDate;
}
