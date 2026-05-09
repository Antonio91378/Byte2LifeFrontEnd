import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";

const firebaseConfigKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function hasFirebaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  );
}

function missingFirebaseConfigMessage() {
  const missing = firebaseConfigKeys.filter((key) => !process.env[key]);
  return `Firebase auth environment variables are missing: ${missing.join(", ")}`;
}

export function getFirebaseApp() {
  if (typeof window === "undefined") {
    throw new Error("Firebase client app can only be initialized in the browser.");
  }

  if (!hasFirebaseConfig()) {
    throw new Error(missingFirebaseConfigMessage());
  }

  if (appInstance) {
    return appInstance;
  }

  appInstance = getApps().length === 0 ? initializeApp(getFirebaseConfig()) : getApp();
  return appInstance;
}

export function getFirebaseAuth() {
  if (authInstance) {
    return authInstance;
  }

  authInstance = getAuth(getFirebaseApp());
  return authInstance;
}
