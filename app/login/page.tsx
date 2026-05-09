"use client";

import { Chrome, Loader2, LockKeyhole, LogIn, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";

export default function LoginPage() {
  const { user, loading, signInWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState<"email" | "google" | null>(null);

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

    if (password.length < 6) {
      setError("A senha deve ter no minimo 6 caracteres.");
      return;
    }

    setSubmitting("email");
    try {
      await signInWithEmail(email, password);
      router.replace(resolveNextPath());
    } catch (err: unknown) {
      setError(translateAuthError(err));
    } finally {
      setSubmitting(null);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setSubmitting("google");

    try {
      await signInWithGoogle();
      router.replace(resolveNextPath());
    } catch (err: unknown) {
      setError(translateAuthError(err));
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6fb]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-purple" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6fb] px-5 py-8 text-slate-950">
      <section className="w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <h1 className="text-4xl font-black tracking-normal text-brand-purple">
            Byte<span className="text-brand-orange">2</span>Life
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Acesse o painel de gerenciamento
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_22px_58px_rgba(46,2,73,0.12)] sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">
              Login
            </p>
            <h2 className="mt-2 text-2xl font-black text-brand-purple">
              Entre com seu email
            </h2>
          </div>

          <div className="flex flex-col gap-5">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={submitting !== null}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900 shadow-sm transition hover:border-brand-purple hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting === "google" ? (
                <Loader2 className="h-5 w-5 animate-spin text-brand-purple" />
              ) : (
                <Chrome className="h-5 w-5 text-[#1a73e8]" />
              )}
              Entrar com Google
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                ou
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-800">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="seu@email.com"
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-11 text-base font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-purple focus:ring-4 focus:ring-brand-purple/10"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-800">
                Senha
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Minimo 6 caracteres"
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-11 text-base font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-purple focus:ring-4 focus:ring-brand-purple/10"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting !== null}
              className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-purple font-bold text-white shadow-lg shadow-brand-purple/20 transition-colors hover:bg-brand-purple-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting === "email" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <LogIn className="h-5 w-5" />
              )}
              Entrar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function translateAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  const message = (err as { message?: string })?.message ?? "";

  if (message.includes("Firebase auth environment variables")) {
    return "Autenticacao indisponivel. Verifique as variaveis do Firebase na Vercel.";
  }

  switch (code) {
    case "auth/invalid-email":
      return "Email invalido.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email ou senha incorretos.";
    case "auth/google-user-not-authorized":
      return "Esta conta Google nao esta autorizada no Byte2Life.";
    case "auth/unauthorized-domain":
      return "Dominio nao autorizado no Firebase. Adicione este dominio em Authentication > Settings > Authorized domains.";
    case "auth/operation-not-allowed":
      return "Login com Google desativado no Firebase. Ative o provedor Google em Authentication > Sign-in method.";
    case "auth/account-exists-with-different-credential":
      return "Este email ja existe com outro metodo. Entre com email e senha.";
    case "auth/popup-closed-by-user":
      return "Login com Google cancelado.";
    case "auth/popup-blocked":
      return "O navegador bloqueou a janela do Google.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Tente novamente mais tarde.";
    case "auth/network-request-failed":
      return "Erro de conexao. Verifique sua internet.";
    default:
      return "Nao foi possivel autenticar. Tente novamente.";
  }
}
