import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { adjustUserStat } from "@/lib/services/users";
import {
  fetchOlderPage,
  firstPageQuery,
  PAGE_SIZE,
  pageFromDocs,
  type DocMapper,
  type Page,
} from "@/lib/services/pagination";
import type { Project, ProjectRequest, UserProfile } from "@/types";

const nowIso = () => new Date().toISOString();

export interface NewProjectInput {
  title: string;
  description: string;
  skillsRequired: string[];
  membersNeeded: number;
  coverPhotoUrl?: string | null;
}

const projectMapper: DocMapper<Project> = (id, data) =>
  ({ id, ...data }) as unknown as Project;

export function subscribeToProjects(
  callback: (page: Page<Project>) => void
): Unsubscribe {
  return onSnapshot(
    firstPageQuery(collection(db, "projects"), "createdAt", "desc", PAGE_SIZE.projects),
    (snap) => callback(pageFromDocs(snap.docs, projectMapper, PAGE_SIZE.projects))
  );
}

export async function fetchOlderProjects(
  cursor: QueryDocumentSnapshot
): Promise<Page<Project>> {
  return fetchOlderPage(
    collection(db, "projects"),
    "createdAt",
    "desc",
    cursor,
    PAGE_SIZE.projects,
    projectMapper
  );
}

export function subscribeToUserProjects(
  userId: string,
  callback: (projects: Project[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "projects"),
    where("members", "array-contains", userId),
    limit(PAGE_SIZE.projects)
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => projectMapper(d.id, d.data() as Record<string, unknown>, d))
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
    coverPhotoUrl: input.coverPhotoUrl ?? null,
    createdAt: nowIso(),
  });
  batch.update(doc(db, "users", owner.id), {
    projectsJoined: increment(1),
  });
  await batch.commit();
}

/** Partially updates a project. Only the owner should call this (see rules). */
export async function updateProject(
  projectId: string,
  input: Partial<NewProjectInput>
): Promise<void> {
  await updateDoc(doc(db, "projects", projectId), input);
}

/**
 * Deletes a project and its join-request documents.
 *
 * Firestore has no cascade delete, so `requests` would otherwise linger and keep
 * matching the collection-group query behind "have I already requested to join".
 */
export async function deleteProject(projectId: string): Promise<void> {
  const snap = await getDoc(doc(db, "projects", projectId));
  if (!snap.exists()) throw new Error("Project not found");

  const requests = await getDocs(
    query(collection(db, "projects", projectId, "requests"), limit(400))
  );
  const batch = writeBatch(db);
  requests.forEach((request) => batch.delete(request.ref));
  batch.delete(doc(db, "projects", projectId));
  await batch.commit();
}

/**
 * Every project the user has a pending join request for, from ONE query.
 *
 * The projects page used to call `hasRequested` once per project (30 queries
 * for a 30-project list). `status` is filtered client-side so this needs only
 * a single-field index rather than a composite one.
 */
export async function getRequestedProjectIds(
  userId: string
): Promise<Set<string>> {
  const ids = new Set<string>();
  const snap = await getDocs(
    query(collectionGroup(db, "requests"), where("userId", "==", userId))
  );
  snap.forEach((d) => {
    // projects/{projectId}/requests/{requestId} — two parents up is the project.
    const projectId = d.ref.parent.parent?.id;
    if (projectId && (d.data().status as string) === "pending") {
      ids.add(projectId);
    }
  });
  return ids;
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

  // NOTE: the joiner's `projectsJoined` counter is deliberately NOT adjusted.
  // It lives on THEIR profile document, and allowing one user to write another
  // user's profile would need a rule far broader than the follow counters.
  // The field is not rendered anywhere, so nothing is lost.
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
  const snap = await getDoc(doc(db, "projects", projectId));
  const wasMember = ((snap.data()?.members as string[]) ?? []).includes(userId);

  await writeBatch(db)
    .update(doc(db, "projects", projectId), {
      members: arrayRemove(userId),
    })
    .commit();

  // Only adjust the stat if the user really was a member, so a double-click
  // cannot drive the counter down twice.
  if (wasMember) {
    await adjustUserStat(userId, "projectsJoined", -1);
  }
}

export async function getProjectMembers(projectId: string): Promise<string[]> {
  const snap = await getDoc(doc(db, "projects", projectId));
  if (!snap.exists()) return [];
  return (snap.data().members as string[]) ?? [];
}
