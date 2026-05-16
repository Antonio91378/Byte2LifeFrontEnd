"use client";

import LocalInviteLauncherCard from "@/components/LocalInviteLauncherCard";
import { EventLog } from "@/components/orchestrator-flow/EventLog";
import { FlowCanvas } from "@/components/orchestrator-flow/FlowCanvas";
import { HealthBadge, HealthCheckModal } from "@/components/orchestrator-flow/HealthCheckModal";
import { ResourceStatusBadge } from "@/components/orchestrator-flow/ResourceStatus";
import { useDialog } from "@/context/DialogContext";
import {
    createPublicBotInvite,
    deleteBotConversation,
    getBotConversation,
  getBotTrainingReviewPrompt,
    getBotRuntimeStatus,
    getStoredAiOrchestratorBaseUrl,
    listBotConversations,
    resolveAiOrchestratorAssetUrl,
    saveAiOrchestratorBaseUrl,
    saveBotConversationDeveloperNote,
  setBotConversationTrainingVerification,
    type BotConversation,
    type BotConversationAttachment,
    type BotConversationBlocker,
    type BotConversationMessage,
    type BotConversationSummary,
    type BotImagePromptTrace,
    type BotLlmPromptTrace,
    type BotRuntimeStatus,
  type BotTrainingVerification,
  type StageEvent,
} from "@/services/aiOrchestrator.service";
import {
    Bot,
    ChevronDown,
    ChevronUp,
    Clock3,
    Copy,
    Download,
    ExternalLink,
    Filter,
    Link2,
    LoaderCircle,
    MessageSquareText,
    Paperclip,
    Phone,
    RefreshCcw,
    Search,
    Server,
    ShieldCheck,
    Sparkles,
    Trash2,
    UserRound,
    WifiOff,
} from "lucide-react";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { useResizablePanel } from "@/hooks/useResizablePanel";

interface EnrichedAttachment extends BotConversationAttachment {
  absoluteUrl: string | null;
}

function LogResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, zIndex: 30,
        cursor: 'ew-resize', background: hovered ? '#c026d344' : 'transparent',
        transition: 'background 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {hovered && <div style={{ width: 2, height: 40, borderRadius: 2, background: '#c026d3', boxShadow: '0 0 8px #c026d3' }} />}
    </div>
  );
}

const PAGE_SIZE = 12;

const STATE_LABELS: Record<string, string> = {
  new_lead: "Novo lead",
  collecting_data: "Coletando dados",
  awaiting_team_quote: "Aguardando equipe",
  ready_to_create_sale: "Pronta para venda",
  sale_created: "Venda criada",
  human_handoff: "Atendimento humano",
};

const CHANNEL_LABELS: Record<string, string> = {
  manual_html: "HTML manual",
  manual_dashboard: "Dashboard dev",
  allowanonimos: "Link público",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  image: "Imagem enviada",
  generated_image: "Prévia gerada",
  model: "Modelo 3D",
  file: "Arquivo",
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

function formatCurrency(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatStateLabel(value?: string | null) {
  if (!value) return "—";
  return STATE_LABELS[value] || value.replaceAll("_", " ");
}

function formatChannelLabel(value?: string | null) {
  if (!value) return "—";
  return CHANNEL_LABELS[value] || value;
}

function formatAttachmentTypeLabel(value?: string | null) {
  if (!value) return "—";
  return ATTACHMENT_TYPE_LABELS[value] || value.replaceAll("_", " ");
}

function formatPromptTraceRole(value?: string | null) {
  switch (value) {
    case "system":
      return "System prompt";
    case "assistant":
      return "Histórico do bot";
    case "user":
      return "Histórico / input do cliente";
    default:
      return value || "Mensagem";
  }
}

function formatPromptTraceStatus(value?: string | null) {
  switch (value) {
    case "success":
      return "Sucesso";
    case "unavailable":
      return "Indisponível";
    case "error":
      return "Erro";
    default:
      return value || "—";
  }
}

function formatPromptReferenceMode(value?: string | null) {
  switch (value) {
    case "reference_image":
      return "Com referência visual";
    case "text_only":
      return "Só descrição textual";
    default:
      return value || "—";
  }
}

function buildLlmTraceClipboardText(trace: BotLlmPromptTrace) {
  return JSON.stringify(trace, null, 2);
}

function buildImageTraceClipboardText(trace: BotImagePromptTrace) {
  return JSON.stringify(trace, null, 2);
}

function isConversationVerified(
  trainingVerification?: BotTrainingVerification | null,
) {
  return trainingVerification?.verified !== false;
}

function getTrainingBadgeTone(verified: boolean, selected = false) {
  if (verified) {
    return selected
      ? "border-emerald-200/35 bg-emerald-500/15 text-emerald-50"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return selected
    ? "border-amber-200/35 bg-amber-500/15 text-amber-50"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function getTrainingBadgeLabel(verified: boolean) {
  return verified ? "Verificada" : "Pendente de treino";
}

async function copyTextToClipboard(value: string) {
  if (
    !globalThis.navigator?.clipboard ||
    typeof globalThis.navigator.clipboard.writeText !== "function"
  ) {
    throw new Error("Clipboard API indisponivel neste navegador.");
  }

  await globalThis.navigator.clipboard.writeText(value);
}

function formatBlockerOwner(value?: string | null) {
  if (!value) return "—";

  const labels: Record<string, string> = {
    none: "Sem bloqueio",
    customer: "Cliente",
    team: "Equipe real",
    system: "Sistema",
    bot: "Bot",
  };

  return labels[value] || value;
}

function normalizeBaseUrl(value?: string | null) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function resolveInviteToken(url?: string | null, token?: string | null) {
  const normalizedToken = String(token || "").trim();
  if (normalizedToken) return normalizedToken;

  const normalizedUrl = String(url || "").trim();
  const match = /\/allowanonimos\/([^?]+)/.exec(normalizedUrl);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function buildFrontendInviteUrl(inviteToken: string, orchestratorBaseUrl: string) {
  if (globalThis.window === undefined) return null;

  const url = new URL(
    `/allowanonimos/${encodeURIComponent(inviteToken)}`,
    globalThis.window.location.origin,
  );
  const normalizedOrchestratorBaseUrl = normalizeBaseUrl(orchestratorBaseUrl);
  if (normalizedOrchestratorBaseUrl) {
    url.searchParams.set("orchestrator", normalizedOrchestratorBaseUrl);
  }

  return url.toString();
}

function getBlockerTone(blocker?: BotConversationBlocker | null) {
  switch (blocker?.owner) {
    case "team":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "customer":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "system":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "none":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-gray-200 bg-gray-100 text-gray-700";
  }
}

function getMessageTimestamp(message: BotConversationMessage) {
  return message.sent_at || message.received_at || null;
}

function getDisplayText(text?: string | null) {
  if (!text) return "";
  const cleaned = text.replaceAll(/\[IMAGEM_GERADA:[^\]]+\]/g, "").trim();
  if (cleaned) return cleaned;
  if (text.includes("[IMAGEM_GERADA:")) {
    return "Prévia gerada pelo orquestrador.";
  }
  return "";
}

function isImageAttachment(attachment: EnrichedAttachment) {
  const source =
    `${attachment.type || ""} ${attachment.filename || ""} ${attachment.url || ""}`.toLowerCase();
  return /(image|generated_image|\.png|\.jpe?g|\.gif|\.webp)/.test(source);
}

function normalizeAttachment(
  baseUrl: string,
  attachment?: BotConversationAttachment | null,
): EnrichedAttachment | null {
  if (!attachment) return null;
  return {
    ...attachment,
    absoluteUrl: resolveAiOrchestratorAssetUrl(baseUrl, attachment.url),
  };
}

function buildAttachmentKey(
  attachment: BotConversationAttachment | EnrichedAttachment,
) {
  return [
    attachment.type || "unknown",
    attachment.filename || "",
    attachment.url || "",
  ].join("|");
}

function getGeneratedAttachments(baseUrl: string, text?: string | null) {
  if (!text) return [];

  const attachments: EnrichedAttachment[] = [];
  for (const match of text.matchAll(/\[IMAGEM_GERADA:([^\]]+)\]/g)) {
    const normalized = normalizeAttachment(baseUrl, {
      type: "generated_image",
      url: match[1],
      filename: match[1].split("/").pop() || "preview.png",
    });

    if (normalized) {
      attachments.push(normalized);
    }
  }

  return attachments;
}

function getMessageAttachments(
  baseUrl: string,
  message: BotConversationMessage,
) {
  const attachments: EnrichedAttachment[] = [];

  for (const attachment of Array.isArray(message.attachments)
    ? message.attachments
    : []) {
    const normalized = normalizeAttachment(baseUrl, attachment);
    if (normalized) {
      attachments.push(normalized);
    }
  }

  for (const attachment of getGeneratedAttachments(baseUrl, message.text)) {
    attachments.push(attachment);
  }

  const unique = new Map<string, EnrichedAttachment>();
  for (const attachment of attachments) {
    unique.set(buildAttachmentKey(attachment), attachment);
  }
  return [...unique.values()];
}

function getConversationAttachments(
  baseUrl: string,
  conversation: BotConversation,
) {
  const unique = new Map<string, EnrichedAttachment>();

  for (const attachment of Array.isArray(conversation.attachments)
    ? conversation.attachments
    : []) {
    const normalized = normalizeAttachment(baseUrl, attachment);
    if (normalized) unique.set(buildAttachmentKey(normalized), normalized);
  }

  const lastImage = normalizeAttachment(baseUrl, conversation.last_image);
  if (lastImage) {
    unique.set(buildAttachmentKey(lastImage), lastImage);
  }

  for (const message of Array.isArray(conversation.messages)
    ? conversation.messages
    : []) {
    for (const attachment of getMessageAttachments(baseUrl, message)) {
      unique.set(buildAttachmentKey(attachment), attachment);
    }
  }

  return [...unique.values()];
}

function attachmentLabel(attachment: EnrichedAttachment) {
  return attachment.filename || attachment.url?.split("/").pop() || "anexo";
}

function AttachmentCard({
  attachment,
}: Readonly<{ attachment: EnrichedAttachment }>) {
  const image = isImageAttachment(attachment);
  const content = (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-purple/25 hover:shadow-lg">
      {image && attachment.absoluteUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachment.absoluteUrl}
          alt={attachmentLabel(attachment)}
          className="h-40 w-full object-cover"
        />
      ) : (
        <div className="flex h-40 items-center justify-center bg-gradient-to-br from-brand-purple/10 via-white to-brand-orange/10 text-brand-purple">
          <Paperclip className="h-10 w-10" />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {attachmentLabel(attachment)}
          </p>
          <p className="text-xs uppercase tracking-[0.14em] text-gray-500">
            {attachment.type || "arquivo"}
          </p>
        </div>

        <div className="flex items-center gap-2 text-gray-500">
          {attachment.absoluteUrl && (
            <>
              <ExternalLink className="h-4 w-4" />
              <Download className="h-4 w-4" />
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (!attachment.absoluteUrl) {
    return content;
  }

  return (
    <a
      href={attachment.absoluteUrl}
      target="_blank"
      rel="noreferrer"
      className="block"
    >
      {content}
    </a>
  );
}

export default function BotChatsPage() {
  const { showAlert, showConfirm } = useDialog();
  const [baseUrlInput, setBaseUrlInput] = useState(() =>
    getStoredAiOrchestratorBaseUrl(),
  );
  const [baseUrl, setBaseUrl] = useState(() =>
    getStoredAiOrchestratorBaseUrl(),
  );
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [attachmentTypeFilter, setAttachmentTypeFilter] = useState("all");
  const [trainingVerificationFilter, setTrainingVerificationFilter] =
    useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [conversations, setConversations] = useState<BotConversationSummary[]>(
    [],
  );
  const [totalConversations, setTotalConversations] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [selectedConversation, setSelectedConversation] =
    useState<BotConversation | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [runtimeStatus, setRuntimeStatus] = useState<BotRuntimeStatus | null>(
    null,
  );
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(true);
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteHours, setInviteHours] = useState("72");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<
    string | null
  >(null);
  const [trainingPromptLoading, setTrainingPromptLoading] = useState(false);
  const [lastPromptMeta, setLastPromptMeta] = useState<{
    conversationId: string;
    conversationLabel: string;
    totalPending: number;
    timestamp: string;
  } | null>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('superPromptMeta') : null;
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [trainingVerificationSavingId, setTrainingVerificationSavingId] =
    useState<string | null>(null);
  const [developerNoteInput, setDeveloperNoteInput] = useState("");
  const [developerNoteSaving, setDeveloperNoteSaving] = useState(false);
  const [promptInspectorExpanded, setPromptInspectorExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'flow'>('list');
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [flowFullscreen, setFlowFullscreen] = useState(false);
  const [flowEvents, setFlowEvents] = useState<StageEvent[]>([]);
  const [watchedInviteUrl, setWatchedInviteUrl] = useState<string | null>(null);
  const [creatingMonitoredChat, setCreatingMonitoredChat] = useState(false);
  const { width: logPanelWidth, onMouseDown: onLogResizeMouseDown } = useResizablePanel(280, 180, 640);
  const deferredSearch = useDeferredValue(search);

  function syncConversationIntoDashboard(conversation: BotConversation) {
    setSelectedConversation((current) =>
      current?.conversation_id === conversation.conversation_id
        ? conversation
        : current,
    );

    setConversations((current) =>
      current.map((item) =>
        item.conversation_id === conversation.conversation_id
          ? {
              ...item,
              state: conversation.state || item.state,
              channel: conversation.channel || item.channel,
              updated_at: conversation.updated_at || item.updated_at,
              public_invite:
                conversation.access?.public_invite || item.public_invite || null,
              access_mode: conversation.access?.mode || item.access_mode || null,
              training_verification:
                conversation.training_verification ||
                item.training_verification ||
                null,
            }
          : item,
      ),
    );
  }

  // Suppress body scroll while flow overlay is open
  useEffect(() => {
    if (viewMode === 'flow') {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [viewMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    attachmentTypeFilter,
    baseUrl,
    channelFilter,
    deferredSearch,
    stateFilter,
    trainingVerificationFilter,
  ]);

  useEffect(() => {
    let ignore = false;

    async function loadRuntimeStatus() {
      setRuntimeLoading(true);
      setRuntimeError(null);

      try {
        const result = await getBotRuntimeStatus(baseUrl);
        if (ignore) return;
        setRuntimeStatus(result);
      } catch (loadError) {
        if (ignore) return;
        setRuntimeStatus(null);
        setRuntimeError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível consultar o orquestrador local.",
        );
      } finally {
        if (!ignore) setRuntimeLoading(false);
      }
    }

    async function loadConversations() {
      setListLoading(true);
      setError(null);

      try {
        const result = await listBotConversations(baseUrl, {
          search: deferredSearch || undefined,
          state: stateFilter === "all" ? undefined : stateFilter,
          channel: channelFilter === "all" ? undefined : channelFilter,
          attachmentType:
            attachmentTypeFilter === "all" ? undefined : attachmentTypeFilter,
          trainingVerification:
            trainingVerificationFilter === "all"
              ? undefined
              : trainingVerificationFilter,
          page: currentPage,
          limit: PAGE_SIZE,
        });

        if (ignore) return;
        setConversations(result.conversations);
        setTotalConversations(result.total);
        setTotalPages(result.total_pages);
        setHasNextPage(result.has_next_page);
        setHasPreviousPage(result.has_previous_page);
        if (result.page !== currentPage) {
          setCurrentPage(result.page);
        }
      } catch (loadError) {
        if (ignore) return;
        setConversations([]);
        setTotalConversations(0);
        setTotalPages(0);
        setHasNextPage(false);
        setHasPreviousPage(false);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar as conversas.",
        );
      } finally {
        if (!ignore) setListLoading(false);
      }
    }

    loadRuntimeStatus();
    loadConversations();
    return () => {
      ignore = true;
    };
  }, [
    attachmentTypeFilter,
    baseUrl,
    channelFilter,
    currentPage,
    deferredSearch,
    refreshTick,
    stateFilter,
    trainingVerificationFilter,
  ]);

  useEffect(() => {
    if (!conversations.length) {
      setSelectedConversation(null);
      if (selectedConversationId) {
        startTransition(() => setSelectedConversationId(null));
      }
      return;
    }

    if (
      selectedConversationId &&
      conversations.some(
        (conversation) =>
          conversation.conversation_id === selectedConversationId,
      )
    ) {
      return;
    }

    startTransition(() => {
      setSelectedConversationId(conversations[0].conversation_id);
    });
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      setSelectedConversation(null);
      setDeveloperNoteInput("");
      return;
    }

    const conversationId = selectedConversationId;

    let ignore = false;

    async function loadConversation() {
      setDetailLoading(true);

      try {
        const result = await getBotConversation(baseUrl, conversationId);
        if (ignore) return;
        setSelectedConversation(result.conversation);
        setDeveloperNoteInput(result.conversation.developer_note?.note || "");
      } catch (loadError) {
        if (ignore) return;
        setSelectedConversation(null);
        setDeveloperNoteInput("");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar o detalhe da conversa.",
        );
      } finally {
        if (!ignore) setDetailLoading(false);
      }
    }

    loadConversation();
    return () => {
      ignore = true;
    };
  }, [baseUrl, refreshTick, selectedConversationId]);

  useEffect(() => {
    setPromptInspectorExpanded(false);
  }, [selectedConversationId]);

  const availableChannels = [
    ...new Set([
      ...Object.keys(CHANNEL_LABELS),
      ...conversations.map((item) => item.channel),
    ]),
  ]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  const availableAttachmentTypes = [
    ...new Set([
      ...Object.keys(ATTACHMENT_TYPE_LABELS),
      ...conversations.flatMap((item) => item.attachment_types || []),
    ]),
  ].sort((left, right) => left.localeCompare(right));

  const allAttachments = selectedConversation
    ? getConversationAttachments(baseUrl, selectedConversation)
    : [];
  const llmPromptTraces = selectedConversation?.prompt_traces?.llm || [];
  const imagePromptTraces =
    selectedConversation?.prompt_traces?.image_generation || [];
  const runtimeIsOnline =
    !runtimeError && runtimeStatus?.heartbeat?.status === "online";
  const filterCardClass =
    "flex min-h-[9.25rem] min-w-0 flex-col rounded-3xl border border-gray-200 bg-gray-50/80 p-4 text-sm text-gray-700";
  const filterLabelClass =
    "mb-3 flex min-h-[2.75rem] items-start gap-2 text-xs font-semibold uppercase tracking-[0.18em] leading-relaxed text-gray-500";
  const filterControlClass =
    "mt-auto w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20";

  let listContent: React.ReactNode;
  if (listLoading) {
    listContent = (
      <div className="flex min-h-48 items-center justify-center text-sm text-gray-500">
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        Carregando conversas...
      </div>
    );
  } else if (conversations.length === 0) {
    listContent = (
      <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
        Nenhuma conversa encontrada para os filtros atuais.
      </div>
    );
  } else {
    listContent = (
      <div className="space-y-3">
        {conversations.map((conversation) => {
          const selected =
            conversation.conversation_id === selectedConversationId;
          const verified = isConversationVerified(
            conversation.training_verification,
          );
          const trainingBadgeDisabled =
            trainingVerificationSavingId === conversation.conversation_id;

          return (
            <div
              key={conversation.conversation_id}
              className={`w-full rounded-3xl border px-4 py-4 text-left transition-all duration-300 ${
                selected
                  ? "border-brand-purple/30 bg-brand-purple text-white shadow-[0_20px_40px_-28px_rgba(46,2,73,0.85)]"
                  : "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-brand-purple/20 hover:shadow-lg"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex flex-1 flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] ${selected ? "bg-white/14 text-white" : "bg-brand-purple/8 text-brand-purple"}`}
                  >
                    {formatStateLabel(conversation.state)}
                  </span>
                  {conversation.has_generated_image && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] ${selected ? "bg-brand-orange/20 text-brand-orange" : "bg-brand-orange/12 text-brand-orange"}`}
                    >
                      Prévia
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={trainingBadgeDisabled}
                  onClick={() =>
                    void handleToggleTrainingVerification(
                      conversation.conversation_id,
                      verified,
                    )
                  }
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] transition ${getTrainingBadgeTone(verified, selected)} disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  {trainingBadgeDisabled ? (
                    <LoaderCircle className="h-3 w-3 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-3 w-3" />
                  )}
                  {getTrainingBadgeLabel(verified)}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setSelectedConversationId(conversation.conversation_id);
                  });
                }}
                className="mt-3 w-full min-w-0 text-left"
              >
                <p
                  className={`truncate text-sm font-semibold ${selected ? "text-white" : "text-gray-900"}`}
                >
                  {conversation.display_name || conversation.client_name || conversation.conversation_id.slice(0, 20)}
                </p>
                <p
                  className={`mt-1 line-clamp-2 text-sm ${selected ? "text-white/72" : "text-gray-500"}`}
                >
                  {conversation.order_description ||
                    conversation.last_message_preview}
                </p>

                <div
                  className={`mt-3 flex flex-wrap items-center gap-2 text-xs ${selected ? "text-white/72" : "text-gray-500"}`}
                >
                  <span
                    className={`rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.14em] ${selected ? "border-white/15 bg-white/10 text-white/85" : "border-gray-200 bg-gray-50 text-gray-600"}`}
                  >
                    {formatChannelLabel(conversation.channel)}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 font-semibold ${selected ? "border-white/15 bg-white/10 text-white/80" : "border-gray-200 bg-gray-50 text-gray-500"}`}
                  >
                    {formatDateTime(conversation.updated_at)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${selected ? "border-white/15 bg-white/10 text-white/85" : getBlockerTone(conversation.blocker)}`}
                  >
                    {conversation.blocker?.label || "Sem bloqueio"}
                  </span>
                  {conversation.public_invite?.enabled && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${selected ? "bg-brand-orange/18 text-brand-orange" : "bg-brand-orange/12 text-brand-orange"}`}
                    >
                      Link público
                    </span>
                  )}
                </div>

                {conversation.attachment_types.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {conversation.attachment_types
                      .slice(0, 3)
                      .map((attachmentType) => (
                        <span
                          key={`${conversation.conversation_id}-${attachmentType}`}
                          className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${selected ? "bg-white/10 text-white/80" : "bg-gray-100 text-gray-600"}`}
                        >
                          {formatAttachmentTypeLabel(attachmentType)}
                        </span>
                      ))}
                  </div>
                )}

                <div
                  className={`mt-4 grid grid-cols-3 gap-2 text-xs ${selected ? "text-white/70" : "text-gray-500"}`}
                >
                  <div className="rounded-2xl border border-current/10 px-3 py-2">
                    <p className="font-semibold">Mensagens</p>
                    <p className="mt-1 text-sm font-bold">
                      {conversation.message_count}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-current/10 px-3 py-2">
                    <p className="font-semibold">Anexos</p>
                    <p className="mt-1 text-sm font-bold">
                      {conversation.attachment_count}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-current/10 px-3 py-2">
                    <p className="font-semibold">Pendências</p>
                    <p className="mt-1 text-sm font-bold">
                      {conversation.missing_fields_count}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  let detailContent: React.ReactNode;
  if (selectedConversationId === null) {
    detailContent = (
      <div className="flex min-h-[28rem] items-center justify-center px-6 text-center text-sm text-gray-500">
        Escolha uma conversa na coluna ao lado para abrir o histórico.
      </div>
    );
  } else if (detailLoading) {
    detailContent = (
      <div className="flex min-h-[28rem] items-center justify-center px-6 text-sm text-gray-500">
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        Carregando detalhes da conversa...
      </div>
    );
  } else if (selectedConversation === null) {
    detailContent = (
      <div className="flex min-h-[28rem] items-center justify-center px-6 text-sm text-gray-500">
        Não foi possível carregar a conversa selecionada.
      </div>
    );
  } else {
    detailContent = (
      <div className="space-y-6 px-5 py-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Estado
            </p>
            <p className="mt-2 text-base font-bold text-gray-900">
              {formatStateLabel(selectedConversation.state)}
            </p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Canal
            </p>
            <p className="mt-2 text-base font-bold text-gray-900">
              {formatChannelLabel(selectedConversation.channel)}
            </p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Atualização
            </p>
            <p className="mt-2 text-base font-bold text-gray-900">
              {formatDateTime(
                selectedConversation.updated_at ||
                  selectedConversation.last_image?.generated_at ||
                  selectedConversation.created_at,
              )}
            </p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Dono do bloqueio
            </p>
            <p className="mt-2 text-base font-bold text-gray-900">
              {formatBlockerOwner(selectedConversation.blocker?.owner)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-3xl border border-gray-200 bg-white px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              <ShieldCheck className="h-4 w-4 text-brand-purple" />O que impede
              a finalização
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getBlockerTone(selectedConversation.blocker)}`}
              >
                {selectedConversation.blocker?.label || "Sem bloqueio"}
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-600">
                {formatBlockerOwner(selectedConversation.blocker?.owner)}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-gray-600">
              {selectedConversation.blocker?.detail ||
                "Sem pendências registradas nesta conversa."}
            </p>
            {selectedConversation.missing_fields &&
              selectedConversation.missing_fields.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedConversation.missing_fields.map((field) => (
                    <span
                      key={field.path || field.label}
                      className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700"
                    >
                      {field.label || field.path}
                    </span>
                  ))}
                </div>
              )}
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              <Link2 className="h-4 w-4 text-brand-orange" />
              Acesso e venda
            </div>
            <div className="mt-3 space-y-3 text-sm text-gray-600">
              <div>
                <span className="font-semibold text-gray-800">
                  Modo de acesso
                </span>
                <p className="mt-1">
                  {selectedConversation.access?.mode || "Interno / autenticado"}
                </p>
              </div>
              <div>
                <span className="font-semibold text-gray-800">
                  Venda no backend
                </span>
                <p className="mt-1">
                  {selectedConversation.integration?.backend_sale_id ||
                    "Ainda não criada"}
                </p>
              </div>
              {selectedConversation.access?.public_invite?.enabled && (
                <div>
                  <span className="font-semibold text-gray-800">
                    Convite público
                  </span>
                  <p className="mt-1">
                    {selectedConversation.access.public_invite
                      .remaining_messages ?? 0}{" "}
                    mensagem(ns) restante(s)
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Expira em{" "}
                    {formatDateTime(
                      selectedConversation.access.public_invite.expires_at,
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-3xl border border-gray-200 bg-white px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              <UserRound className="h-4 w-4 text-brand-purple" />
              Cliente
            </div>
            <p className="mt-3 text-base font-bold text-gray-900">
              {selectedConversation.extracted_data?.client?.name ||
                "Não identificado"}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <Phone className="h-4 w-4" />
              {selectedConversation.extracted_data?.client?.phoneNumber ||
                "Telefone pendente"}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white px-4 py-4 lg:col-span-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              <Sparkles className="h-4 w-4 text-brand-orange" />
              Pedido e contexto
            </div>
            <p className="mt-3 text-base font-bold text-gray-900">
              {selectedConversation.extracted_data?.order?.description ||
                "Sem descrição"}
            </p>
            <div className="mt-3 grid gap-3 text-sm text-gray-600 sm:grid-cols-3">
              <div>
                <span className="font-semibold text-gray-800">Estilo</span>
                <p className="mt-1">
                  {selectedConversation.extracted_data?.order?.productStyle ||
                    "—"}
                </p>
              </div>
              <div>
                <span className="font-semibold text-gray-800">Valor</span>
                <p className="mt-1">
                  {formatCurrency(
                    selectedConversation.extracted_data?.sale?.saleValue,
                  )}
                </p>
              </div>
              <div>
                <span className="font-semibold text-gray-800">
                  Foto interpretada
                </span>
                <p className="mt-1 line-clamp-2">
                  {selectedConversation.extracted_data?.order
                    ?.referenceImageDescription || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Inspector de prompts
              </h3>
              <p className="text-sm text-gray-500">
                Abra uma visão organizada do que foi enviado ao LLM e do texto
                que alimentou a geração da imagem no fluxo visual.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-brand-purple/15 bg-brand-purple/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-purple">
                LLM {llmPromptTraces.length}
              </span>
              <span className="rounded-full border border-brand-orange/15 bg-brand-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-orange">
                Imagem {imagePromptTraces.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPromptInspectorExpanded((current) => !current)
                }
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-purple/30 hover:text-brand-purple"
              >
                {promptInspectorExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {promptInspectorExpanded
                  ? "Ocultar prompts"
                  : "Visualizar prompts"}
              </button>
            </div>
          </div>

          {promptInspectorExpanded ? (
            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="rounded-3xl border border-gray-200 bg-gray-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">
                      Chamadas ao LLM
                    </h4>
                    <p className="text-sm text-gray-500">
                      Prompt do sistema, histórico enviado e saída estruturada.
                    </p>
                  </div>
                  <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    {llmPromptTraces.length} registro(s)
                  </span>
                </div>

                {llmPromptTraces.length === 0 ? (
                  <div className="mt-4 rounded-3xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
                    Nenhum trace do LLM foi persistido nesta conversa ainda.
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {[...llmPromptTraces].reverse().map((trace, index) => (
                      <div
                        key={trace.trace_id || `${trace.at || "llm"}-${index}`}
                        className="rounded-[1.5rem] border border-gray-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                            <span className="rounded-full border border-brand-purple/15 bg-brand-purple/8 px-2.5 py-1 text-brand-purple">
                              {trace.provider || "LLM"}
                            </span>
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                              {trace.model || "modelo não informado"}
                            </span>
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                              {formatDateTime(trace.at)}
                            </span>
                            {trace.fallback_used && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                                fallback
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              void handleCopyStructuredTrace(
                                "trace do LLM",
                                buildLlmTraceClipboardText(trace),
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-600 transition hover:border-brand-purple/30 hover:text-brand-purple"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copiar
                          </button>
                        </div>

                        <div className="mt-4 space-y-3">
                          {(trace.request_messages || []).map(
                            (message, messageIndex) => (
                              <div
                                key={`${trace.trace_id || index}-${message.role || "role"}-${messageIndex}`}
                                className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                                  <span>
                                    {formatPromptTraceRole(message.role)}
                                  </span>
                                  {typeof message.image_count === "number" &&
                                    message.image_count > 0 && (
                                      <span>
                                        {message.image_count} imagem(ns)
                                      </span>
                                    )}
                                </div>
                                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-700">
                                  {message.content || "—"}
                                </pre>
                              </div>
                            ),
                          )}
                        </div>

                        <div className="mt-4 rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-700">
                          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                            <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1">
                              intenção {trace.output?.intent || "—"}
                            </span>
                            <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1">
                              gerar imagem{" "}
                              {trace.output?.generate_image ? "sim" : "não"}
                            </span>
                            <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1">
                              atendimento humano{" "}
                              {trace.output?.needs_human ? "sim" : "não"}
                            </span>
                          </div>

                          <div className="mt-3 space-y-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                                Reply estruturado
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                                {trace.output?.reply || "—"}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                                Image prompt retornado
                              </p>
                              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-gray-200 bg-white px-3 py-3 text-xs leading-relaxed text-gray-700">
                                {trace.output?.image_prompt || "—"}
                              </pre>
                            </div>

                            {trace.error && (
                              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                                {trace.error}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-gray-200 bg-gray-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">
                      Geração de imagem
                    </h4>
                    <p className="text-sm text-gray-500">
                      Texto que foi para a geração visual e o modo usado na
                      prévia.
                    </p>
                  </div>
                  <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    {imagePromptTraces.length} registro(s)
                  </span>
                </div>

                {imagePromptTraces.length === 0 ? (
                  <div className="mt-4 rounded-3xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
                    Nenhuma tentativa de geração de imagem foi registrada nesta
                    conversa.
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {[...imagePromptTraces].reverse().map((trace, index) => {
                      const outputUrl = resolveAiOrchestratorAssetUrl(
                        baseUrl,
                        trace.output_url,
                      );

                      return (
                        <div
                          key={
                            trace.trace_id || `${trace.at || "img"}-${index}`
                          }
                          className="rounded-[1.5rem] border border-gray-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                              <span className="rounded-full border border-brand-orange/15 bg-brand-orange/10 px-2.5 py-1 text-brand-orange">
                                {trace.provider ||
                                  trace.requested_provider ||
                                  "imagem"}
                              </span>
                              <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                                {formatPromptTraceStatus(trace.status)}
                              </span>
                              <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                                {formatPromptReferenceMode(
                                  trace.reference_mode,
                                )}
                              </span>
                              <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                                {formatDateTime(trace.at)}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                void handleCopyStructuredTrace(
                                  "trace de imagem",
                                  buildImageTraceClipboardText(trace),
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-600 transition hover:border-brand-orange/30 hover:text-brand-orange"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copiar
                            </button>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                              workflow {trace.workflow_type || "—"}
                            </span>
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                              fallback {trace.fallback_from || "—"}
                            </span>
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                              refs {trace.reference_image_count || 0}
                            </span>
                          </div>

                          <div className="mt-4 space-y-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                                Prompt enviado ao fluxo visual
                              </p>
                              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-xs leading-relaxed text-gray-700">
                                {trace.prompt_text || "—"}
                              </pre>
                            </div>

                            <div className="grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                              <div>
                                <span className="font-semibold text-gray-800">
                                  Arquivo de referência
                                </span>
                                <p className="mt-1">
                                  {trace.reference_filename || "Sem arquivo"}
                                </p>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-800">
                                  Prompt ID
                                </span>
                                <p className="mt-1">{trace.prompt_id || "—"}</p>
                              </div>
                            </div>

                            {trace.error && (
                              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                                {trace.error}
                              </div>
                            )}

                            {outputUrl && (
                              <a
                                href={outputUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-purple transition hover:text-brand-purple-light"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Abrir última saída dessa geração
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
              Use o botão acima para abrir a trilha organizada dos prompts. O
              fluxo agora separa claramente o que foi para o LLM e o que foi
              para a geração visual, inclusive quando a prévia foi feita só por
              descrição textual.
            </div>
          )}
        </div>

        <div className="rounded-[1.75rem] border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Diagnóstico do dev
              </h3>
              <p className="text-sm text-gray-500">
                Registre aqui o que falhou ou o que chamou atenção nessa
                conversa para reutilizar depois em análise com IA.
              </p>
            </div>

            {selectedConversation.developer_note?.updated_at && (
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Atualizado em{" "}
                {formatDateTime(selectedConversation.developer_note.updated_at)}
              </span>
            )}
          </div>

          <textarea
            value={developerNoteInput}
            onChange={(event) => setDeveloperNoteInput(event.target.value)}
            placeholder="Ex.: o cliente anexou foto corretamente, mas a geração ignorou a referência porque o upload público persistiu o type como .png em vez de image."
            className="mt-4 min-h-32 w-full rounded-[1.5rem] border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Esse comentário fica salvo junto da conversa para facilitar a
              cópia do caso completo.
            </p>

            <button
              type="button"
              onClick={handleSaveDeveloperNote}
              disabled={developerNoteSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-purple px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-purple-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {developerNoteSaving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Salvar comentário
            </button>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50/80 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Anexos da conversa
              </h3>
              <p className="text-sm text-gray-500">
                Tudo o que entrou ou saiu nesse atendimento.
              </p>
            </div>
            <span className="rounded-full border border-brand-purple/15 bg-brand-purple/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-purple">
              {allAttachments.length} arquivo(s)
            </span>
          </div>

          {allAttachments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
              Nenhum anexo persistido nesta conversa.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {allAttachments.map((attachment) => (
                <AttachmentCard
                  key={buildAttachmentKey(attachment)}
                  attachment={attachment}
                />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[1.75rem] border border-gray-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Histórico da conversa
              </h3>
              <p className="text-sm text-gray-500">
                Timeline completa do atendimento e das respostas do bot.
              </p>
            </div>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
              {selectedConversation.messages?.length || 0} mensagem(ns)
            </span>
          </div>

          <div className="space-y-4">
            {(selectedConversation.messages || []).map((message, index) => {
              const outbound = message.direction === "outbound";
              const attachments = getMessageAttachments(baseUrl, message);
              const text = getDisplayText(message.text);

              return (
                <div
                  key={
                    message.message_id ||
                    `${index}-${getMessageTimestamp(message)}`
                  }
                  className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`w-full max-w-3xl rounded-[1.75rem] border px-4 py-4 shadow-sm ${
                      outbound
                        ? "border-brand-purple/20 bg-brand-purple text-white"
                        : "border-gray-200 bg-gray-50 text-gray-900"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em]">
                      <span
                        className={`inline-flex items-center gap-2 font-semibold ${outbound ? "text-brand-orange" : "text-brand-purple"}`}
                      >
                        {outbound ? (
                          <Sparkles className="h-4 w-4" />
                        ) : (
                          <MessageSquareText className="h-4 w-4" />
                        )}
                        {outbound ? "Bot / sistema" : "Cliente"}
                      </span>

                      <span
                        className={outbound ? "text-white/60" : "text-gray-500"}
                      >
                        <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                        {formatDateTime(getMessageTimestamp(message))}
                      </span>
                    </div>

                    {text && (
                      <p
                        className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed ${outbound ? "text-white/90" : "text-gray-700"}`}
                      >
                        {text}
                      </p>
                    )}

                    {attachments.length > 0 && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {attachments.map((attachment) => (
                          <AttachmentCard
                            key={`${message.message_id || index}-${buildAttachmentKey(attachment)}`}
                            attachment={attachment}
                          />
                        ))}
                      </div>
                    )}

                    {!text && attachments.length === 0 && (
                      <p
                        className={`mt-3 text-sm ${outbound ? "text-white/70" : "text-gray-500"}`}
                      >
                        Mensagem sem conteúdo textual persistido.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  async function handleDelete(conversationId: string) {
    showConfirm(
      "Excluir conversa",
      "Essa ação remove a conversa do store local do ai-orchestrator. Deseja continuar?",
      async () => {
        try {
          await deleteBotConversation(baseUrl, conversationId);

          const nextConversation = conversations.find(
            (conversation) => conversation.conversation_id !== conversationId,
          );

          if (selectedConversationId === conversationId) {
            startTransition(() => {
              setSelectedConversationId(
                nextConversation?.conversation_id || null,
              );
            });
            setSelectedConversation(null);
          }

          setRefreshTick((value) => value + 1);
          await showAlert(
            "Conversa excluída",
            "A conversa foi removida do painel local do orquestrador.",
            "success",
          );
        } catch (deleteError) {
          await showAlert(
            "Erro ao excluir",
            deleteError instanceof Error
              ? deleteError.message
              : "Não foi possível excluir a conversa.",
            "error",
          );
        }
      },
    );
  }

  async function handleGenerateInvite() {
    const pendingTab =
      globalThis.window === undefined
        ? null
        : globalThis.window.open("about:blank", "_blank");

    try {
      setInviteLoading(true);
      const result = await createPublicBotInvite(baseUrl, {
        orchestratorBaseUrl: baseUrl,
        label: inviteLabel.trim() || undefined,
        expiresInHours: Number(inviteHours) || undefined,
      });
      const inviteToken = resolveInviteToken(
        result.invite.url,
        result.invite.token,
      );
      const inviteUrl = inviteToken
        ? buildFrontendInviteUrl(inviteToken, baseUrl)
        : null;

      setGeneratedInviteUrl(inviteUrl);
      setSelectedConversation(result.conversation);
      startTransition(() => {
        setCurrentPage(1);
        setSelectedConversationId(result.conversation.conversation_id);
      });
      setRefreshTick((value) => value + 1);

      if (pendingTab && inviteUrl) {
        pendingTab.location.href = inviteUrl;
      } else if (pendingTab) {
        pendingTab.close();
      }
    } catch (inviteError) {
      pendingTab?.close();
      await showAlert(
        "Falha ao abrir conversa publica",
        inviteError instanceof Error
          ? inviteError.message
          : "Não foi possivel preparar a conversa publica.",
        "error",
      );
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleCopyInvite() {
    if (!generatedInviteUrl) return;

    try {
      await copyTextToClipboard(generatedInviteUrl);
      await showAlert(
        "Link copiado",
        "O link da conversa foi copiado para a area de transferencia.",
        "success",
      );
    } catch {
      await showAlert(
        "Nao foi possivel copiar",
        generatedInviteUrl,
        "info",
      );
    }
  }

  async function handleCopyTrainingPrompt() {
    try {
      setTrainingPromptLoading(true);
      const result = await getBotTrainingReviewPrompt(baseUrl);

      if ((result.total_pending ?? result.total_conversations) === 0) {
        await showAlert(
          "Nada pendente",
          "Todas as conversas estao verificadas no momento. Desative o selo de alguma conversa para inclui-la no proximo prompt.",
          "info",
        );
        return;
      }

      await copyTextToClipboard(result.prompt);

      const meta = {
        conversationId: result.conversation_id ?? '',
        conversationLabel: result.conversation_label ?? result.conversation_id ?? '',
        totalPending: result.total_pending ?? result.total_conversations,
        timestamp: new Date().toISOString(),
      };
      setLastPromptMeta(meta);
      try { localStorage.setItem('superPromptMeta', JSON.stringify(meta)); } catch { /* ignore */ }

      const remaining = (result.total_pending ?? 1) - 1;
      await showAlert(
        "Super prompt copiado",
        `Conversa incluida: ${meta.conversationLabel}${remaining > 0 ? ` · ${remaining} pendente(s) apos esta` : ' · ultima pendente'}.`,
        "success",
      );
    } catch (promptError) {
      await showAlert(
        "Falha ao gerar prompt",
        promptError instanceof Error
          ? promptError.message
          : "Nao foi possivel montar o prompt de treinamento.",
        "error",
      );
    } finally {
      setTrainingPromptLoading(false);
    }
  }

  async function handleToggleTrainingVerification(
    conversationId: string,
    currentVerified: boolean,
  ) {
    try {
      setTrainingVerificationSavingId(conversationId);
      const result = await setBotConversationTrainingVerification(
        baseUrl,
        conversationId,
        {
          verified: !currentVerified,
        },
      );

      syncConversationIntoDashboard(result.conversation);
      setRefreshTick((value) => value + 1);
    } catch (saveError) {
      await showAlert(
        "Falha ao atualizar selo",
        saveError instanceof Error
          ? saveError.message
          : "Nao foi possivel atualizar a verificacao da conversa.",
        "error",
      );
    } finally {
      setTrainingVerificationSavingId(null);
    }
  }

  async function handleCopyConversationJson() {
    if (!selectedConversation) return;

    const serialized = JSON.stringify(selectedConversation, null, 2);

    try {
      await copyTextToClipboard(serialized);
      await showAlert(
        "JSON copiado",
        "O JSON completo da conversa foi copiado para a área de transferência.",
        "success",
      );
    } catch {
      await showAlert("Não foi possível copiar", serialized, "info");
    }
  }

  async function handleCopyStructuredTrace(label: string, serialized: string) {
    try {
      await copyTextToClipboard(serialized);
      await showAlert(
        "Trace copiado",
        `O ${label} foi copiado para a área de transferência.`,
        "success",
      );
    } catch {
      await showAlert("Não foi possível copiar", serialized, "info");
    }
  }

  async function handleSaveDeveloperNote() {
    if (!selectedConversation) return;

    try {
      setDeveloperNoteSaving(true);
      const result = await saveBotConversationDeveloperNote(
        baseUrl,
        selectedConversation.conversation_id,
        { note: developerNoteInput },
      );
      setSelectedConversation(result.conversation);
      setDeveloperNoteInput(result.conversation.developer_note?.note || "");
      await showAlert(
        "Comentário salvo",
        "A observação de diagnóstico foi persistida nesta conversa.",
        "success",
      );
    } catch (saveError) {
      await showAlert(
        "Falha ao salvar comentário",
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar a observação do dev.",
        "error",
      );
    } finally {
      setDeveloperNoteSaving(false);
    }
  }

  function applyBaseUrl() {
    const normalized = saveAiOrchestratorBaseUrl(baseUrlInput);
    setBaseUrlInput(normalized);
    setBaseUrl(normalized);
    setRefreshTick((value) => value + 1);
  }

  return (
    <div className="space-y-6 py-2">
      <style>{`
        @keyframes neon-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div className="overflow-hidden rounded-[2rem] border border-brand-purple/10 bg-white shadow-[0_24px_60px_-32px_rgba(46,2,73,0.35)]">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(255,153,0,0.18),transparent_35%),linear-gradient(135deg,rgba(46,2,73,0.96),rgba(87,10,133,0.92))] px-6 py-7 text-white sm:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                  <Bot className="h-3.5 w-3.5" />
                  Painel de desenvolvimento
                </span>

                {/* View mode toggle */}
                <div className="flex rounded-full border border-white/20 bg-white/10 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`rounded-full px-3 py-1 transition ${viewMode === 'list' ? 'bg-white text-brand-purple shadow' : 'text-white/70 hover:text-white'}`}
                  >
                    ≡ Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('flow')}
                    className={`rounded-full px-3 py-1 transition ${viewMode === 'flow' ? 'bg-white text-brand-purple shadow' : 'text-white/70 hover:text-white'}`}
                  >
                    ◈ Flow
                  </button>
                </div>

                {viewMode === 'flow' && (
                  <ResourceStatusBadge baseUrl={baseUrl} />
                )}
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold sm:text-4xl">
                  {viewMode === 'flow' ? 'Orchestrator Studio' : 'Dashboard de chats do bot'}
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
                  Visualize todas as conversas persistidas pelo ai-orchestrator,
                  abra o histórico completo, inspecione anexos enviados e
                  recebidos e remova conversas locais quando quiser limpar o
                  treinamento.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/12 bg-white/8 px-4 py-4 text-sm text-white/75 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Server className="h-4 w-4 text-brand-orange" />
                Ponte com o orquestrador local
              </div>
              <p className="mt-2 max-w-md leading-relaxed">
                Para Vercel ou outra hospedagem, basta apontar a URL abaixo para
                localhost:4310 na sua máquina ou para um túnel seguro do seu
                servidor local.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t border-brand-purple/10 bg-white px-4 py-4 sm:px-6">
          <div className="rounded-3xl border border-gray-200 bg-gray-50/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              <Server className="h-4 w-4 text-brand-purple" />
              Endpoint do ai-orchestrator
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={baseUrlInput}
                onChange={(event) => setBaseUrlInput(event.target.value)}
                placeholder="http://localhost:4310"
                className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
              />
              <button
                type="button"
                onClick={applyBaseUrl}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-purple px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-purple-light"
              >
                <Server className="h-4 w-4" />
                Aplicar conexão
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <label className={`${filterCardClass} xl:col-span-2`}>
              <span className={filterLabelClass}>
                <Search className="h-4 w-4 text-brand-purple" />
                Buscar
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cliente, pedido, ID ou nome de anexo"
                className={filterControlClass}
              />
            </label>

            <label className={filterCardClass}>
              <span className={filterLabelClass}>
                <Filter className="h-4 w-4 text-brand-purple" />
                Estado
              </span>
              <select
                value={stateFilter}
                onChange={(event) => setStateFilter(event.target.value)}
                className={filterControlClass}
              >
                <option value="all">Todos</option>
                <option value="collecting_data">Coletando dados</option>
                <option value="ready_to_create_sale">Pronta para venda</option>
                <option value="sale_created">Venda criada</option>
                <option value="human_handoff">Atendimento humano</option>
              </select>
            </label>

            <label className={filterCardClass}>
              <span className={filterLabelClass}>
                <MessageSquareText className="h-4 w-4 text-brand-purple" />
                Canal
              </span>
              <select
                value={channelFilter}
                onChange={(event) => setChannelFilter(event.target.value)}
                className={filterControlClass}
              >
                <option value="all">Todos</option>
                {availableChannels.map((channel) => (
                  <option key={channel} value={channel}>
                    {formatChannelLabel(channel)}
                  </option>
                ))}
              </select>
            </label>

            <label className={filterCardClass}>
              <span className={filterLabelClass}>
                <Paperclip className="h-4 w-4 text-brand-purple" />
                Tipo de anexo
              </span>
              <select
                value={attachmentTypeFilter}
                onChange={(event) =>
                  setAttachmentTypeFilter(event.target.value)
                }
                className={filterControlClass}
              >
                <option value="all">Todos</option>
                {availableAttachmentTypes.map((attachmentType) => (
                  <option key={attachmentType} value={attachmentType}>
                    {formatAttachmentTypeLabel(attachmentType)}
                  </option>
                ))}
              </select>
            </label>

            <label className={filterCardClass}>
              <span className={filterLabelClass}>
                <ShieldCheck className="h-4 w-4 text-brand-purple" />
                Selo de verificação
              </span>
              <select
                value={trainingVerificationFilter}
                onChange={(event) =>
                  setTrainingVerificationFilter(event.target.value)
                }
                className={filterControlClass}
              >
                <option value="all">Todos</option>
                <option value="verified">Verificadas</option>
                <option value="unverified">Não verificadas</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
        <section className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.3)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Runtime local
              </p>
              <h2 className="mt-2 text-xl font-bold text-gray-900">
                {runtimeIsOnline
                  ? "Servidor operacional"
                  : "Servidor indisponível"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Esse cartão indica se o PC local e os serviços necessários para
                LLM e imagens estão acessíveis para o dashboard online.
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${runtimeIsOnline ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}
            >
              {runtimeIsOnline ? (
                <Server className="h-4 w-4" />
              ) : (
                <WifiOff className="h-4 w-4" />
              )}
              {runtimeLoading
                ? "Verificando..."
                : runtimeIsOnline
                  ? "Online"
                  : "Offline"}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                LLM
              </p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {runtimeStatus?.llm?.label || "—"}
              </p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                ComfyUI
              </p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {runtimeStatus?.image?.comfyui?.available
                  ? "Disponível"
                  : "Indisponível"}
              </p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Fila
              </p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {runtimeStatus?.queue?.pending ?? 0} pendente(s)
              </p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Chat público
              </p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {runtimeStatus?.public_chat?.enabled
                  ? "Habilitado"
                  : "Desabilitado"}
              </p>
            </div>
          </div>

          {(runtimeError || runtimeStatus?.heartbeat?.checked_at) && (
            <p
              className={`mt-4 text-sm ${runtimeError ? "text-red-600" : "text-gray-500"}`}
            >
              {runtimeError ||
                `Última checagem em ${formatDateTime(runtimeStatus?.heartbeat?.checked_at)}`}
            </p>
          )}
        </section>

        <LocalInviteLauncherCard
          inviteLabel={inviteLabel}
          inviteHours={inviteHours}
          inviteLoading={inviteLoading}
          inviteUrl={generatedInviteUrl}
          onInviteLabelChange={setInviteLabel}
          onInviteHoursChange={setInviteHours}
          onGenerateAndOpen={handleGenerateInvite}
          onCopyInviteLink={handleCopyInvite}
        />

        <section className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.3)]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            <Sparkles className="h-4 w-4 text-brand-purple" />
            Treinamento assistido
          </div>

          <h2 className="mt-2 text-xl font-bold text-gray-900">
            Gerar super prompt de melhoria
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            Copia o super prompt da conversa nao verificada mais antiga — uma por vez. Apos aplicar as melhorias, marque a conversa como verificada antes de gerar o proximo.
          </p>

          <div className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            Use o selo de cada conversa para decidir se ela entra ou nao no
            proximo pacote de treinamento manual.
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <div className="relative group">
              <button
                type="button"
                onClick={handleCopyTrainingPrompt}
                disabled={trainingPromptLoading}
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-purple px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-purple-light disabled:cursor-not-allowed disabled:opacity-60"
              >
                {trainingPromptLoading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Gerar e copiar super prompt
              </button>

              {/* Hover tooltip */}
              <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-80 rounded-xl border border-gray-700 bg-gray-900 p-3 text-xs text-gray-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
                {lastPromptMeta ? (
                  <>
                    <p className="mb-1 font-semibold text-white">Ultima conversa gerada</p>
                    <p className="mb-1 break-all font-mono text-gray-300">{lastPromptMeta.conversationLabel}</p>
                    <p className="mb-2 text-gray-400">
                      as {new Date(lastPromptMeta.timestamp).toLocaleTimeString('pt-BR', { hour12: false })}
                      {' · '}{lastPromptMeta.totalPending} pendente(s) na epoca
                    </p>
                    <div className="border-t border-gray-700 pt-2 text-yellow-400">
                      ⚠️ Ja verificou essa conversa? Marque-a como verificada antes de gerar a proxima.
                    </div>
                  </>
                ) : (
                  <p className="text-gray-300">Gera o super prompt da conversa nao verificada mais antiga (uma por vez).</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Flow View (Orchestrator Studio) ────────────────────────────────── */}
      {viewMode === 'flow' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            background: '#0a0a0f',
            overflow: 'hidden',
          }}
        >
          {/* Studio top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #c026d322', flexShrink: 0, background: '#0a0a1a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#c026d3', letterSpacing: '0.12em', fontWeight: 700 }}>◈ ORCHESTRATOR STUDIO</span>
              <ResourceStatusBadge baseUrl={baseUrl} />
              <HealthBadge baseUrl={baseUrl} onClick={() => setShowHealthModal(true)} />
            </div>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="Voltar para lista"
              style={{ fontFamily: 'monospace', fontSize: 11, background: 'none', border: '1px solid #ffffff22', color: '#ffffff44', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
            >
              ✕ Fechar
            </button>
          </div>

          {showHealthModal && (
            <HealthCheckModal baseUrl={baseUrl} onClose={() => setShowHealthModal(false)} />
          )}

          {/* 3-column body */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `300px 1fr ${logPanelWidth}px`, overflow: 'hidden', minHeight: 0 }}>
          {/* Left: conversation list */}
          <div style={{ borderRight: '1px solid #c026d322', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #c026d322', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#c026d388', letterSpacing: '0.08em', fontWeight: 700 }}>CONVERSAS</span>
              <button
                type="button"
                onClick={() => setRefreshTick((v) => v + 1)}
                style={{ background: 'none', border: '1px solid #ffffff22', color: '#ffffff55', fontSize: 10, borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontFamily: 'monospace' }}
              >
                ↺ atualizar
              </button>
            </div>

            {/* Nova conversa monitorada */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #c026d322', flexShrink: 0 }}>
              <button
                type="button"
                disabled={creatingMonitoredChat}
                onClick={async () => {
                  setCreatingMonitoredChat(true);
                  try {
                    const result = await createPublicBotInvite(baseUrl, {
                      frontendBaseUrl: window.location.origin,
                      orchestratorBaseUrl: baseUrl,
                      label: 'Monitorada via Flow Studio',
                      maxMessages: 50,
                    });
                    const convId = result.conversation.conversation_id;
                    setSelectedConversationId(convId);
                    setWatchedInviteUrl(result.invite.url ?? null);
                    setRefreshTick((v) => v + 1);
                  } catch {
                    /* ignore */
                  } finally {
                    setCreatingMonitoredChat(false);
                  }
                }}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: 10,
                  background: creatingMonitoredChat ? '#c026d308' : '#c026d314',
                  color: creatingMonitoredChat ? '#c026d366' : '#c026d3cc',
                  border: '1px solid #c026d333',
                  borderRadius: 6,
                  padding: '6px 0',
                  cursor: creatingMonitoredChat ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.05em',
                }}
              >
                {creatingMonitoredChat ? '◌ criando…' : '+ Nova conversa monitorada'}
              </button>
              {watchedInviteUrl && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <a
                    href={watchedInviteUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: 'monospace', fontSize: 9, color: '#22d3ee', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none', border: '1px solid #22d3ee33', borderRadius: 4, padding: '2px 6px' }}
                  >
                    ↗ {watchedInviteUrl}
                  </a>
                  <button
                    type="button"
                    onClick={() => { void navigator.clipboard.writeText(watchedInviteUrl); }}
                    style={{ fontFamily: 'monospace', fontSize: 9, background: 'none', color: '#22d3ee88', border: '1px solid #22d3ee33', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', flexShrink: 0 }}
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    onClick={() => setWatchedInviteUrl(null)}
                    style={{ fontFamily: 'monospace', fontSize: 9, background: 'none', color: '#ffffff33', border: '1px solid #ffffff22', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {listLoading && (
                <div style={{ padding: 16, fontFamily: 'monospace', fontSize: 11, color: '#ffffff44', textAlign: 'center' }}>Carregando…</div>
              )}
              {conversations.map((conv) => {
                const isSelected = conv.conversation_id === selectedConversationId;
                const stateColor =
                  conv.state === 'sale_created' ? '#22c55e' :
                  conv.state === 'collecting_data' ? '#c026d3' :
                  conv.state === 'awaiting_team_quote' ? '#f97316' :
                  conv.state === 'ready_to_create_sale' ? '#22d3ee' :
                  conv.state === 'human_handoff' ? '#f43f5e' :
                  '#888888';
                const stateLabel = STATE_LABELS[conv.state] ?? conv.state;
                const channelLabel = CHANNEL_LABELS[conv.channel] ?? conv.channel;
                // Fallback when backend hasn't been restarted yet (display_name undefined)
                const displayName = conv.display_name || conv.client_name || (() => {
                  const tsMatch = conv.conversation_id.match(/(\d{13})/);
                  if (tsMatch) {
                    const d = new Date(Number(tsMatch[1]));
                    if (!isNaN(d.getTime())) {
                      return `${channelLabel} — ${d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}`;
                    }
                  }
                  return `${channelLabel} #${conv.conversation_id.slice(-6)}`;
                })();
                const relativeTime = (() => {
                  if (!conv.updated_at) return null;
                  const ms = Date.now() - new Date(conv.updated_at).getTime();
                  if (ms < 60000) return 'agora';
                  if (ms < 3600000) return `${Math.floor(ms / 60000)}min`;
                  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
                  return `${Math.floor(ms / 86400000)}d`;
                })();
                return (
                  <button
                    key={conv.conversation_id}
                    type="button"
                    onClick={() => setSelectedConversationId(conv.conversation_id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 14px',
                      borderBottom: '1px solid #ffffff08',
                      background: isSelected ? '#c026d314' : 'transparent',
                      borderLeft: isSelected ? '2px solid #c026d3' : '2px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    {/* Row 1: status dot + name + time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: stateColor, boxShadow: `0 0 5px ${stateColor}`, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#ffffffcc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: 700 }}>
                        {displayName}
                      </span>
                      {relativeTime && (
                        <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff33', flexShrink: 0 }}>{relativeTime}</span>
                      )}
                    </div>
                    {/* Row 2: state label + channel badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 8, background: `${stateColor}1a`, color: stateColor, borderRadius: 3, padding: '1px 5px', border: `1px solid ${stateColor}44` }}>
                        {stateLabel}
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: 8, background: '#ffffff0a', color: '#ffffff55', borderRadius: 3, padding: '1px 5px', border: '1px solid #ffffff1a' }}>
                        {channelLabel}
                      </span>
                      {conv.has_generated_image && (
                        <span style={{ fontFamily: 'monospace', fontSize: 8, background: '#f9731614', color: '#f97316', borderRadius: 3, padding: '1px 5px', border: '1px solid #f9731633' }}>
                          🖼 prévia
                        </span>
                      )}
                    </div>
                    {/* Row 3: phone (if known) + message count */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {conv.client_phone && (
                        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff55', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          📞 {conv.client_phone}
                        </span>
                      )}
                      <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff33', flexShrink: 0, marginLeft: 'auto' }}>
                        {conv.message_count} msg{conv.message_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {/* Row 4: last message preview */}
                    <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff44', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.last_message_preview}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center: ReactFlow canvas */}
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            <FlowCanvas
              baseUrl={baseUrl}
              conversationId={selectedConversationId}
              onEventsChange={setFlowEvents}
            />
          </div>

          {/* Right: event log (resizable) */}
          <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
            <LogResizeHandle onMouseDown={onLogResizeMouseDown} />
            <EventLog events={flowEvents} onClear={() => setFlowEvents([])} />
          </div>
          </div>
        </div>
      )}

      {/* ── List View (default) ─────────────────────────────────────────────── */}
      {viewMode === 'list' && (
      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)] 2xl:grid-cols-[460px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-[0_24px_60px_-36px_rgba(15,23,42,0.3)]">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Conversas</h2>
              <p className="text-sm text-gray-500">
                {totalConversations} conversa(s) encontrada(s)
              </p>
            </div>

            <button
              type="button"
              onClick={() => setRefreshTick((value) => value + 1)}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-brand-purple/25 hover:text-brand-purple"
            >
              <RefreshCcw
                className={`h-4 w-4 ${listLoading ? "animate-spin" : ""}`}
              />
              Atualizar
            </button>
          </div>

          <div className="max-h-[72vh] overflow-y-auto p-3">{listContent}</div>

          <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-500">
              Página {totalPages === 0 ? 0 : currentPage} de {totalPages}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!hasPreviousPage || listLoading}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-brand-purple/25 hover:text-brand-purple disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={!hasNextPage || listLoading}
                onClick={() => setCurrentPage((page) => page + 1)}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-brand-purple/25 hover:text-brand-purple disabled:cursor-not-allowed disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-[0_24px_60px_-36px_rgba(15,23,42,0.3)]">
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedConversation?.conversation_id ||
                    "Selecione uma conversa"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Histórico completo, anexos e dados extraídos do orquestrador.
                </p>
              </div>

              {selectedConversation && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={
                      trainingVerificationSavingId ===
                      selectedConversation.conversation_id
                    }
                    onClick={() =>
                      void handleToggleTrainingVerification(
                        selectedConversation.conversation_id,
                        isConversationVerified(
                          selectedConversation.training_verification,
                        ),
                      )
                    }
                    className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${getTrainingBadgeTone(
                      isConversationVerified(
                        selectedConversation.training_verification,
                      ),
                    )} disabled:cursor-not-allowed disabled:opacity-70`}
                  >
                    {trainingVerificationSavingId ===
                    selectedConversation.conversation_id ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    {getTrainingBadgeLabel(
                      isConversationVerified(
                        selectedConversation.training_verification,
                      ),
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyConversationJson}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-brand-purple/25 hover:text-brand-purple"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar JSON
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDelete(selectedConversation.conversation_id)
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir conversa
                  </button>
                </div>
              )}
            </div>
          </div>

          {detailContent}
        </section>
      </div>
      )}
    </div>
  );
}
