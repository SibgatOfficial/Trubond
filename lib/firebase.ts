import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Firebase is initialised once and reused across hot reloads.
 *
 * Config comes from NEXT_PUBLIC_* env vars (see `.env.local.example`). The
 * inline fallbacks point at the existing Trubond project so the app still runs
 * out of the box; prefer the env vars in real deployments.
 */
const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyD0_KG4ltnJtazByZOFFoUNuV470JnLD38",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "trubond-app.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "trubond-app",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "trubond-app.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "698788489428",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:698788489428:web:8cf9c660dd8cb6ce87f341",
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

export { app };
