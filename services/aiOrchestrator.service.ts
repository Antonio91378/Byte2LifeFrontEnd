export interface BotConversationAttachment {
  type?: string | null;
  filename?: string | null;
  url?: string | null;
  ext?: string | null;
  prompt?: string | null;
  provider?: string | null;
}

export interface BotConversationBlocker {
  kind: string;
  owner: string;
  label: string;
  detail: string;
  reason_codes?: string[];
}

export interface BotPublicInvite {
  enabled: boolean;
  label?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  max_messages?: number | null;
  messages_used?: number | null;
  remaining_messages?: number | null;
  last_message_at?: string | null;
  token?: string;
  url?: string;
}

export interface BotConversationAccess {
  mode?: string | null;
  public_invite?: BotPublicInvite | null;
}

export interface BotSuggestedModel {
  rank?: number | null;
  term?: string | null;
  url?: string | null;
  source?: string | null;
}

export interface BotConversationMessage {
  message_id?: string;
  direction?: string;
  text?: string | null;
  sent_at?: string | null;
  received_at?: string | null;
  attachments?: BotConversationAttachment[];
  meta?: Record<string, unknown> | null;
}

export interface BotPromptTraceMessage {
  role?: string | null;
  content?: string | null;
  image_count?: number | null;
}

export interface BotLlmPromptTrace {
  trace_id?: string;
  at?: string | null;
  provider?: string | null;
  model?: string | null;
  num_ctx?: number | null;
  source_message_id?: string | null;
  conversation_id?: string | null;
  request_messages?: BotPromptTraceMessage[];
  output?: {
    reply?: string | null;
    intent?: string | null;
    generate_image?: boolean;
    image_prompt?: string | null;
    needs_human?: boolean;
  } | null;
  error?: string | null;
  fallback_used?: boolean;
}

export interface BotImagePromptTrace {
  trace_id?: string;
  at?: string | null;
  provider?: string | null;
  workflow_type?: string | null;
  workflow_path?: string | null;
  requested_provider?: string | null;
  source_message_id?: string | null;
  conversation_id?: string | null;
  prompt_text?: string | null;
  reference_mode?: string | null;
  reference_image_count?: number | null;
  reference_filename?: string | null;
  fallback_from?: string | null;
  prompt_id?: string | null;
  output_url?: string | null;
  status?: string | null;
  error?: string | null;
  reason?: string | null;
}

export interface BotConversation {
  conversation_id: string;
  state: string;
  channel?: string | null;
  sender_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_reply?: string | null;
  last_image?:
    | (BotConversationAttachment & { generated_at?: string | null })
    | null;
  attachments?: BotConversationAttachment[];
  messages?: BotConversationMessage[];
  suggested_models?: BotSuggestedModel[];
  missing_fields?: Array<{ path?: string; label?: string; reason?: string }>;
  blocker?: BotConversationBlocker | null;
  access?: BotConversationAccess | null;
  developer_note?: {
    note?: string | null;
    updated_at?: string | null;
  } | null;
  integration?: {
    backend_client_id?: string | null;
    backend_sale_id?: string | null;
  } | null;
  prompt_traces?: {
    llm?: BotLlmPromptTrace[];
    image_generation?: BotImagePromptTrace[];
  } | null;
  extracted_data?: {
    client?: {
      name?: string | null;
      phoneNumber?: string | null;
    };
    order?: {
      description?: string | null;
      productStyle?: string | null;
      referenceImageDescription?: string | null;
    };
    sale?: {
      saleValue?: number | null;
      deliveryDate?: string | null;
    };
  };
}

export interface BotConversationSummary {
  conversation_id: string;
  state: string;
  channel: string;
  sender_id?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  order_description?: string | null;
  product_style?: string | null;
  last_reply?: string | null;
  last_message_preview: string;
  message_count: number;
  attachment_count: number;
  attachment_types: string[];
  attachment_names: string[];
  missing_fields_count: number;
  has_generated_image: boolean;
  blocker: BotConversationBlocker;
  access_mode?: string | null;
  public_invite?: BotPublicInvite | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface BotConversationListResponse {
  conversations: BotConversationSummary[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

export interface BotRuntimeStatus {
  status: string;
  service: string;
  heartbeat?: {
    status?: string;
    checked_at?: string | null;
  } | null;
  llm?: {
    provider?: string | null;
    model?: string | null;
    label?: string | null;
    local_url?: string | null;
  } | null;
  image?: {
    provider?: string | null;
    comfyui?: {
      available?: boolean;
      url?: string | null;
    } | null;
  } | null;
  persistence?: {
    strategy?: string | null;
    local_mirror_path?: string | null;
    mongo?: {
      enabled?: boolean;
      db_name?: string | null;
      collection_name?: string | null;
    } | null;
  } | null;
  queue?: {
    pending?: number;
    active?: boolean;
    totalProcessed?: number;
  } | null;
  public_chat?: {
    enabled?: boolean;
    invite_ttl_hours?: number | null;
    max_messages_per_invite?: number | null;
    max_message_chars?: number | null;
    max_attachments_per_message?: number | null;
  } | null;
}

const DEFAULT_AI_ORCHESTRATOR_URL =
  process.env.NEXT_PUBLIC_AI_ORCHESTRATOR_URL || "http://localhost:4310";

const STORAGE_KEY = "byte2life.aiOrchestratorBaseUrl";

function normalizeBaseUrl(value?: string | null) {
  const raw = (value || DEFAULT_AI_ORCHESTRATOR_URL).trim();
  return raw.replace(/\/+$/, "");
}

async function request<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Não foi possível conectar ao ai-orchestrator.",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const raw = await response.text();
  const body = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new Error(
      body?.message ||
        body?.error ||
        `Request failed with status ${response.status}`,
    );
  }

  return body as T;
}

export function getDefaultAiOrchestratorBaseUrl() {
  return normalizeBaseUrl(DEFAULT_AI_ORCHESTRATOR_URL);
}

export function getStoredAiOrchestratorBaseUrl() {
  if (globalThis.window === undefined) {
    return getDefaultAiOrchestratorBaseUrl();
  }

  const stored = globalThis.window.localStorage.getItem(STORAGE_KEY);
  return normalizeBaseUrl(stored || DEFAULT_AI_ORCHESTRATOR_URL);
}

export function saveAiOrchestratorBaseUrl(value: string) {
  const normalized = normalizeBaseUrl(value);
  if (globalThis.window !== undefined) {
    globalThis.window.localStorage.setItem(STORAGE_KEY, normalized);
  }
  return normalized;
}

export function resolveAiOrchestratorAssetUrl(
  baseUrl: string,
  assetUrl?: string | null,
) {
  if (!assetUrl) return null;

  try {
    return new URL(assetUrl).toString();
  } catch {
    const normalizedAssetUrl = assetUrl.startsWith("/")
      ? assetUrl
      : `/${assetUrl}`;
    return `${normalizeBaseUrl(baseUrl)}${normalizedAssetUrl}`;
  }
}

export async function listBotConversations(
  baseUrl: string,
  filters?: {
    search?: string;
    state?: string;
    channel?: string;
    attachmentType?: string;
    page?: number;
    limit?: number;
  },
) {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.state) params.set("state", filters.state);
  if (filters?.channel) params.set("channel", filters.channel);
  if (filters?.attachmentType)
    params.set("attachment_type", filters.attachmentType);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));
  const suffix = params.size ? `?${params.toString()}` : "";

  return request<BotConversationListResponse>(
    baseUrl,
    `/conversations${suffix}`,
  );
}

export async function getBotConversation(
  baseUrl: string,
  conversationId: string,
) {
  return request<{ conversation: BotConversation }>(
    baseUrl,
    `/conversations/${encodeURIComponent(conversationId)}`,
  );
}

export async function saveBotConversationDeveloperNote(
  baseUrl: string,
  conversationId: string,
  payload: {
    note: string;
  },
) {
  return request<{ conversation: BotConversation }>(
    baseUrl,
    `/conversations/${encodeURIComponent(conversationId)}/developer-note`,
    {
      method: "POST",
      body: JSON.stringify({
        note: payload.note,
      }),
    },
  );
}

export async function simulateBotConversation(
  baseUrl: string,
  payload: {
    conversationId: string;
    message: string;
    senderId?: string;
    channel?: string;
    attachments?: BotConversationAttachment[];
  },
) {
  return request<{
    conversation: BotConversation;
    queue_stats?: BotRuntimeStatus["queue"];
  }>(baseUrl, "/simulate-message", {
    method: "POST",
    body: JSON.stringify({
      conversation_id: payload.conversationId,
      sender_id: payload.senderId,
      channel: payload.channel,
      message: payload.message,
      attachments: payload.attachments,
    }),
  });
}

export async function getBotRuntimeStatus(baseUrl: string) {
  return request<BotRuntimeStatus>(baseUrl, "/health");
}

export async function createPublicBotInvite(
  baseUrl: string,
  payload: {
    frontendBaseUrl?: string;
    label?: string;
    expiresInHours?: number;
    maxMessages?: number;
  },
) {
  return request<{
    invite: BotPublicInvite;
    conversation: BotConversation;
  }>(baseUrl, "/public/invites", {
    method: "POST",
    body: JSON.stringify({
      frontend_base_url: payload.frontendBaseUrl,
      label: payload.label,
      expires_in_hours: payload.expiresInHours,
      max_messages: payload.maxMessages,
    }),
  });
}

export async function getPublicBotInvite(baseUrl: string, inviteToken: string) {
  return request<{
    invite: BotPublicInvite;
    conversation: BotConversation;
  }>(baseUrl, `/public/invites/${encodeURIComponent(inviteToken)}`);
}

export async function sendPublicBotInviteMessage(
  baseUrl: string,
  inviteToken: string,
  payload: {
    message: string;
    attachments?: BotConversationAttachment[];
  },
) {
  return request<{
    invite: BotPublicInvite;
    conversation: BotConversation;
  }>(baseUrl, `/public/invites/${encodeURIComponent(inviteToken)}/messages`, {
    method: "POST",
    body: JSON.stringify({
      message: payload.message,
      attachments: payload.attachments,
    }),
  });
}

export async function uploadPublicBotInviteAttachment(
  baseUrl: string,
  inviteToken: string,
  payload: {
    filename: string;
    data: string;
  },
) {
  return request<BotConversationAttachment>(
    baseUrl,
    `/public/invites/${encodeURIComponent(inviteToken)}/upload`,
    {
      method: "POST",
      body: JSON.stringify({
        filename: payload.filename,
        data: payload.data,
      }),
    },
  );
}

export async function deleteBotConversation(
  baseUrl: string,
  conversationId: string,
) {
  return request<void>(
    baseUrl,
    `/conversations/${encodeURIComponent(conversationId)}`,
    { method: "DELETE" },
  );
}
