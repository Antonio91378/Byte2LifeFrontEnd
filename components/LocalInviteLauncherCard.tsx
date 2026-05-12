"use client";

import { Copy, ExternalLink, Link2, LoaderCircle } from "lucide-react";

interface LocalInviteLauncherCardProps {
  inviteLabel: string;
  inviteHours: string;
  inviteLoading: boolean;
  inviteUrl: string | null;
  onInviteLabelChange: (value: string) => void;
  onInviteHoursChange: (value: string) => void;
  onGenerateAndOpen: () => void;
  onCopyInviteLink: () => void;
}

export default function LocalInviteLauncherCard({
  inviteLabel,
  inviteHours,
  inviteLoading,
  inviteUrl,
  onInviteLabelChange,
  onInviteHoursChange,
  onGenerateAndOpen,
  onCopyInviteLink,
}: Readonly<LocalInviteLauncherCardProps>) {
  return (
    <section className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.3)]">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
        <Link2 className="h-4 w-4 text-brand-orange" />
        Chat publico allowanonimos
      </div>

      <h2 className="mt-2 text-xl font-bold text-gray-900">
        Abrir conversa publica completa
      </h2>

      <p className="mt-2 text-sm leading-relaxed text-gray-500">
        Crie o convite sem autenticacao e abra a mesma tela publica de
        allowanonimos em uma nova guia. A pagina abre no frontend atual, e o
        endpoint do ai-orchestrator so define de onde a conversa sera carregada.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-gray-700">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            Rótulo
          </span>
          <input
            value={inviteLabel}
            onChange={(event) => onInviteLabelChange(event.target.value)}
            placeholder="Demo evento, cliente teste..."
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />
        </label>

        <label className="text-sm text-gray-700">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            Expira em horas
          </span>
          <input
            type="number"
            min={1}
            value={inviteHours}
            onChange={(event) => onInviteHoursChange(event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onGenerateAndOpen}
          disabled={inviteLoading}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand-orange px-4 py-3 text-sm font-semibold text-brand-purple transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {inviteLoading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
          Criar e abrir conversa
        </button>

        {inviteUrl && (
          <button
            type="button"
            onClick={onCopyInviteLink}
            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-purple/25 hover:text-brand-purple"
          >
            <Copy className="h-4 w-4" />
            Copiar link da conversa
          </button>
        )}
      </div>

      {inviteUrl && (
        <div className="mt-4 rounded-[1.5rem] border border-brand-orange/20 bg-brand-orange/10 px-4 py-4 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">Conversa pronta</p>
          <p className="mt-1 text-sm text-gray-600">
            Esse link abre a mesma interface completa do convite publico neste
            frontend.
          </p>
          <a
            href={inviteUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block break-all text-brand-purple underline-offset-4 hover:underline"
          >
            {inviteUrl}
          </a>
        </div>
      )}
    </section>
  );
}