'use client';

import { useDialog } from '@/context/DialogContext';
import {
  createPublicBotInvite,
  deleteBotConversation,
  getBotConversation,
  getBotRuntimeStatus,
  getStoredAiOrchestratorBaseUrl,
  listBotConversations,
  resolveAiOrchestratorAssetUrl,
  saveAiOrchestratorBaseUrl,
  simulateBotConversation,
  type BotConversation,
  type BotConversationBlocker,
  type BotConversationAttachment,
  type BotConversationMessage,
  type BotRuntimeStatus,
  type BotConversationSummary,
} from '@/services/aiOrchestrator.service';
import {
  Bot,
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
  PlayCircle,
  RefreshCcw,
  Search,
  SendHorizontal,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  WifiOff,
} from 'lucide-react';
import { startTransition, useDeferredValue, useEffect, useState } from 'react';

interface EnrichedAttachment extends BotConversationAttachment {
  absoluteUrl: string | null;
}

const PAGE_SIZE = 12;

const STATE_LABELS: Record<string, string> = {
  new_lead: 'Novo lead',
  collecting_data: 'Coletando dados',
  awaiting_team_quote: 'Aguardando equipe',
  ready_to_create_sale: 'Pronta para venda',
  sale_created: 'Venda criada',
  human_handoff: 'Atendimento humano',
};

const CHANNEL_LABELS: Record<string, string> = {
  manual_html: 'HTML manual',
  manual_dashboard: 'Dashboard dev',
  allowanonimos: 'Link público',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
};

const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  image: 'Imagem enviada',
  generated_image: 'Prévia gerada',
  model: 'Modelo 3D',
  file: 'Arquivo',
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function formatCurrency(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatStateLabel(value?: string | null) {
  if (!value) return '—';
  return STATE_LABELS[value] || value.replaceAll('_', ' ');
}

function formatChannelLabel(value?: string | null) {
  if (!value) return '—';
  return CHANNEL_LABELS[value] || value;
}

function formatAttachmentTypeLabel(value?: string | null) {
  if (!value) return '—';
  return ATTACHMENT_TYPE_LABELS[value] || value.replaceAll('_', ' ');
}

function formatBlockerOwner(value?: string | null) {
  if (!value) return '—';

  const labels: Record<string, string> = {
    none: 'Sem bloqueio',
    customer: 'Cliente',
    team: 'Equipe real',
    system: 'Sistema',
    bot: 'Bot',
  };

  return labels[value] || value;
}

function buildTrainingConversationId() {
  return `dashboard-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getBlockerTone(blocker?: BotConversationBlocker | null) {
  switch (blocker?.owner) {
    case 'team':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'customer':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'system':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'none':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    default:
      return 'border-gray-200 bg-gray-100 text-gray-700';
  }
}

function getMessageTimestamp(message: BotConversationMessage) {
  return message.sent_at || message.received_at || null;
}

function getDisplayText(text?: string | null) {
  if (!text) return '';
  const cleaned = text.replaceAll(/\[IMAGEM_GERADA:[^\]]+\]/g, '').trim();
  if (cleaned) return cleaned;
  if (text.includes('[IMAGEM_GERADA:')) {
    return 'Prévia gerada pelo orquestrador.';
  }
  return '';
}

function isImageAttachment(attachment: EnrichedAttachment) {
  const source = `${attachment.type || ''} ${attachment.filename || ''} ${attachment.url || ''}`.toLowerCase();
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

function buildAttachmentKey(attachment: BotConversationAttachment | EnrichedAttachment) {
  return [attachment.type || 'unknown', attachment.filename || '', attachment.url || ''].join('|');
}

function getGeneratedAttachments(baseUrl: string, text?: string | null) {
  if (!text) return [];

  const attachments: EnrichedAttachment[] = [];
  for (const match of text.matchAll(/\[IMAGEM_GERADA:([^\]]+)\]/g)) {
    const normalized = normalizeAttachment(baseUrl, {
      type: 'generated_image',
      url: match[1],
      filename: match[1].split('/').pop() || 'preview.png',
    });

    if (normalized) {
      attachments.push(normalized);
    }
  }

  return attachments;
}

function getMessageAttachments(baseUrl: string, message: BotConversationMessage) {
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

function getConversationAttachments(baseUrl: string, conversation: BotConversation) {
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
  return attachment.filename || attachment.url?.split('/').pop() || 'anexo';
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
            {attachment.type || 'arquivo'}
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
  const [baseUrl, setBaseUrl] = useState(() => getStoredAiOrchestratorBaseUrl());
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [attachmentTypeFilter, setAttachmentTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [conversations, setConversations] = useState<BotConversationSummary[]>([]);
  const [totalConversations, setTotalConversations] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    null,
  );
  const [selectedConversation, setSelectedConversation] =
    useState<BotConversation | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [runtimeStatus, setRuntimeStatus] = useState<BotRuntimeStatus | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(true);
  const [trainingConversationId, setTrainingConversationId] = useState(() =>
    buildTrainingConversationId(),
  );
  const [trainingMessage, setTrainingMessage] = useState('');
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [inviteLabel, setInviteLabel] = useState('');
  const [inviteHours, setInviteHours] = useState('72');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setCurrentPage(1);
  }, [attachmentTypeFilter, baseUrl, channelFilter, deferredSearch, stateFilter]);

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
            : 'Não foi possível consultar o orquestrador local.',
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
          state: stateFilter === 'all' ? undefined : stateFilter,
          channel: channelFilter === 'all' ? undefined : channelFilter,
          attachmentType:
            attachmentTypeFilter === 'all' ? undefined : attachmentTypeFilter,
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
            : 'Não foi possível carregar as conversas.',
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
  }, [attachmentTypeFilter, baseUrl, channelFilter, currentPage, deferredSearch, refreshTick, stateFilter]);

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
        (conversation) => conversation.conversation_id === selectedConversationId,
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
      return;
    }

    let ignore = false;

    async function loadConversation() {
      setDetailLoading(true);

      try {
        const result = await getBotConversation(baseUrl, selectedConversationId);
        if (ignore) return;
        setSelectedConversation(result.conversation);
      } catch (loadError) {
        if (ignore) return;
        setSelectedConversation(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar o detalhe da conversa.',
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
  const runtimeIsOnline =
    !runtimeError && runtimeStatus?.heartbeat?.status === 'online';
  const trainingTargetId = selectedConversationId || trainingConversationId;

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

          return (
            <button
              key={conversation.conversation_id}
              type="button"
              onClick={() => {
                startTransition(() => {
                  setSelectedConversationId(conversation.conversation_id);
                });
              }}
              className={`w-full rounded-3xl border px-4 py-4 text-left transition-all duration-300 ${
                selected
                  ? 'border-brand-purple/30 bg-brand-purple text-white shadow-[0_20px_40px_-28px_rgba(46,2,73,0.85)]'
                  : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:border-brand-purple/20 hover:shadow-lg'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] ${selected ? 'bg-white/14 text-white' : 'bg-brand-purple/8 text-brand-purple'}`}>
                      {formatStateLabel(conversation.state)}
                    </span>
                    {conversation.has_generated_image && (
                      <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] ${selected ? 'bg-brand-orange/20 text-brand-orange' : 'bg-brand-orange/12 text-brand-orange'}`}>
                        Prévia
                      </span>
                    )}
                  </div>

                  <p className={`mt-3 truncate text-sm font-semibold ${selected ? 'text-white' : 'text-gray-900'}`}>
                    {conversation.client_name || conversation.conversation_id}
                  </p>
                  <p className={`mt-1 line-clamp-2 text-sm ${selected ? 'text-white/72' : 'text-gray-500'}`}>
                    {conversation.order_description || conversation.last_message_preview}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${selected ? 'border-white/15 bg-white/10 text-white/85' : getBlockerTone(conversation.blocker)}`}
                    >
                      {conversation.blocker?.label || 'Sem bloqueio'}
                    </span>
                    {conversation.public_invite?.enabled && (
                      <span
                        className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${selected ? 'bg-brand-orange/18 text-brand-orange' : 'bg-brand-orange/12 text-brand-orange'}`}
                      >
                        Link público
                      </span>
                    )}
                  </div>

                  {conversation.attachment_types.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {conversation.attachment_types.slice(0, 3).map((attachmentType) => (
                        <span
                          key={`${conversation.conversation_id}-${attachmentType}`}
                          className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${selected ? 'bg-white/10 text-white/80' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {formatAttachmentTypeLabel(attachmentType)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`text-right text-xs ${selected ? 'text-white/72' : 'text-gray-500'}`}>
                  <p>{formatChannelLabel(conversation.channel)}</p>
                  <p className="mt-1">{formatDateTime(conversation.updated_at)}</p>
                </div>
              </div>

              <div className={`mt-4 grid grid-cols-3 gap-2 text-xs ${selected ? 'text-white/70' : 'text-gray-500'}`}>
                <div className="rounded-2xl border border-current/10 px-3 py-2">
                  <p className="font-semibold">Mensagens</p>
                  <p className="mt-1 text-sm font-bold">{conversation.message_count}</p>
                </div>
                <div className="rounded-2xl border border-current/10 px-3 py-2">
                  <p className="font-semibold">Anexos</p>
                  <p className="mt-1 text-sm font-bold">{conversation.attachment_count}</p>
                </div>
                <div className="rounded-2xl border border-current/10 px-3 py-2">
                  <p className="font-semibold">Pendências</p>
                  <p className="mt-1 text-sm font-bold">{conversation.missing_fields_count}</p>
                </div>
              </div>
            </button>
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
              <ShieldCheck className="h-4 w-4 text-brand-purple" />
              O que impede a finalização
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getBlockerTone(selectedConversation.blocker)}`}>
                {selectedConversation.blocker?.label || 'Sem bloqueio'}
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-600">
                {formatBlockerOwner(selectedConversation.blocker?.owner)}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-gray-600">
              {selectedConversation.blocker?.detail || 'Sem pendências registradas nesta conversa.'}
            </p>
            {selectedConversation.missing_fields && selectedConversation.missing_fields.length > 0 && (
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
                <span className="font-semibold text-gray-800">Modo de acesso</span>
                <p className="mt-1">{selectedConversation.access?.mode || 'Interno / autenticado'}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-800">Venda no backend</span>
                <p className="mt-1">{selectedConversation.integration?.backend_sale_id || 'Ainda não criada'}</p>
              </div>
              {selectedConversation.access?.public_invite?.enabled && (
                <div>
                  <span className="font-semibold text-gray-800">Convite público</span>
                  <p className="mt-1">
                    {selectedConversation.access.public_invite.remaining_messages ?? 0} mensagem(ns) restante(s)
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Expira em {formatDateTime(selectedConversation.access.public_invite.expires_at)}
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
              {selectedConversation.extracted_data?.client?.name || 'Não identificado'}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <Phone className="h-4 w-4" />
              {selectedConversation.extracted_data?.client?.phoneNumber || 'Telefone pendente'}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white px-4 py-4 lg:col-span-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              <Sparkles className="h-4 w-4 text-brand-orange" />
              Pedido e contexto
            </div>
            <p className="mt-3 text-base font-bold text-gray-900">
              {selectedConversation.extracted_data?.order?.description || 'Sem descrição'}
            </p>
            <div className="mt-3 grid gap-3 text-sm text-gray-600 sm:grid-cols-3">
              <div>
                <span className="font-semibold text-gray-800">Estilo</span>
                <p className="mt-1">{selectedConversation.extracted_data?.order?.productStyle || '—'}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-800">Valor</span>
                <p className="mt-1">{formatCurrency(selectedConversation.extracted_data?.sale?.saleValue)}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-800">Foto interpretada</span>
                <p className="mt-1 line-clamp-2">
                  {selectedConversation.extracted_data?.order?.referenceImageDescription || '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50/80 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Anexos da conversa</h3>
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
              <h3 className="text-lg font-bold text-gray-900">Histórico da conversa</h3>
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
              const outbound = message.direction === 'outbound';
              const attachments = getMessageAttachments(baseUrl, message);
              const text = getDisplayText(message.text);

              return (
                <div
                  key={message.message_id || `${index}-${getMessageTimestamp(message)}`}
                  className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`w-full max-w-3xl rounded-[1.75rem] border px-4 py-4 shadow-sm ${
                      outbound
                        ? 'border-brand-purple/20 bg-brand-purple text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em]">
                      <span className={`inline-flex items-center gap-2 font-semibold ${outbound ? 'text-brand-orange' : 'text-brand-purple'}`}>
                        {outbound ? (
                          <Sparkles className="h-4 w-4" />
                        ) : (
                          <MessageSquareText className="h-4 w-4" />
                        )}
                        {outbound ? 'Bot / sistema' : 'Cliente'}
                      </span>

                      <span className={outbound ? 'text-white/60' : 'text-gray-500'}>
                        <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                        {formatDateTime(getMessageTimestamp(message))}
                      </span>
                    </div>

                    {text && (
                      <p className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed ${outbound ? 'text-white/90' : 'text-gray-700'}`}>
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
                      <p className={`mt-3 text-sm ${outbound ? 'text-white/70' : 'text-gray-500'}`}>
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
      'Excluir conversa',
      'Essa ação remove a conversa do store local do ai-orchestrator. Deseja continuar?',
      async () => {
        try {
          await deleteBotConversation(baseUrl, conversationId);

          const nextConversation = conversations.find(
            (conversation) => conversation.conversation_id !== conversationId,
          );

          if (selectedConversationId === conversationId) {
            startTransition(() => {
              setSelectedConversationId(nextConversation?.conversation_id || null);
            });
            setSelectedConversation(null);
          }

          setRefreshTick((value) => value + 1);
          await showAlert(
            'Conversa excluída',
            'A conversa foi removida do painel local do orquestrador.',
            'success',
          );
        } catch (deleteError) {
          await showAlert(
            'Erro ao excluir',
            deleteError instanceof Error
              ? deleteError.message
              : 'Não foi possível excluir a conversa.',
            'error',
          );
        }
      },
    );
  }

  async function handleTrainingSend() {
    const trimmedMessage = trainingMessage.trim();
    if (!trimmedMessage) {
      await showAlert(
        'Mensagem vazia',
        'Digite a mensagem do cliente para iniciar ou continuar o treinamento.',
        'warning',
      );
      return;
    }

    const targetConversationId = selectedConversationId || trainingConversationId;

    try {
      setTrainingLoading(true);
      const result = await simulateBotConversation(baseUrl, {
        conversationId: targetConversationId,
        message: trimmedMessage,
        senderId: 'dashboard-trainer',
        channel: 'manual_dashboard',
      });

      setSelectedConversation(result.conversation);
      startTransition(() => {
        setCurrentPage(1);
        setSelectedConversationId(result.conversation.conversation_id);
      });
      setTrainingMessage('');
      setTrainingConversationId(buildTrainingConversationId());
      setRefreshTick((value) => value + 1);
    } catch (sendError) {
      await showAlert(
        'Falha no treino',
        sendError instanceof Error
          ? sendError.message
          : 'Não foi possível enviar a mensagem de treino.',
        'error',
      );
    } finally {
      setTrainingLoading(false);
    }
  }

  async function handleGenerateInvite() {
    try {
      setInviteLoading(true);
      const result = await createPublicBotInvite(baseUrl, {
        frontendBaseUrl:
          typeof window !== 'undefined' ? window.location.origin : undefined,
        label: inviteLabel.trim() || undefined,
        expiresInHours: Number(inviteHours) || undefined,
      });

      setGeneratedInviteUrl(result.invite.url || null);
      setSelectedConversation(result.conversation);
      startTransition(() => {
        setCurrentPage(1);
        setSelectedConversationId(result.conversation.conversation_id);
      });
      setRefreshTick((value) => value + 1);
    } catch (inviteError) {
      await showAlert(
        'Falha ao gerar link',
        inviteError instanceof Error
          ? inviteError.message
          : 'Não foi possível gerar o link público.',
        'error',
      );
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleCopyInvite() {
    if (!generatedInviteUrl) return;

    try {
      await navigator.clipboard.writeText(generatedInviteUrl);
      await showAlert('Link copiado', 'O link público foi copiado para a área de transferência.', 'success');
    } catch {
      await showAlert('Não foi possível copiar', generatedInviteUrl, 'info');
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
      <div className="overflow-hidden rounded-[2rem] border border-brand-purple/10 bg-white shadow-[0_24px_60px_-32px_rgba(46,2,73,0.35)]">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(255,153,0,0.18),transparent_35%),linear-gradient(135deg,rgba(46,2,73,0.96),rgba(87,10,133,0.92))] px-6 py-7 text-white sm:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                <Bot className="h-3.5 w-3.5" />
                Painel de desenvolvimento
              </span>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold sm:text-4xl">
                  Dashboard de chats do bot
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
                  Visualize todas as conversas persistidas pelo ai-orchestrator,
                  abra o histórico completo, inspecione anexos enviados e recebidos
                  e remova conversas locais quando quiser limpar o treinamento.
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
                localhost:4310 na sua máquina ou para um túnel seguro do seu servidor local.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t border-brand-purple/10 bg-white px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
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

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="rounded-3xl border border-gray-200 bg-gray-50/80 p-4 text-sm text-gray-700">
              <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                <Search className="h-4 w-4 text-brand-purple" />
                Buscar
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cliente, pedido, ID ou nome de anexo"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
              />
            </label>

            <label className="rounded-3xl border border-gray-200 bg-gray-50/80 p-4 text-sm text-gray-700">
              <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                <Filter className="h-4 w-4 text-brand-purple" />
                Estado
              </span>
              <select
                value={stateFilter}
                onChange={(event) => setStateFilter(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
              >
                <option value="all">Todos</option>
                <option value="collecting_data">Coletando dados</option>
                <option value="ready_to_create_sale">Pronta para venda</option>
                <option value="sale_created">Venda criada</option>
                <option value="human_handoff">Atendimento humano</option>
              </select>
            </label>

            <label className="rounded-3xl border border-gray-200 bg-gray-50/80 p-4 text-sm text-gray-700">
              <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                <MessageSquareText className="h-4 w-4 text-brand-purple" />
                Canal
              </span>
              <select
                value={channelFilter}
                onChange={(event) => setChannelFilter(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
              >
                <option value="all">Todos</option>
                {availableChannels.map((channel) => (
                  <option key={channel} value={channel}>
                    {formatChannelLabel(channel)}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-3xl border border-gray-200 bg-gray-50/80 p-4 text-sm text-gray-700">
              <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                <Paperclip className="h-4 w-4 text-brand-purple" />
                Tipo de anexo
              </span>
              <select
                value={attachmentTypeFilter}
                onChange={(event) => setAttachmentTypeFilter(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
              >
                <option value="all">Todos</option>
                {availableAttachmentTypes.map((attachmentType) => (
                  <option key={attachmentType} value={attachmentType}>
                    {formatAttachmentTypeLabel(attachmentType)}
                  </option>
                ))}
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
                {runtimeIsOnline ? 'Servidor operacional' : 'Servidor indisponível'}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Esse cartão indica se o PC local e os serviços necessários para LLM e imagens estão acessíveis para o dashboard online.
              </p>
            </div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${runtimeIsOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {runtimeIsOnline ? <Server className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              {runtimeLoading ? 'Verificando...' : runtimeIsOnline ? 'Online' : 'Offline'}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">LLM</p>
              <p className="mt-2 text-sm font-bold text-gray-900">{runtimeStatus?.llm?.label || '—'}</p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">ComfyUI</p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {runtimeStatus?.image?.comfyui?.available ? 'Disponível' : 'Indisponível'}
              </p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Fila</p>
              <p className="mt-2 text-sm font-bold text-gray-900">{runtimeStatus?.queue?.pending ?? 0} pendente(s)</p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Chat público</p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {runtimeStatus?.public_chat?.enabled ? 'Habilitado' : 'Desabilitado'}
              </p>
            </div>
          </div>

          {(runtimeError || runtimeStatus?.heartbeat?.checked_at) && (
            <p className={`mt-4 text-sm ${runtimeError ? 'text-red-600' : 'text-gray-500'}`}>
              {runtimeError || `Última checagem em ${formatDateTime(runtimeStatus?.heartbeat?.checked_at)}`}
            </p>
          )}
        </section>

        <section className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.3)]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            <PlayCircle className="h-4 w-4 text-brand-purple" />
            Treinar bot pelo dashboard
          </div>
          <h2 className="mt-2 text-xl font-bold text-gray-900">Inicie ou continue uma conversa como cliente</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            Use a conversa selecionada para continuar o contexto atual ou envie uma nova mensagem para abrir um atendimento de treino.
          </p>

          <div className="mt-4 rounded-3xl border border-brand-purple/12 bg-brand-purple/[0.03] px-4 py-3 text-sm text-gray-600">
            <p className="font-semibold text-gray-800">Alvo atual</p>
            <p className="mt-1 break-all">{trainingTargetId}</p>
          </div>

          <textarea
            value={trainingMessage}
            onChange={(event) => setTrainingMessage(event.target.value)}
            placeholder="Ex.: Oi, preciso de um orçamento para um suporte de parede impresso em 3D."
            className="mt-4 min-h-32 w-full rounded-[1.5rem] border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleTrainingSend}
              disabled={trainingLoading}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-purple px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-purple-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {trainingLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
              Enviar como cliente
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedConversation(null);
                startTransition(() => setSelectedConversationId(null));
                setTrainingConversationId(buildTrainingConversationId());
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-purple/25 hover:text-brand-purple"
            >
              <RefreshCcw className="h-4 w-4" />
              Nova conversa de treino
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.3)]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            <Link2 className="h-4 w-4 text-brand-orange" />
            Demo pública allowanonimos
          </div>
          <h2 className="mt-2 text-xl font-bold text-gray-900">Gerar link sem autenticação</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            Crie um link externo para demonstrações. O usuário abre a conversa pública e o dashboard continua acompanhando tudo em tempo real.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-gray-700">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Rótulo</span>
              <input
                value={inviteLabel}
                onChange={(event) => setInviteLabel(event.target.value)}
                placeholder="Demo evento, cliente teste..."
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
              />
            </label>
            <label className="text-sm text-gray-700">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Expira em horas</span>
              <input
                type="number"
                min={1}
                value={inviteHours}
                onChange={(event) => setInviteHours(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGenerateInvite}
              disabled={inviteLoading}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-orange px-4 py-3 text-sm font-semibold text-brand-purple transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {inviteLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Gerar link público
            </button>

            {generatedInviteUrl && (
              <button
                type="button"
                onClick={handleCopyInvite}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-purple/25 hover:text-brand-purple"
              >
                <Copy className="h-4 w-4" />
                Copiar link
              </button>
            )}
          </div>

          {generatedInviteUrl && (
            <div className="mt-4 rounded-[1.5rem] border border-brand-orange/20 bg-brand-orange/10 px-4 py-4 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">Link gerado</p>
              <a
                href={generatedInviteUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-brand-purple underline-offset-4 hover:underline"
              >
                {generatedInviteUrl}
              </a>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
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
              <RefreshCcw className={`h-4 w-4 ${listLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          <div className="max-h-[72vh] overflow-y-auto p-3">
            {listContent}
          </div>

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
                  {selectedConversation?.conversation_id || 'Selecione uma conversa'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Histórico completo, anexos e dados extraídos do orquestrador.
                </p>
              </div>

              {selectedConversation && (
                <button
                  type="button"
                  onClick={() => handleDelete(selectedConversation.conversation_id)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir conversa
                </button>
              )}
            </div>
          </div>

          {detailContent}
        </section>
      </div>
    </div>
  );
}