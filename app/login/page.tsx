"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  Chrome,
  Loader2,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { hasFirebaseConfig } from "../../services/firebase";

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
  const authConfigured = hasFirebaseConfig();

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

    if (!authConfigured) {
      setError("Autenticacao indisponivel. Configure as variaveis do Firebase na Vercel.");
      return;
    }

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

    if (!authConfigured) {
      setError("Autenticacao indisponivel. Configure as variaveis do Firebase na Vercel.");
      return;
    }

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
    <div className="min-h-screen bg-[#f3f6fb] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[minmax(420px,0.96fr)_1.04fr]">
        <section className="relative hidden overflow-hidden bg-brand-purple text-white lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#2e0249_0%,#3d0b63_52%,#1a0628_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(0deg,rgba(255,153,0,0.2),rgba(255,153,0,0))]" />

          <div className="relative flex w-full flex-col justify-between px-12 py-10">
            <div className="flex items-center gap-3">
              <Image
                src="/byte2life-mark.svg"
                alt="Byte2Life"
                width={54}
                height={54}
                priority
                className="h-12 w-12 rounded-2xl shadow-lg shadow-black/30"
              />
              <div>
                <p className="text-xl font-black tracking-[0.08em]">
                  BYTE<span className="text-brand-orange">2</span>LIFE
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-100/80">
                  3D Printing
                </p>
              </div>
            </div>

            <div className="max-w-xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-orange-50 shadow-sm backdrop-blur">
                <ShieldCheck className="h-4 w-4 text-brand-orange" />
                Acesso seguro
              </div>
              <h1 className="max-w-lg text-5xl font-black leading-[1.02] tracking-normal">
                Gestao Byte2Life em um ambiente protegido.
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-purple-100">
                Entre para acompanhar estoque, vendas, servicos e impressora com os dados sincronizados pela API.
              </p>
            </div>

            <div className="grid max-w-xl grid-cols-3 gap-3">
              {[
                ["API", "protegida"],
                ["Firebase", "auth"],
                ["Vercel", "online"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/12 bg-white/8 px-4 py-3 shadow-sm backdrop-blur"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-100/70">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-[440px]">
            <div className="mb-8 flex flex-col items-center text-center lg:hidden">
              <Image
                src="/byte2life-mark.svg"
                alt="Byte2Life"
                width={68}
                height={68}
                priority
                className="mb-4 h-16 w-16 rounded-2xl shadow-md"
              />
              <h1 className="text-3xl font-black tracking-normal text-brand-purple">
                Byte<span className="text-brand-orange">2</span>Life
              </h1>
              <p className="mt-2 text-sm font-medium text-slate-600">
                Plataforma de gerenciamento 3D
              </p>
            </div>

            <div className="mb-8 hidden text-left lg:block">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-orange">
                Login
              </p>
              <h2 className="mt-2 text-4xl font-black tracking-normal text-brand-purple">
                Acesse sua conta
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Use seu email ou Google para continuar.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(46,2,73,0.12)] sm:p-8">
              <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                  className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors ${
                    mode === "login"
                      ? "bg-white text-brand-purple shadow-sm"
                      : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  <LogIn className="h-4 w-4" />
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                  className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors ${
                    mode === "register"
                      ? "bg-white text-brand-purple shadow-sm"
                      : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  <UserPlus className="h-4 w-4" />
                  Criar conta
                </button>
              </div>

              {!authConfigured && (
                <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-6 text-amber-900">
                  Configure as variaveis do Firebase na Vercel para liberar o login.
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={submitting}
                className="mb-5 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 shadow-sm transition-colors hover:border-brand-purple/50 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Chrome className="h-5 w-5 text-blue-600" />
                Continuar com Google
              </button>

              <div className="mb-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  ou
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      placeholder="Minimo 6 caracteres"
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-11 text-base font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-purple focus:ring-4 focus:ring-brand-purple/10"
                    />
                  </div>
                </div>

                {mode === "register" && (
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-800">
                      Confirmar senha
                    </label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        required
                        autoComplete="new-password"
                        placeholder="Repita a senha"
                        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-11 text-base font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-purple focus:ring-4 focus:ring-brand-purple/10"
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-700">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-purple font-bold text-white shadow-lg shadow-brand-purple/20 transition-colors hover:bg-brand-purple-light disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : mode === "login" ? (
                    <LogIn className="h-5 w-5" />
                  ) : (
                    <UserPlus className="h-5 w-5" />
                  )}
                  {mode === "login" ? "Entrar" : "Criar conta"}
                </button>
              </form>
            </div>
          </div>
        </main>
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
