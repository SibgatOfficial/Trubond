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
  authorPhoto?: string;
  text: string;
  createdAt: FirestoreDate;
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
  maxAttendees: number;
  attendeeCount: number;
  coverPhotoUrl?: string | null;
  createdBy?: string;
  createdAt?: FirestoreDate;
}

export interface Attendee {
  id: string;
  username?: string;
  name?: string;
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
}

export type ChatType = "global" | "branch" | "project";

export interface ChatRoom {
  id: string;
  type: ChatType;
  name: string;
  subtitle?: string;
}
