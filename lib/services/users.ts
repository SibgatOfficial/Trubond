import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  documentId,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserProfile } from "@/types";

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const ref = doc(db, "usernames", username.toLowerCase().trim());
  const snap = await getDoc(ref);
  return !snap.exists();
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<UserProfile, "id">) };
}

export async function getUsersByIds(ids: string[]): Promise<UserProfile[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 10) {
    chunks.push(unique.slice(i, i + 10));
  }
  const results: UserProfile[] = [];
  for (const chunk of chunks) {
    const snap = await getDocs(
      query(collection(db, "users"), where(documentId(), "in", chunk))
    );
    snap.forEach((d) =>
      results.push({ id: d.id, ...(d.data() as Omit<UserProfile, "id">) })
    );
  }
  return results;
}

export interface CreateProfileInput {
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
}

/**
 * Creates the `users/{uid}` profile and the `usernames/{username}` uniqueness
 * lock atomically — mirrors the original create.html batch write.
 */
export async function createUserProfile(
  uid: string,
  input: CreateProfileInput
): Promise<void> {
  const username = input.username.toLowerCase().trim();
  const batch = writeBatch(db);

  const userDocRef = doc(db, "users", uid);
  batch.set(userDocRef, {
    username,
    name: input.name,
    email: input.email,
    about: input.about,
    profilePhotoUrl: input.profilePhotoUrl,
    branch: input.branch,
    startYear: input.startYear ?? null,
    passingYear: input.passingYear ?? null,
    gender: input.gender,
    dob: input.dob,
    createdAt: new Date().toISOString(),
    followingCount: 0,
    followerCount: 0,
    postCount: 0,
    projectsJoined: 0,
    eventsJoined: 0,
  });

  const usernameDocRef = doc(db, "usernames", username);
  batch.set(usernameDocRef, { userId: uid });

  await batch.commit();
}

export async function updateUserProfile(
  uid: string,
  data: Partial<CreateProfileInput> & {
    profilePhotoUrl?: string;
  }
): Promise<void> {
  await updateDoc(doc(db, "users", uid), data);
}
