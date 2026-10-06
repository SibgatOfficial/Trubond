import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Project, ProjectRequest, UserProfile } from "@/types";

const nowIso = () => new Date().toISOString();

export interface NewProjectInput {
  title: string;
  description: string;
  skillsRequired: string[];
  membersNeeded: number;
}

export function subscribeToProjects(
  callback: (projects: Project[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "projects"),
    orderBy("createdAt", "desc"),
    limit(30)
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, "id">) }))
    );
  });
}

export function subscribeToUserProjects(
  userId: string,
  callback: (projects: Project[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "projects"),
    where("members", "array-contains", userId)
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, "id">) }))
    );
  });
}

export async function createProject(
  owner: UserProfile,
  input: NewProjectInput
): Promise<void> {
  const batch = writeBatch(db);
  const projectRef = doc(collection(db, "projects"));
  batch.set(projectRef, {
    ownerId: owner.id,
    ownerUsername: owner.username,
    title: input.title,
    description: input.description,
    skillsRequired: input.skillsRequired,
    membersNeeded: input.membersNeeded,
    members: [owner.id],
    status: "open",
    createdAt: nowIso(),
  });
  batch.update(doc(db, "users", owner.id), {
    projectsJoined: increment(1),
  });
  await batch.commit();
}

export async function deleteProject(projectId: string): Promise<void> {
  const snap = await getDoc(doc(db, "projects", projectId));
  if (!snap.exists()) throw new Error("Project not found");
  await deleteDoc(doc(db, "projects", projectId));
}

export async function hasRequested(
  projectId: string,
  userId: string
): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, "projects", projectId, "requests"),
      where("userId", "==", userId),
      where("status", "==", "pending"),
      limit(1)
    )
  );
  return !snap.empty;
}

export async function requestToJoin(
  project: Project,
  user: UserProfile
): Promise<void> {
  if (project.members.includes(user.id)) return;
  const already = await hasRequested(project.id, user.id);
  if (already) return;
  await addDoc(collection(db, "projects", project.id, "requests"), {
    userId: user.id,
    username: user.username,
    requestedAt: nowIso(),
    status: "pending",
  });
}

export async function getPendingRequests(
  projectId: string
): Promise<ProjectRequest[]> {
  const snap = await getDocs(
    query(
      collection(db, "projects", projectId, "requests"),
      where("status", "==", "pending")
    )
  );
  return snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<ProjectRequest, "id">) })
  );
}

export async function approveRequest(
  projectId: string,
  requestId: string,
  userIdToApprove: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "projects", projectId), {
    members: arrayUnion(userIdToApprove),
  });
  batch.delete(doc(db, "projects", projectId, "requests", requestId));
  await batch.commit();
}

export async function denyRequest(
  projectId: string,
  requestId: string
): Promise<void> {
  await deleteDoc(doc(db, "projects", projectId, "requests", requestId));
}

export async function leaveProject(
  projectId: string,
  userId: string
): Promise<void> {
  await writeBatch(db)
    .update(doc(db, "projects", projectId), {
      members: arrayRemove(userId),
    })
    .commit();
}

export async function getProjectMembers(projectId: string): Promise<string[]> {
  const snap = await getDoc(doc(db, "projects", projectId));
  if (!snap.exists()) return [];
  return (snap.data().members as string[]) ?? [];
}
