"use client";

import * as React from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  limit,
  query,
  collection,
  where,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { UserProfile } from "@/types";

interface AuthContextValue {
  /** Firebase auth user (Google). */
  user: User | null;
  /** Firestore profile document for the current user (null until onboarding). */
  profile: UserProfile | null;
  /** True while auth state and the profile document are being resolved. */
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

/**
 * When a legacy phone-auth user signs in with Google for the first time they
 * receive a NEW Firebase UID, so their old `users/<uid>` doc is not found.
 * If enabled, we look for an existing profile with the same (Google-verified)
 * email and non-destructively copy it to the new UID so the user keeps their
 * profile + stats. Nothing is ever deleted — the original doc is left intact.
 *
 * Set to false for a strict "fresh start" behaviour.
 */
const ENABLE_EMAIL_PROFILE_RECOVERY = true;

async function findProfileByEmail(email: string, uid: string): Promise<UserProfile | null> {
  try {
    const q = query(
      collection(db, "users"),
      where("email", "==", email),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const legacyDoc = snap.docs[0];
    if (legacyDoc.id === uid) return null;

    const data = legacyDoc.data();
    const migrated: Record<string, unknown> = {
      ...data,
      migratedFrom: legacyDoc.id,
      migratedAt: new Date().toISOString(),
    };
    // Create the profile under the new (Google) UID. Old doc is untouched.
    await setDoc(doc(db, "users", uid), migrated, { merge: true });
    return { id: uid, ...(data as Omit<UserProfile, "id">) };
  } catch (error) {
    console.error("Email profile recovery failed:", error);
    return null;
  }
}

async function loadProfile(uid: string, email: string | null): Promise<UserProfile | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { id: snap.id, ...(snap.data() as Omit<UserProfile, "id">) };
  }
  if (ENABLE_EMAIL_PROFILE_RECOVERY && email) {
    return findProfileByEmail(email, uid);
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const nextProfile = await loadProfile(
          nextUser.uid,
          nextUser.email ?? null
        );
        if (active) setProfile(nextProfile);
      } catch (error) {
        console.error("Failed to load user profile:", error);
        if (active) setProfile(null);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [reloadToken]);

  const signInWithGoogle = React.useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  }, []);

  const signOut = React.useCallback(async () => {
    await firebaseSignOut(auth);
    setProfile(null);
  }, []);

  const refreshProfile = React.useCallback(async () => {
    if (!auth.currentUser) {
      setProfile(null);
      return;
    }
    const next = await loadProfile(
      auth.currentUser.uid,
      auth.currentUser.email ?? null
    );
    setProfile(next);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, profile, loading, signInWithGoogle, signOut, refreshProfile }),
    [user, profile, loading, signInWithGoogle, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
