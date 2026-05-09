import {
  GoogleAuthProvider,
  User,
  deleteUser,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getFirebaseAuth, hasFirebaseConfig } from "./firebase";

const googleProvider = new GoogleAuthProvider();

export const loginWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(getFirebaseAuth(), email, password);

function unauthorizedGoogleUserError() {
  const error = new Error("Google account is not authorized for Byte2Life.");
  (error as { code?: string }).code = "auth/google-user-not-authorized";
  return error;
}

export const loginWithGoogle = async () => {
  const auth = getFirebaseAuth();
  const result = await signInWithPopup(auth, googleProvider);
  const additionalInfo = getAdditionalUserInfo(result);

  if (additionalInfo?.isNewUser) {
    try {
      await deleteUser(result.user);
    } finally {
      await signOut(auth).catch(() => undefined);
    }

    throw unauthorizedGoogleUserError();
  }

  return result;
};

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
