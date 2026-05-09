"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";

type LoginMode = "login" | "register";

export default function LoginPage() {
  const { user, loading, signInWithEmail, signInWithGoogle, register } =
    useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<LoginMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resolveNextPath = () => {
    if (typeof window === "undefined") {
      return "/";
    }

    const next = new URLSearchParams(window.location.search).get("next");
    return next?.startsWith("/") ? next : "/";
  };

  useEffect(() => {
    if (!loading && user) {
      router.replace(resolveNextPath());
    }
  }, [user, loading, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (mode === "register" && password !== confirmPassword) {
      setError("As senhas nao coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter no minimo 6 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        await signInWithEmail(email, password);
      } else {
        await register(email, password);
      }
      router.replace(resolveNextPath());
    } catch (err: unknown) {
      setError(translateFirebaseError((err as { code?: string })?.code));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setSubmitting(true);
    try {
      await signInWithGoogle();
      router.replace(resolveNextPath());
    } catch (err: unknown) {
      setError(translateFirebaseError((err as { code?: string })?.code));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-purple/25 border-t-brand-purple" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <Image
            src="/byte2life-logo.png"
            alt="Byte2Life"
            width={72}
            height={72}
            priority
            className="mb-3 h-16 w-auto"
          />
          <h1 className="text-2xl font-bold text-brand-purple">Byte2Life</h1>
          <p className="mt-1 text-sm text-slate-500">
            Plataforma de gerenciamento 3D
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-6 flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "border-b-2 border-brand-purple text-brand-purple"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                mode === "register"
                  ? "border-b-2 border-brand-purple text-brand-purple"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Criar conta
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={submitting}
            className="mb-4 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm font-bold text-blue-600">
              G
            </span>
            Continuar com Google
          </button>

          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">ou</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-purple"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="Minimo 6 caracteres"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-purple"
              />
            </div>

            {mode === "register" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Confirmar senha
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Repita a senha"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-purple"
                />
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-purple py-2.5 font-medium text-white transition-colors hover:bg-brand-purple-light disabled:opacity-50"
            >
              {submitting && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function translateFirebaseError(code?: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "Email invalido.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email ou senha incorretos.";
    case "auth/email-already-in-use":
      return "Este email ja esta cadastrado.";
    case "auth/weak-password":
      return "Senha fraca. Use ao menos 6 caracteres.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Tente novamente mais tarde.";
    case "auth/popup-closed-by-user":
      return "Login cancelado.";
    case "auth/network-request-failed":
      return "Erro de conexao. Verifique sua internet.";
    default:
      return "Erro ao autenticar. Tente novamente.";
  }
}
