"use client";

import {
    getDefaultAiOrchestratorBaseUrl,
    getPublicBotInvite,
    resolveAiOrchestratorAssetUrl,
    sendPublicBotInviteMessage,
    uploadPublicBotInviteAttachment,
    type BotConversation,
    type BotConversationAttachment,
    type BotConversationMessage,
    type BotPublicInvite,
} from "@/services/aiOrchestrator.service";
import {
    Bot,
    Clock3,
    LoaderCircle,
    Paperclip,
    SendHorizontal,
    ShieldCheck,
    Sparkles,
    WifiOff,
    X,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const MAX_PUBLIC_ATTACHMENTS = 3;
const PUBLIC_ATTACHMENT_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.stl,.obj,.3mf";

interface PendingAttachment {
  id: string;
  file: File;
}

const STATE_LABELS: Record<string, string> = {
  new_lead: "Novo lead",
  collecting_data: "Coletando dados",
  awaiting_team_quote: "Aguardando equipe",
  ready_to_create_sale: "Pronta para venda",
  sale_created: "Venda criada",
  human_handoff: "Atendimento humano",
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatStateLabel(value?: string | null) {
  if (!value) return "—";
  return STATE_LABELS[value] || value.replaceAll("_", " ");
}

function getDisplayText(text?: string | null) {
  if (!text) return "";
  const cleaned = text.replaceAll(/\[IMAGEM_GERADA:[^\]]+\]/g, "").trim();
  if (cleaned) return cleaned;
  if (text.includes("[IMAGEM_GERADA:")) {
    return "Prévia gerada pela Byte2Life.";
  }
  return "";
}

function getGeneratedImageUrl(baseUrl: string, text?: string | null) {
  if (!text) return null;
  const match = text.match(/\[IMAGEM_GERADA:([^\]]+)\]/);
  if (!match?.[1]) return null;
  return resolveAiOrchestratorAssetUrl(baseUrl, match[1]);
}

function isImageAttachment(attachment?: BotConversationAttachment | null) {
  const source = [
    attachment?.type || "",
    attachment?.ext || "",
    attachment?.filename || "",
    attachment?.url || "",
  ]
    .join(" ")
    .toLowerCase();

  return /(image|generated_image|\.png|\.jpe?g|\.gif|\.webp)/.test(source);
}

function attachmentLabel(attachment?: BotConversationAttachment | null) {
  if (!attachment) return "anexo";
  return attachment.filename || attachment.url?.split("/").pop() || "anexo";
}

function getMessageAttachments(
  baseUrl: string,
  message: BotConversationMessage,
) {
  return (Array.isArray(message.attachments) ? message.attachments : []).map(
    (attachment) => ({
      ...attachment,
      absoluteUrl: resolveAiOrchestratorAssetUrl(baseUrl, attachment.url),
    }),
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(new Error(`Não foi possível ler ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function formatInviteError(message?: string | null) {
  const raw = String(message || "").trim();
  if (!raw) return "Não foi possível abrir esta conversa pública.";
  if (raw.includes("public_invite_expired")) {
    return "Este link público expirou.";
  }
  if (raw.includes("public_invite_revoked")) {
    return "Este link público foi revogado.";
  }
  if (raw.includes("public_invite_limit_reached")) {
    return "Este link público já atingiu o limite de mensagens.";
  }
  if (raw.includes("public_invite_disabled")) {
    return "Este link público está desabilitado.";
  }
  return raw;
}

function ChatBubble({
  baseUrl,
  message,
}: Readonly<{
  baseUrl: string;
  message: BotConversationMessage;
}>) {
  const outbound = message.direction === "outbound";
  const previewUrl = getGeneratedImageUrl(baseUrl, message.text);
  const attachments = getMessageAttachments(baseUrl, message);
  const text = getDisplayText(message.text);
  const timestamp = message.sent_at || message.received_at;

  return (
    <div className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`w-full max-w-2xl rounded-[1.75rem] border px-4 py-4 shadow-sm ${
          outbound
            ? "border-brand-purple/20 bg-brand-purple text-white"
            : "border-gray-200 bg-white text-gray-900"
        }`}
      >
        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em]">
          <span
            className={`inline-flex items-center gap-2 font-semibold ${outbound ? "text-brand-orange" : "text-brand-purple"}`}
          >
            {outbound ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
            {outbound ? "Byte2Life" : "Você"}
          </span>

          <span className={outbound ? "text-white/65" : "text-gray-500"}>
            <Clock3 className="mr-1 inline h-3.5 w-3.5" />
            {formatDateTime(timestamp)}
          </span>
        </div>

        {text && (
          <p
            className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed ${outbound ? "text-white/90" : "text-gray-700"}`}
          >
            {text}
          </p>
        )}

        {previewUrl && (
          <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Prévia gerada"
              className="max-h-[24rem] w-full object-cover"
            />
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {attachments.map((attachment) => {
              const imageAttachment = isImageAttachment(attachment);

              if (imageAttachment && attachment.absoluteUrl) {
                return (
                  <a
                    key={`${attachment.url || attachment.filename}`}
                    href={attachment.absoluteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`overflow-hidden rounded-[1.25rem] border ${outbound ? "border-white/15 bg-white/10" : "border-gray-200 bg-gray-50"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachment.absoluteUrl}
                      alt={attachmentLabel(attachment)}
                      className="h-44 w-full object-cover"
                    />
                    <div
                      className={`px-3 py-2 text-xs font-semibold ${outbound ? "text-white/85" : "text-gray-700"}`}
                    >
                      {attachmentLabel(attachment)}
                    </div>
                  </a>
                );
              }

              return (
                <a
                  key={`${attachment.url || attachment.filename}`}
                  href={attachment.absoluteUrl || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={`rounded-[1.25rem] border px-3 py-3 ${outbound ? "border-white/15 bg-white/10 text-white/85" : "border-gray-200 bg-gray-50 text-gray-700"}`}
                >
                  <div className="flex items-start gap-3">
                    <Paperclip className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {attachmentLabel(attachment)}
                      </p>
                      <p
                        className={`mt-1 text-xs ${outbound ? "text-white/65" : "text-gray-500"}`}
                      >
                        Arquivo de referência
                      </p>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublicInvitePage() {
  const params = useParams<{ inviteToken: string }>();
  const inviteToken = decodeURIComponent(String(params?.inviteToken || ""));
  const baseUrl = getDefaultAiOrchestratorBaseUrl();
  const [conversation, setConversation] = useState<BotConversation | null>(
    null,
  );
  const [invite, setInvite] = useState<BotPublicInvite | null>(null);
  const [message, setMessage] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadConversation(showSpinner = false) {
      if (!inviteToken) {
        setError("Link público inválido.");
        setLoading(false);
        return;
      }

      if (showSpinner) setLoading(true);

      try {
        const result = await getPublicBotInvite(baseUrl, inviteToken);
        if (ignore) return;
        setConversation(result.conversation);
        setInvite(result.invite);
        setError(null);
      } catch (loadError) {
        if (ignore) return;
        setError(
          formatInviteError(
            loadError instanceof Error ? loadError.message : undefined,
          ),
        );
      } finally {
        if (!ignore && showSpinner) setLoading(false);
      }
    }

    loadConversation(true);
    const timer = window.setInterval(() => {
      void loadConversation(false);
    }, 8000);

    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [baseUrl, inviteToken]);

  const remainingMessages = invite?.remaining_messages ?? 0;
  const canSend = useMemo(
    () => !loading && !sending && !error && remainingMessages > 0,
    [error, loading, remainingMessages, sending],
  );

  function handleAttachmentSelection(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    setPendingAttachments((current) => {
      const slotsLeft = Math.max(0, MAX_PUBLIC_ATTACHMENTS - current.length);
      const nextFiles = selectedFiles.slice(0, slotsLeft).map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
      }));
      return [...current, ...nextFiles];
    });

    event.target.value = "";
  }

  function removePendingAttachment(attachmentId: string) {
    setPendingAttachments((current) =>
      current.filter((attachment) => attachment.id !== attachmentId),
    );
  }

  async function handleSendMessage() {
    const trimmed = message.trim();
    if ((!trimmed && pendingAttachments.length === 0) || !canSend) return;

    try {
      setSending(true);
      const uploadedAttachments: BotConversationAttachment[] = [];

      for (const attachment of pendingAttachments) {
        const data = await readFileAsDataUrl(attachment.file);
        const uploaded = await uploadPublicBotInviteAttachment(
          baseUrl,
          inviteToken,
          {
            filename: attachment.file.name,
            data,
          },
        );
        uploadedAttachments.push(uploaded);
      }

      const result = await sendPublicBotInviteMessage(baseUrl, inviteToken, {
        message: trimmed,
        attachments: uploadedAttachments,
      });
      setConversation(result.conversation);
      setInvite(result.invite);
      setMessage("");
      setPendingAttachments([]);
      setError(null);
    } catch (sendError) {
      setError(
        formatInviteError(
          sendError instanceof Error ? sendError.message : undefined,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,153,0,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(46,2,73,0.18),transparent_26%),linear-gradient(180deg,#f8f7fb_0%,#ffffff_42%,#f6efe8_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-brand-purple/10 bg-white shadow-[0_24px_60px_-32px_rgba(46,2,73,0.28)]">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(255,153,0,0.18),transparent_35%),linear-gradient(135deg,rgba(46,2,73,0.96),rgba(87,10,133,0.92))] px-6 py-7 text-white sm:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Canal público seguro
                </span>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold sm:text-4xl">
                    Converse com a Byte2Life
                  </h1>
                  <p className="max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
                    Este link abre um atendimento de demonstração sem login. O
                    canal é restrito a pedidos, orçamento e contexto comercial
                    de impressão 3D.
                  </p>
                </div>
              </div>

              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${error ? "border-red-200/50 bg-red-500/10 text-red-100" : "border-emerald-200/30 bg-emerald-400/10 text-emerald-50"}`}
              >
                {error ? (
                  <WifiOff className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
                {error ? "Indisponível" : "Conectado ao orquestrador local"}
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-brand-purple/10 bg-white px-5 py-5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Estado
              </p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {formatStateLabel(conversation?.state)}
              </p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Link
              </p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {invite?.label || "Convite público"}
              </p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Mensagens restantes
              </p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {remainingMessages}
              </p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Expiração
              </p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {formatDateTime(invite?.expires_at)}
              </p>
            </div>
          </div>
        </section>

        {error && (
          <section className="rounded-[2rem] border border-red-200 bg-red-50 px-5 py-5 text-sm text-red-700 shadow-sm">
            {error}
          </section>
        )}

        <section className="rounded-[2rem] border border-gray-200 bg-white p-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.3)] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Histórico</h2>
              <p className="text-sm text-gray-500">
                Acompanhe o atendimento e responda pelo mesmo link.
              </p>
            </div>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
              {conversation?.messages?.length || 0} mensagem(ns)
            </span>
          </div>

          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-gray-500">
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              Carregando conversa...
            </div>
          ) : (
            <div className="space-y-4">
              {(conversation?.messages || []).map((item, index) => (
                <ChatBubble
                  key={
                    item.message_id ||
                    `${index}-${item.sent_at || item.received_at}`
                  }
                  baseUrl={baseUrl}
                  message={item}
                />
              ))}

              {!conversation?.messages?.length && (
                <div className="rounded-[1.5rem] border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  Ainda não há mensagens neste convite. Escreva abaixo para
                  começar.
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-gray-200 bg-white p-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.3)] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Enviar mensagem
              </h2>
              <p className="text-sm text-gray-500">
                Explique o produto, material, prazo ou envie imagens e arquivos
                de referência para o orçamento desejado.
              </p>
            </div>
            <span className="rounded-full border border-brand-purple/15 bg-brand-purple/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-purple">
              {remainingMessages} restante(s)
            </span>
          </div>

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ex.: Quero um orçamento para um organizador de mesa em PLA branco com 22 cm de largura."
            className="min-h-32 w-full rounded-[1.5rem] border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />

          <div className="mt-4 rounded-[1.5rem] border border-dashed border-brand-purple/20 bg-brand-purple/[0.03] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Anexar referências
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Envie até {MAX_PUBLIC_ATTACHMENTS} arquivo(s): imagens, STL,
                  OBJ ou 3MF.
                </p>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-brand-purple/15 bg-white px-4 py-3 text-sm font-semibold text-brand-purple transition hover:border-brand-purple/30 hover:bg-brand-purple/[0.04]">
                <Paperclip className="h-4 w-4" />
                Escolher arquivos
                <input
                  type="file"
                  accept={PUBLIC_ATTACHMENT_ACCEPT}
                  multiple
                  onChange={handleAttachmentSelection}
                  className="hidden"
                />
              </label>
            </div>

            {pendingAttachments.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {pendingAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm"
                  >
                    <Paperclip className="h-4 w-4 text-brand-purple" />
                    <span className="max-w-48 truncate">
                      {attachment.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(attachment.id)}
                      className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                      aria-label={`Remover ${attachment.file.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Esse canal não aceita comandos internos nem pedidos fora do escopo
              comercial da Byte2Life.
            </p>

            <button
              type="button"
              onClick={handleSendMessage}
              disabled={
                !canSend || (!message.trim() && pendingAttachments.length === 0)
              }
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-purple px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-purple-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="h-4 w-4" />
              )}
              Enviar mensagem
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
