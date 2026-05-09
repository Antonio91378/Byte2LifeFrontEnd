"use client";

import { User } from "firebase/auth";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getIdToken,
  loginWithEmail,
  loginWithGoogle,
  logout,
  onAuthChange,
  registerWithEmail,
} from "../services/auth.service";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const unsubscribe = onAuthChange(async (firebaseUser) => {
        try {
          setUser(firebaseUser);

          if (firebaseUser) {
            const idToken = await firebaseUser.getIdToken();
            setToken(idToken);
          } else {
            setToken(null);
          }
        } finally {
          setLoading(false);
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Erro ao inicializar autenticacao Firebase:", error);
      setUser(null);
      setToken(null);
      setLoading(false);
      return () => undefined;
    }
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const result = await loginWithEmail(email, password);
      const idToken = await result.user.getIdToken();
      setUser(result.user);
      setToken(idToken);
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    const result = await loginWithGoogle();
    const idToken = await result.user.getIdToken();
    setUser(result.user);
    setToken(idToken);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const result = await registerWithEmail(email, password);
    const idToken = await result.user.getIdToken();
    setUser(result.user);
    setToken(idToken);
  }, []);

  const handleSignOut = useCallback(async () => {
    await logout();
    setUser(null);
    setToken(null);
  }, []);

  const refreshToken = useCallback(async () => {
    const newToken = await getIdToken(true);
    setToken(newToken);
    return newToken;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        signInWithEmail,
        signInWithGoogle,
        register,
        signOut: handleSignOut,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
