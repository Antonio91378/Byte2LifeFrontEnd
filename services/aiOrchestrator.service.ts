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

export interface BotTrainingVerification {
  verified: boolean;
  updated_at?: string | null;
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
  training_verification?: BotTrainingVerification | null;
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
  display_name: string;
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
  training_verification?: BotTrainingVerification | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface BotTrainingReviewPromptResponse {
  total_conversations: number;
  total_pending: number;
  conversation_ids: string[];
  conversation_id: string | null;
  conversation_label: string | null;
  prompt: string;
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
    trainingVerification?: string;
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
  if (filters?.trainingVerification)
    params.set("training_verification", filters.trainingVerification);
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

export async function setBotConversationTrainingVerification(
  baseUrl: string,
  conversationId: string,
  payload: {
    verified: boolean;
  },
) {
  return request<{ conversation: BotConversation }>(
    baseUrl,
    `/conversations/${encodeURIComponent(conversationId)}/training-verification`,
    {
      method: "POST",
      body: JSON.stringify({
        verified: payload.verified,
      }),
    },
  );
}

export async function getBotTrainingReviewPrompt(baseUrl: string) {
  return request<BotTrainingReviewPromptResponse>(
    baseUrl,
    "/training/review-prompt",
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
    orchestratorBaseUrl?: string;
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
      orchestrator_base_url: payload.orchestratorBaseUrl,
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

// ─── Visual Flow Dashboard types ────────────────────────────────────────────

export interface FlowStageBranch {
  id: string;
  label: string;
  next: string[];
}

export interface FlowStage {
  id: string;
  label: string;
  layer: 'input' | 'core' | 'action' | 'output';
  color: string;
  icon: string;
  description?: string;
  docs?: string;
  skill?: string;
  requiresLock?: boolean | string;
  optional?: boolean;
  events?: string[];
  next?: string[];
  branches?: FlowStageBranch[];
  implementationPath?: string;
  /** Per-stage timeout in ms. Overrides global resourcePolicy.localTimeoutMs for this stage. */
  timeoutMs?: number;
}

export interface FlowDefinition {
  version: string;
  stages: FlowStage[];
  skills: Record<string, unknown>;
  resourcePolicy: {
    localConcurrency: number;
    preferCloud: boolean;
    cloudFallbackEnabled?: boolean;
    localTimeoutMs: number;
    /** Timeout for the job queue (queue stage). Defaults to 180000ms if absent. */
    queueTimeoutMs?: number;
  };
  featureFlags: Record<string, boolean>;
  company?: {
    id: string;
    name: string;
    whitelabel?: {
      theme?: string;
      primary?: string;
      accent?: string;
      secondary?: string;
    };
  };
}

export interface StageEvent {
  eventName: string;
  payload: Record<string, unknown>;
  ts: number;
}

export interface ResourceStatus {
  busy: boolean;
  currentTask: { id: string; skillName: string; acquiredAt: number } | null;
  queueDepth: number;
}

export interface LLMProviderConfig {
  id: string;
  kind: 'local' | 'cloud';
  label?: string;
  baseUrl?: string;
  envKey?: string;
  models?: string[];
  requiresLock?: boolean;
}

export interface LLMSkillConfig {
  purpose?: string;
  provider: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: string;
  executionMode?: string;
  requiresLock?: boolean;
  requiresVision?: boolean;
  fallback?: { provider: string; model?: string };
}

export interface LLMProvidersResponse {
  providers: LLMProviderConfig[];
  skills: Record<string, LLMSkillConfig>;
}

// ─── Visual Flow Dashboard functions ─────────────────────────────────────────

export async function getFlowDefinition(baseUrl: string): Promise<FlowDefinition> {
  return request<FlowDefinition>(baseUrl, '/flow/definition');
}

export async function getResourceStatus(baseUrl: string): Promise<ResourceStatus> {
  return request<ResourceStatus>(baseUrl, '/resource/status');
}

export async function updateResourcePolicy(
  baseUrl: string,
  patch: { localTimeoutMs?: number; queueTimeoutMs?: number },
): Promise<{ ok: boolean; resourcePolicy: FlowDefinition['resourcePolicy'] }> {
  return request(baseUrl, '/flow/resource-policy', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function updateStageTimeout(
  baseUrl: string,
  stageId: string,
  timeoutMs: number,
): Promise<{ ok: boolean; stage: FlowStage }> {
  return request(baseUrl, `/flow/stage/${encodeURIComponent(stageId)}/timeout`, {
    method: 'PUT',
    body: JSON.stringify({ timeoutMs }),
  });
}

export async function getLLMProviders(baseUrl: string): Promise<LLMProvidersResponse> {
  return request<LLMProvidersResponse>(baseUrl, '/flow/providers');
}

export async function updateSkillProvider(
  baseUrl: string,
  skillName: string,
  update: { provider?: string; model?: string; temperature?: number; maxTokens?: number; fallback?: { provider: string; model?: string } },
): Promise<void> {
  const url = `${normalizeBaseUrl(baseUrl)}/flow/skill/${encodeURIComponent(skillName)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error(`Failed to update skill ${skillName}: ${res.status}`);
}

/**
 * Subscribe to real-time pipeline events for a conversation via SSE.
 * Returns a cleanup function to close the EventSource.
 *
 * The first event received is `{ type: 'trace_replay', events: StageEvent[] }`
 * containing all past events for that conversation. Subsequent events are
 * individual StageEvent objects.
 */
export function subscribeToFlowEvents(
  baseUrl: string,
  conversationId: string,
  onEvent: (raw: { type?: string; events?: StageEvent[] } & Partial<StageEvent>) => void,
): () => void {
  const url = `${normalizeBaseUrl(baseUrl)}/flow/live/${encodeURIComponent(conversationId)}`;
  const source = new EventSource(url);

  source.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {
      // Ignore malformed events
    }
  };

  return () => source.close();
}

// ─── Image Generation Workflow types & functions ──────────────────────────────

export interface ImageWorkflowProvider {
  name: string;
  label?: string;
  executionMode: 'cloud' | 'local';
  requiresLock?: boolean;
  enabled: boolean;
  priority: number;
  workflowPath?: string | null;
  generationType?: 'text2img' | 'img2img' | 'pulid';
  description?: string;
  prePrompt?: string;
  envKey?: string | null;
  preferWhen?: string;
  /** Per-workflow timeout in ms. Overrides global resourcePolicy.localTimeoutMs for this provider. */
  timeoutMs?: number;
}

export async function getImageWorkflows(baseUrl: string): Promise<{
  providers: ImageWorkflowProvider[];
  strategy: string;
  maxAttempts: number;
}> {
  return request(baseUrl, '/flow/image-workflows');
}

export async function addImageWorkflow(
  baseUrl: string,
  provider: Omit<ImageWorkflowProvider, 'priority'> & { priority?: number },
): Promise<{ ok: boolean; provider: ImageWorkflowProvider }> {
  return request(baseUrl, '/flow/image-workflows', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(provider),
  });
}

export async function updateImageWorkflow(
  baseUrl: string,
  name: string,
  patch: Partial<ImageWorkflowProvider>,
): Promise<{ ok: boolean; provider: ImageWorkflowProvider }> {
  return request(baseUrl, `/flow/image-workflows/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function deleteImageWorkflow(
  baseUrl: string,
  name: string,
): Promise<{ ok: boolean }> {
  return request(baseUrl, `/flow/image-workflows/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

export async function updateImageDispatcher(
  baseUrl: string,
  patch: { strategy?: string; maxAttempts?: number },
): Promise<{ ok: boolean }> {
  return request(baseUrl, '/flow/image-gen', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export interface ImageRouterConfig {
  model: string;
  provider: string;
  timeoutMs: number;
}

export async function getImageGenConfig(baseUrl: string): Promise<{
  providers: ImageWorkflowProvider[];
  strategy: string;
  maxAttempts: number;
  routerConfig: ImageRouterConfig;
}> {
  return request(baseUrl, '/flow/image-gen');
}

export async function updateImageRouterConfig(
  baseUrl: string,
  routerConfig: Partial<ImageRouterConfig>,
): Promise<{ ok: boolean }> {
  return request(baseUrl, '/flow/image-gen', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ routerConfig }),
  });
}

// ─── LLM Extraction config ───────────────────────────────────────────────────

export interface ExtractionSkillConfig {
  purpose?: string;
  provider: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: string;
  executionMode?: string;
  requiresLock?: boolean;
  /** Primary LLM HTTP abort timeout in ms. Stage total = timeoutMs + fallback.timeoutMs. */
  timeoutMs?: number;
  fallback?: { provider: string; model?: string; timeoutMs?: number };
}

export interface LLMConfigResponse {
  skills: { extraction: ExtractionSkillConfig };
  providers: Record<string, LLMProviderConfig>;
}

export async function getLLMConfig(baseUrl: string): Promise<LLMConfigResponse> {
  return request<LLMConfigResponse>(baseUrl, '/flow/llm-config');
}

export interface ProviderHealthResult {
  ok: boolean;
  reason: string | null;
}

export interface ImageProviderHealthResult {
  ok: boolean;
  enabled: boolean;
  reason: string | null;
  label: string;
}

export interface RouterHealthResult {
  model: string | null;
  source: 'env' | 'flow_json' | 'none';
  ok: boolean;
  reason: string | null;
}

export interface FullProviderHealth {
  providers: Record<string, ProviderHealthResult>;
  imageProviders: Record<string, ImageProviderHealthResult>;
  router: RouterHealthResult;
  skills?: Record<string, SkillHealthStatus>;
}

export async function getProviderHealth(
  baseUrl: string,
): Promise<FullProviderHealth> {
  return request(baseUrl, '/flow/provider-health');
}

export async function updateExtractionConfig(
  baseUrl: string,
  patch: Partial<ExtractionSkillConfig>,
): Promise<{ ok: boolean; extraction: ExtractionSkillConfig }> {
  return request(baseUrl, '/flow/llm-config/extraction', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function getProviderModels(
  baseUrl: string,
  providerId: string,
  opts?: { visionOnly?: boolean },
): Promise<{ models: string[] }> {
  const suffix = opts?.visionOnly ? '?vision=true' : '';
  return request(baseUrl, `/flow/provider-models/${encodeURIComponent(providerId)}${suffix}`);
}

// ─── Vision Descriptor config ─────────────────────────────────────────────────

export interface VisionDescriptorSkillConfig {
  enabled: boolean;
  provider: string;
  model?: string;
  timeoutMs?: number;
  requiresLock?: boolean;
  fallback?: { provider: string; model?: string };
  notes?: string;
}

export async function getVisionDescriptorConfig(baseUrl: string): Promise<VisionDescriptorSkillConfig> {
  return request<VisionDescriptorSkillConfig>(baseUrl, '/flow/vision-descriptor');
}

export async function updateVisionDescriptorConfig(
  baseUrl: string,
  patch: Partial<VisionDescriptorSkillConfig>,
): Promise<{ ok: boolean; skill: VisionDescriptorSkillConfig }> {
  return request(baseUrl, '/flow/vision-descriptor', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

// ─── Image Judge config ───────────────────────────────────────────────────────

export interface ImageJudgeSkillConfig {
  purpose?: string;
  provider?: string;
  model?: string;
  temperature?: number;
  executionMode?: string;
  requiresLock?: boolean;
  requiresVision?: boolean;
  fallback?: { provider: string; model?: string };
  enabledEnvFlag?: string;
}

export interface SkillHealthStatus {
  ok: boolean;
  label: string;
  model: string | null;
  source: 'flow_json' | 'env' | 'none';
  reason: string | null;
}

export async function getImageJudgeConfig(baseUrl: string): Promise<ImageJudgeSkillConfig> {
  return request<ImageJudgeSkillConfig>(baseUrl, '/flow/image-judge');
}

export async function updateImageJudgeConfig(
  baseUrl: string,
  patch: Partial<ImageJudgeSkillConfig>,
): Promise<{ ok: boolean; skill: ImageJudgeSkillConfig }> {
  return request(baseUrl, '/flow/image-judge', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

// ─── Custom Workflows Registry ────────────────────────────────────────────────

export interface DiscoveredWorkflow {
  filename: string;
  label: string;
  enabled: boolean;
  priority: number;
  generationType: 'txt2img' | 'img2img';
  /** "api" = executável · "ui" = UI format clássico · "ui_subgraph" = template com subgraph */
  format: 'api' | 'ui' | 'ui_subgraph' | 'unknown';
  promptNodeId: string | null;
  lastScanned?: string;
}

export interface CustomWorkflowsState {
  folder: string | null;
  discovered: Record<string, DiscoveredWorkflow>;
}

export async function getCustomWorkflows(baseUrl: string): Promise<CustomWorkflowsState> {
  return request<CustomWorkflowsState>(baseUrl, '/flow/custom-workflows');
}

export async function scanCustomWorkflows(
  baseUrl: string,
  folder?: string,
): Promise<{ ok: boolean; folder: string; discovered: Record<string, DiscoveredWorkflow>; count: number }> {
  return request(baseUrl, '/flow/custom-workflows/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(folder ? { folder } : {}),
  });
}

export async function updateCustomWorkflow(
  baseUrl: string,
  name: string,
  patch: Partial<Pick<DiscoveredWorkflow, 'label' | 'enabled' | 'priority' | 'generationType' | 'promptNodeId'>>,
): Promise<{ ok: boolean; workflow: DiscoveredWorkflow }> {
  return request(baseUrl, `/flow/custom-workflows/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
}
