import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getFirebaseAuth, hasFirebaseConfig } from "./firebase";

const googleProvider = new GoogleAuthProvider();

export const loginWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(getFirebaseAuth(), email, password);

export const registerWithEmail = (email: string, password: string) =>
  createUserWithEmailAndPassword(getFirebaseAuth(), email, password);

export const loginWithGoogle = () =>
  signInWithPopup(getFirebaseAuth(), googleProvider);

export const logout = () => signOut(getFirebaseAuth());

export const onAuthChange = (callback: (user: User | null) => void) => {
  if (typeof window === "undefined" || !hasFirebaseConfig()) {
    callback(null);
    return () => undefined;
  }

  return onAuthStateChanged(getFirebaseAuth(), callback);
};

export const getIdToken = async (
  forceRefresh = false,
): Promise<string | null> => {
  if (typeof window === "undefined" || !hasFirebaseConfig()) {
    return null;
  }

  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  return user.getIdToken(forceRefresh);
};
