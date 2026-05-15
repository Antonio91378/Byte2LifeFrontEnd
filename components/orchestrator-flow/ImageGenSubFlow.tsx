'use client';

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AnimatePresence, motion } from 'framer-motion';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import { useResizablePanel } from '../../hooks/useResizablePanel';
import { ModelSelector } from './ModelSelector';
import {
  addImageWorkflow,
  deleteImageWorkflow,
  getImageGenConfig,
  getImageWorkflows,
  getVisionDescriptorConfig,
  subscribeToFlowEvents,
  updateImageDispatcher,
  updateImageRouterConfig,
  updateImageWorkflow,
  updateVisionDescriptorConfig,
  type FlowDefinition,
  type ImageRouterConfig,
  type ImageWorkflowProvider,
  type StageEvent,
  type VisionDescriptorSkillConfig,
} from '../../services/aiOrchestrator.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageGenSubFlowProps {
  baseUrl: string;
  definition: FlowDefinition;
  onBack: () => void;
  conversationId?: string | null;
}

type NodeStatus = 'idle' | 'active' | 'completed' | 'failed';

interface AddNodeData extends Record<string, unknown> {
  onAdd: () => void;
}

interface DispatcherNodeData extends Record<string, unknown> {
  strategy: string;
  maxAttempts: number;
  onOpenPanel: () => void;
  status?: NodeStatus;
}

interface LLMRouterNodeData extends Record<string, unknown> {
  model: string;
  provider: string;
  visionEnabled: boolean;
  visionModel: string;
  onOpenPanel: () => void;
  status?: NodeStatus;
}

interface WorkflowNodeData extends Record<string, unknown> {
  provider: ImageWorkflowProvider;
  onToggle: (name: string, enabled: boolean) => void;
  onEdit: (name: string) => void;
  status?: NodeStatus;
  isActiveProvider?: boolean;
}

// ─── Label styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 9,
  color: '#f97316aa',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 4,
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  background: '#1a0a00',
  color: '#ffffff',
  border: '1px solid #f9731444',
  borderRadius: 6,
  fontFamily: 'monospace',
  fontSize: 10,
  padding: '6px 10px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

// ─── WorkflowProviderNode (custom ReactFlow node) ─────────────────────────────

function WorkflowProviderNode({ data }: NodeProps) {
  const { provider, onToggle, onEdit, status = 'idle', isActiveProvider = false } = data as WorkflowNodeData;

  const isEnabled = provider.enabled !== false;
  const isCloud = provider.executionMode === 'cloud';
  const accentColor = isEnabled ? (isCloud ? '#22d3ee' : '#f97316') : '#666666';
  const isAnimated = status === 'active' || isActiveProvider;
  const glowShadow = isActiveProvider
    ? `0 0 22px ${accentColor}`
    : status === 'active'
      ? `0 0 14px ${accentColor}99`
      : 'none';

  const genTypeLabel =
    provider.generationType === 'img2img'
      ? 'img→img'
      : provider.generationType === 'pulid'
        ? 'PuLID'
        : 'txt→img';

  const descSnippet = provider.description
    ? provider.description.slice(0, 70)
    : null;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onEdit(provider.name);
      }}
      style={{
        background: isEnabled ? (isCloud ? '#001a22' : '#1a0a00') : '#111111',
        border: `1.5px solid ${isEnabled ? accentColor : '#333333'}`,
        borderRadius: 10,
        padding: '10px 12px',
        minWidth: 160,
        maxWidth: 200,
        fontFamily: 'monospace',
        opacity: isEnabled ? 1 : 0.45,
        transition: 'opacity 0.2s, border-color 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
        boxShadow: glowShadow,
        animation: isAnimated ? 'nodeGlow 1.4s ease-in-out infinite alternate' : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isAnimated) (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 12px ${accentColor}66`;
      }}
      onMouseLeave={(e) => {
        if (!isAnimated) (e.currentTarget as HTMLDivElement).style.boxShadow = glowShadow;
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: accentColor, borderColor: accentColor }}
      />

      {/* Top row: label + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span
          style={{
            color: isEnabled ? accentColor : '#777777',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.03em',
            wordBreak: 'break-word',
            flex: 1,
            marginRight: 6,
          }}
        >
          {provider.label ?? provider.name}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(provider.name, !isEnabled);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
          }}
          title={isEnabled ? 'Desativar' : 'Ativar'}
        >
          {isEnabled ? (
            <ToggleRight size={18} style={{ color: '#22c55e' }} />
          ) : (
            <ToggleLeft size={18} style={{ color: '#555555' }} />
          )}
        </button>
      </div>

      {/* Badge row */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: descSnippet || provider.envKey ? 6 : 0 }}>
        <span
          style={{
            fontSize: 9,
            background: `${accentColor}22`,
            color: accentColor,
            borderRadius: 4,
            padding: '1px 5px',
            border: `1px solid ${accentColor}44`,
          }}
        >
          {isCloud ? '☁️ cloud' : '🖥 local'}
        </span>
        <span
          style={{
            fontSize: 9,
            background: '#ffffff11',
            color: '#ffffff88',
            borderRadius: 4,
            padding: '1px 5px',
            border: '1px solid #ffffff22',
          }}
        >
          {genTypeLabel}
        </span>
      </div>

      {/* Description snippet */}
      {descSnippet && (
        <div
          style={{
            fontSize: 9,
            color: '#ffffff44',
            lineHeight: 1.4,
            marginBottom: provider.envKey ? 4 : 0,
            wordBreak: 'break-word',
          }}
        >
          {descSnippet}
          {provider.description && provider.description.length > 70 ? '…' : ''}
        </div>
      )}

      {/* Env key + status dot */}
      {provider.envKey && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isEnabled ? '#22c55e' : '#555555',
              flexShrink: 0,
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontSize: 8,
              color: '#ffffff33',
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {provider.envKey}
          </span>
        </div>
      )}

      {/* Pre-prompt indicator */}
      {provider.prePrompt && (
        <div
          style={{
            marginTop: 5,
            fontSize: 8,
            color: `${accentColor}88`,
            fontFamily: 'monospace',
            letterSpacing: '0.04em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          ✎ pré-prompt ativo
        </div>
      )}

      {/* Edit hint */}
      <div
        style={{
          marginTop: 6,
          fontSize: 8,
          color: `${accentColor}55`,
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
          textAlign: 'right',
        }}
      >
        ✎ editar
      </div>
    </div>
  );
}

// ─── DispatcherNode (custom ReactFlow node) ───────────────────────────────────

function DispatcherNode({ data }: NodeProps) {
  const { strategy, maxAttempts, onOpenPanel, status = 'idle' } = data as DispatcherNodeData;
  const borderColor = status === 'active' ? '#c026d3' : status === 'completed' ? '#22c55eaa' : '#c026d3aa';

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onOpenPanel();
      }}
      style={{
        background: '#1a0028',
        border: `1.5px solid ${borderColor}`,
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 150,
        fontFamily: 'monospace',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 14px ${borderColor}88`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = status === 'active' ? `0 0 16px ${borderColor}` : 'none';
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: borderColor, borderColor }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: borderColor, borderColor }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 13 }}>⎇</span>
        <span
          style={{
            color: borderColor,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          Dispatcher
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 8,
            color: '#c026d388',
            letterSpacing: '0.06em',
          }}
        >
          ⚙ config
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 9,
            background: '#c026d322',
            color: '#c026d3',
            borderRadius: 4,
            padding: '1px 5px',
            border: '1px solid #c026d344',
          }}
        >
          {strategy}
        </span>
        <span
          style={{
            fontSize: 9,
            background: '#ffffff11',
            color: '#ffffff66',
            borderRadius: 4,
            padding: '1px 5px',
            border: '1px solid #ffffff22',
          }}
        >
          max {maxAttempts}
        </span>
      </div>
    </div>
  );
}

// ─── LLMRouterNode (custom ReactFlow node) ───────────────────────────────────

function LLMRouterNode({ data }: NodeProps) {
  const { model, provider, visionEnabled, visionModel, onOpenPanel, status = 'idle' } = data as LLMRouterNodeData;
  const isEnabled = !!model;
  const isActive = status === 'active';
  const isCompleted = status === 'completed';
  const color = isActive ? '#22d3ee' : isCompleted ? '#22c55ecc' : isEnabled ? '#22d3ee99' : '#555555';

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onOpenPanel(); }}
      style={{
        background: isActive ? '#001522' : '#080f12',
        border: `1.5px solid ${color}`,
        borderRadius: 10,
        padding: '8px 12px',
        minWidth: 160,
        fontFamily: 'monospace',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        boxShadow: isActive ? `0 0 16px ${color}` : 'none',
        animation: isActive ? 'nodeGlow 1.4s ease-in-out infinite alternate' : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 12px ${color}66`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = isActive ? `0 0 16px ${color}` : 'none';
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, borderColor: color }} />
      <Handle type="source" position={Position.Right} style={{ background: color, borderColor: color }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 11 }}>🤖</span>
        <span style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>LLM Router</span>
        {isActive && (
          <span style={{ color: '#22d3ee', fontSize: 8, marginLeft: 'auto' }}>●</span>
        )}
        <span style={{ fontSize: 8, color: `${color}66`, marginLeft: isActive ? 0 : 'auto' }}>⚙</span>
      </div>

      <div style={{ fontSize: 9, fontFamily: 'monospace', marginBottom: 4 }}>
        {isEnabled ? (
          <>
            <span style={{ color: `${color}99` }}>{provider}: </span>
            <span style={{ color }}>
              {model.length > 18 ? model.slice(0, 18) + '…' : model}
            </span>
          </>
        ) : (
          <span style={{ color: '#555555', fontStyle: 'italic' }}>desabilitado</span>
        )}
      </div>

      <div style={{ fontSize: 8, fontFamily: 'monospace', color: visionEnabled ? '#a855f7aa' : '#ffffff22', borderTop: '1px solid #ffffff0d', paddingTop: 4 }}>
        <span style={{ marginRight: 4 }}>👁</span>
        {visionEnabled && visionModel ? (
          <span style={{ color: '#a855f7' }}>{visionModel.length > 20 ? visionModel.slice(0, 20) + '…' : visionModel}</span>
        ) : (
          <span style={{ fontStyle: 'italic' }}>vision: off</span>
        )}
      </div>
    </div>
  );
}

// ─── AddNode (custom ReactFlow node) ─────────────────────────────────────────

function AddWorkflowNode({ data }: NodeProps) {
  const { onAdd } = data as AddNodeData;

  return (
    <div
      onClick={onAdd}
      style={{
        background: 'transparent',
        border: '1.5px dashed #ffffff22',
        borderRadius: 10,
        padding: '10px 12px',
        minWidth: 160,
        maxWidth: 200,
        fontFamily: 'monospace',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#ffffff44';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#ffffff22';
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#ffffff22', borderColor: '#ffffff22' }}
      />
      <span style={{ color: '#666666', fontSize: 11 }}>+ Novo workflow</span>
    </div>
  );
}

// ─── Panel sub-components (info blocks used in side panels) ──────────────────

const infoText: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 9,
  color: '#ffffff77',
  lineHeight: 1.75,
  margin: 0,
};

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: `${color}0a`,
        border: `1px solid ${color}22`,
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 9,
          fontWeight: 700,
          color,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function DecisionStep({
  step, color, condition, result, note,
}: {
  step: string;
  color: string;
  condition: string;
  result: string;
  note: string;
}) {
  return (
    <div
      style={{
        background: '#ffffff06',
        border: `1px solid ${color}22`,
        borderRadius: 6,
        padding: '7px 10px',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}
    >
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 9,
          fontWeight: 700,
          color,
          flexShrink: 0,
          width: 12,
          paddingTop: 1,
        }}
      >
        {step}
      </span>
      <div>
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff88' }}>
          {condition}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 9, color, fontWeight: 700, marginTop: 2 }}>
          {result}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff44', marginTop: 2, lineHeight: 1.5 }}>
          {note}
        </div>
      </div>
    </div>
  );
}

// ─── ResizeHandle ─────────────────────────────────────────────────────────────

function ResizeHandle({ onMouseDown, color }: { onMouseDown: (e: React.MouseEvent) => void; color: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 6,
        cursor: 'ew-resize',
        zIndex: 30,
        background: hovered ? `${color}55` : 'transparent',
        transition: 'background 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {hovered && (
        <div style={{ width: 2, height: 40, borderRadius: 2, background: color, boxShadow: `0 0 8px ${color}` }} />
      )}
    </div>
  );
}

// ─── NODE_TYPES / EDGE_TYPES (defined outside component to avoid re-registering) ───

const NODE_TYPES = {
  workflowNode: WorkflowProviderNode,
  dispatcherNode: DispatcherNode,
  llmRouterNode: LLMRouterNode,
  addNode: AddWorkflowNode,
};

const EDGE_TYPES = {};

// ─── Graph builder ────────────────────────────────────────────────────────────

function buildNodes(
  providers: ImageWorkflowProvider[],
  strategy: string,
  maxAttempts: number,
  routerConfig: ImageRouterConfig,
  visionConfig: VisionDescriptorSkillConfig,
  onToggle: (name: string, enabled: boolean) => void,
  onAdd: () => void,
  onOpenDispatcherPanel: () => void,
  onOpenRouterPanel: () => void,
  onEdit: (name: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const centerY = (providers.length * 110) / 2;

  const nodes: Node[] = [
    {
      id: 'entry',
      type: 'default',
      position: { x: 0, y: centerY - 30 },
      data: { label: '🖼 Image Gen' },
      style: {
        background: '#3a1a00',
        border: '1.5px solid #f97316',
        borderRadius: 10,
        color: '#f97316',
        fontFamily: 'monospace',
        fontSize: 11,
        fontWeight: 700,
        padding: '8px 14px',
        minWidth: 120,
        textAlign: 'center',
      },
    },
    {
      id: 'dispatcher',
      type: 'dispatcherNode',
      position: { x: 200, y: centerY - 40 },
      data: { strategy, maxAttempts, onOpenPanel: onOpenDispatcherPanel } as DispatcherNodeData,
    },
    {
      id: 'llmRouter',
      type: 'llmRouterNode',
      position: { x: 390, y: centerY - 35 },
      data: { model: routerConfig.model, provider: routerConfig.provider, visionEnabled: visionConfig.enabled ?? false, visionModel: visionConfig.model ?? '', onOpenPanel: onOpenRouterPanel } as LLMRouterNodeData,
    },
    ...providers.map((p, i) => ({
      id: `provider_${p.name}`,
      type: 'workflowNode',
      position: { x: 590, y: i * 110 },
      data: {
        provider: p,
        onToggle,
        onEdit,
      } as WorkflowNodeData,
    })),
    {
      id: 'addNode',
      type: 'addNode',
      position: { x: 590, y: providers.length * 110 },
      data: { onAdd } as AddNodeData,
    },
  ];

  const edges: Edge[] = [
    {
      id: 'entry→dispatcher',
      source: 'entry',
      target: 'dispatcher',
      style: { stroke: '#f9731688', strokeWidth: 1.5 },
      animated: false,
    },
    {
      id: 'dispatcher→llmRouter',
      source: 'dispatcher',
      target: 'llmRouter',
      style: { stroke: '#c026d366', strokeWidth: 1.5 },
      animated: false,
    },
    ...providers.map((p) => ({
      id: `llmRouter→provider_${p.name}`,
      source: 'llmRouter',
      target: `provider_${p.name}`,
      style: {
        stroke: p.enabled ? (p.executionMode === 'cloud' ? '#22d3ee55' : '#f9731655') : '#33333355',
        strokeWidth: 1.5,
      },
      animated: false,
    })),
    {
      id: 'llmRouter→addNode',
      source: 'llmRouter',
      target: 'addNode',
      style: {
        stroke: '#ffffff11',
        strokeWidth: 1,
        strokeDasharray: '4 3',
      },
      animated: false,
    },
  ];

  return { nodes, edges };
}

// ─── Main component ───────────────────────────────────────────────────────────

const DEFAULT_ROUTER_CONFIG: ImageRouterConfig = { model: '', provider: 'ollama', timeoutMs: 12000 };

export function ImageGenSubFlow({ baseUrl, onBack, conversationId }: ImageGenSubFlowProps) {
  const [providers, setProviders] = useState<ImageWorkflowProvider[]>([]);
  const [strategy, setStrategy] = useState('priority_list');
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [loading, setLoading] = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [dispatcherPanelOpen, setDispatcherPanelOpen] = useState(false);
  const [dispatcherForm, setDispatcherForm] = useState({ strategy: 'priority_list', maxAttempts: 3 });
  const [savingDispatcher, setSavingDispatcher] = useState(false);
  const [editingProviderName, setEditingProviderName] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: '', prePrompt: '', workflowPath: '', generationType: 'text2img', description: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingWorkflow, setDeletingWorkflow] = useState(false);
  const [panelZoom, setPanelZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [createdEnvVar, setCreatedEnvVar] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    name: '',
    generationType: 'text2img',
    executionMode: 'local',
    workflowPath: '',
    description: '',
  });

  // ─── Panel resize ─────────────────────────────────────────────────────────

  const { width: panelWidth, onMouseDown: onResizeMouseDown } = useResizablePanel(320, 260, 860);

  // ─── LLM Router state ─────────────────────────────────────────────────────

  const [routerConfig, setRouterConfig] = useState<ImageRouterConfig>(DEFAULT_ROUTER_CONFIG);
  const [routerPanelOpen, setRouterPanelOpen] = useState(false);
  const [routerForm, setRouterForm] = useState<ImageRouterConfig>(DEFAULT_ROUTER_CONFIG);
  const [savingRouter, setSavingRouter] = useState(false);

  // ─── Vision Descriptor state ───────────────────────────────────────────────

  const DEFAULT_VISION_CONFIG: VisionDescriptorSkillConfig = { enabled: false, provider: 'ollama', model: '', timeoutMs: 60000, fallback: { provider: 'openai', model: 'gpt-4o' } };
  const [visionConfig, setVisionConfig] = useState<VisionDescriptorSkillConfig>(DEFAULT_VISION_CONFIG);
  const [visionForm, setVisionForm] = useState<VisionDescriptorSkillConfig>(DEFAULT_VISION_CONFIG);
  const [savingVision, setSavingVision] = useState(false);

  // ─── SSE animation state ───────────────────────────────────────────────────

  const [nodeStatuses, setNodeStatuses] = useState<Map<string, NodeStatus>>(new Map());
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const sseCleanupRef = useRef<(() => void) | null>(null);

  // ─── Populate edit form when a provider is selected ───────────────────────

  useEffect(() => {
    if (!editingProviderName) return;
    const p = providers.find((x) => x.name === editingProviderName);
    if (!p) return;
    setEditForm({
      label: p.label ?? p.name,
      prePrompt: p.prePrompt ?? '',
      workflowPath: p.workflowPath ?? '',
      generationType: p.generationType ?? 'text2img',
      description: p.description ?? '',
    });
  }, [editingProviderName]);

  // ─── Load on mount ────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    getImageWorkflows(baseUrl)
      .then(({ providers: p, strategy: s, maxAttempts: m }) => {
        setProviders(p);
        setStrategy(s);
        setMaxAttempts(m);
        setDispatcherForm({ strategy: s, maxAttempts: m });
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    getImageGenConfig(baseUrl)
      .then(({ routerConfig: rc }) => {
        setRouterConfig(rc);
        setRouterForm(rc);
      })
      .catch(() => {});

    getVisionDescriptorConfig(baseUrl)
      .then((vc) => {
        setVisionConfig(vc);
        setVisionForm(vc);
      })
      .catch(() => {});
  }, [baseUrl]);

  // ─── SSE animation subscription ───────────────────────────────────────────

  function applyImageEvent(
    eventName: string,
    payload: Record<string, unknown> | undefined,
    m: Map<string, NodeStatus>,
  ): string | null | undefined {
    // returns new activeProviderId when dispatcher_selected fires, undefined otherwise
    if (eventName === 'stage.started' && payload?.stageId === 'image_gen') {
      m.set('entry', 'active'); m.set('dispatcher', 'active'); m.set('llmRouter', 'active');
    } else if (eventName === 'vision.described') {
      m.set('llmRouter', 'active');
    } else if (eventName === 'image.gen_started') {
      m.set('llmRouter', 'completed'); m.set('entry', 'active');
    } else if (eventName === 'image.dispatcher_selected') {
      m.set('dispatcher', 'completed'); m.set('llmRouter', 'completed');
      const sel = payload?.provider as string | undefined;
      return sel ? `provider_${sel}` : null;
    } else if (eventName === 'stage.completed' && payload?.stageId === 'image_gen') {
      m.set('entry', 'completed'); m.set('dispatcher', 'completed'); m.set('llmRouter', 'completed');
    } else if (eventName === 'stage.failed' && payload?.stageId === 'image_gen') {
      m.set('entry', 'failed'); m.set('dispatcher', 'failed'); m.set('llmRouter', 'failed');
    }
    return undefined;
  }

  useEffect(() => {
    sseCleanupRef.current?.();
    sseCleanupRef.current = null;
    setNodeStatuses(new Map());
    setActiveProviderId(null);

    if (!conversationId) return;

    const cleanup = subscribeToFlowEvents(baseUrl, conversationId, (raw) => {
      // Replay: restore full state from past events
      if ('type' in raw && raw.type === 'trace_replay') {
        const replayedStatuses = new Map<string, NodeStatus>();
        let replayedActive: string | null = null;
        for (const evt of ((raw.events ?? []) as StageEvent[])) {
          const newActive = applyImageEvent(evt.eventName, evt.payload, replayedStatuses);
          if (newActive !== undefined) replayedActive = newActive;
          else if (evt.eventName === 'stage.completed' && evt.payload?.stageId === 'image_gen' && replayedActive) {
            replayedStatuses.set(replayedActive, 'completed');
          }
        }
        setNodeStatuses(new Map(replayedStatuses));
        setActiveProviderId(replayedActive);
        return;
      }

      const { eventName, payload } = raw as StageEvent;
      let newActiveProvider: string | null | undefined;

      setNodeStatuses((prev) => {
        const m = new Map(prev);
        newActiveProvider = applyImageEvent(eventName, payload, m);
        if (eventName === 'stage.completed' && payload?.stageId === 'image_gen') {
          // mark active provider as completed inside the functional update
          setActiveProviderId((id) => { if (id) m.set(id, 'completed'); return id; });
        }
        return m;
      });

      if (newActiveProvider !== undefined) setActiveProviderId(newActiveProvider);
    });

    sseCleanupRef.current = cleanup;
    return () => { sseCleanupRef.current?.(); sseCleanupRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, conversationId]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleToggle(name: string, enabled: boolean) {
    setProviders((prev) =>
      prev.map((p) => (p.name === name ? { ...p, enabled } : p)),
    );
    try {
      await updateImageWorkflow(baseUrl, name, { enabled });
    } catch {
      // revert on error
      setProviders((prev) =>
        prev.map((p) => (p.name === name ? { ...p, enabled: !enabled } : p)),
      );
    }
  }

  async function handleAdd() {
    setSaving(true);
    const envVarName = `${form.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_KEY`;
    try {
      const result = await addImageWorkflow(baseUrl, {
        name: form.name,
        label: form.name.replace(/_/g, ' '),
        executionMode: form.executionMode as 'cloud' | 'local',
        generationType: form.generationType as 'text2img' | 'img2img' | 'pulid',
        description: form.description,
        envKey: envVarName,
        workflowPath: form.workflowPath || null,
        enabled: true,
        priority: providers.length + 1,
      });
      setProviders((prev) => [...prev, result.provider]);
      setCreatedEnvVar(
        `${envVarName}=${form.workflowPath || '/caminho/do/workflow.json'}`,
      );
      setAddingNew(false);
      setForm({
        name: '',
        generationType: 'text2img',
        executionMode: 'local',
        workflowPath: '',
        description: '',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDispatcher() {
    setSavingDispatcher(true);
    try {
      await updateImageDispatcher(baseUrl, {
        strategy: dispatcherForm.strategy,
        maxAttempts: dispatcherForm.maxAttempts,
      });
      setStrategy(dispatcherForm.strategy);
      setMaxAttempts(dispatcherForm.maxAttempts);
      setDispatcherPanelOpen(false);
    } finally {
      setSavingDispatcher(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingProviderName) return;
    setSavingEdit(true);
    try {
      await updateImageWorkflow(baseUrl, editingProviderName, {
        label: editForm.label,
        prePrompt: editForm.prePrompt,
        workflowPath: editForm.workflowPath || null,
        generationType: editForm.generationType as ImageWorkflowProvider['generationType'],
        description: editForm.description,
      });
      setProviders((prev) =>
        prev.map((p) =>
          p.name === editingProviderName
            ? {
                ...p,
                label: editForm.label,
                prePrompt: editForm.prePrompt,
                workflowPath: editForm.workflowPath || null,
                generationType: editForm.generationType as ImageWorkflowProvider['generationType'],
                description: editForm.description,
              }
            : p,
        ),
      );
      setEditingProviderName(null);
      setConfirmDelete(false);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteWorkflow() {
    if (!editingProviderName) return;
    setDeletingWorkflow(true);
    try {
      await deleteImageWorkflow(baseUrl, editingProviderName);
      setProviders((prev) => prev.filter((p) => p.name !== editingProviderName));
      setEditingProviderName(null);
      setConfirmDelete(false);
    } catch {
      setConfirmDelete(false);
    } finally {
      setDeletingWorkflow(false);
    }
  }

  async function handleSaveRouter() {
    setSavingRouter(true);
    try {
      await updateImageRouterConfig(baseUrl, routerForm);
      setRouterConfig({ ...routerForm });
      setRouterPanelOpen(false);
    } finally {
      setSavingRouter(false);
    }
  }

  async function handleSaveVision() {
    setSavingVision(true);
    try {
      const { skill } = await updateVisionDescriptorConfig(baseUrl, visionForm);
      setVisionConfig(skill);
      setVisionForm(skill);
    } finally {
      setSavingVision(false);
    }
  }

  // ─── ReactFlow graph ───────────────────────────────────────────────────────

  const { nodes: baseNodes, edges } = useMemo(
    () =>
      buildNodes(
        providers,
        strategy,
        maxAttempts,
        routerConfig,
        visionConfig,
        handleToggle,
        () => setAddingNew(true),
        () => { setDispatcherPanelOpen(true); setEditingProviderName(null); setRouterPanelOpen(false); },
        () => { setRouterPanelOpen(true); setDispatcherPanelOpen(false); setEditingProviderName(null); },
        (name) => { setEditingProviderName(name); setDispatcherPanelOpen(false); setAddingNew(false); setRouterPanelOpen(false); },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [providers, strategy, maxAttempts, routerConfig, visionConfig],
  );

  const liveNodes = useMemo(
    () =>
      baseNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: nodeStatuses.get(n.id) ?? 'idle',
          isActiveProvider: n.id === activeProviderId,
        },
      })),
    [baseNodes, nodeStatuses, activeProviderId],
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0a0a0f',
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: 44,
          paddingLeft: 12,
          paddingRight: 12,
          flexShrink: 0,
          background: '#0a0014',
          borderBottom: '1px solid #22d3ee22',
        }}
      >
        {/* Back button */}
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: '1px solid #ffffff22',
            color: '#ffffff88',
            fontFamily: 'monospace',
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          ← Voltar
        </button>

        {/* Title */}
        <span
          style={{
            flex: 1,
            fontFamily: 'monospace',
            fontSize: 13,
            fontWeight: 700,
            color: '#22d3ee',
            letterSpacing: '0.12em',
          }}
        >
          ◈ IMAGE GENERATION
        </span>

        {/* Add button */}
        <button
          onClick={() => setAddingNew(true)}
          style={{
            background: '#f9731422',
            border: '1px solid #f9731466',
            color: '#f97316',
            fontFamily: 'monospace',
            fontSize: 11,
            padding: '4px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          + Adicionar workflow
        </button>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* ReactFlow canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                fontFamily: 'monospace',
                fontSize: 12,
                color: '#f97316',
              }}
            >
              Carregando workflows…
            </div>
          ) : (
            <>
              <ReactFlow
                nodes={liveNodes}
                edges={edges}
                nodeTypes={NODE_TYPES}
                edgeTypes={EDGE_TYPES}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                minZoom={0.3}
                maxZoom={2}
                attributionPosition="bottom-left"
                proOptions={{ hideAttribution: true }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  color="#22d3ee11"
                  gap={24}
                  size={1}
                />
                <Controls
                  style={{
                    background: '#0a0014',
                    border: '1px solid #22d3ee33',
                    color: '#22d3ee',
                  }}
                />
              </ReactFlow>
              <style>{`
                @keyframes nodeGlow {
                  from { filter: brightness(1); }
                  to   { filter: brightness(1.3); }
                }
              `}</style>
            </>
          )}
        </div>

        {/* Success card after create */}
        <AnimatePresence>
          {createdEnvVar && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#0a1a00',
                border: '1px solid #22c55e66',
                borderRadius: 10,
                padding: '14px 20px',
                fontFamily: 'monospace',
                fontSize: 11,
                color: '#22c55e',
                zIndex: 20,
                minWidth: 320,
                boxShadow: '0 4px 24px #000000aa',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>✓ Workflow criado!</div>
              <div style={{ color: '#ffffff88', fontSize: 10, marginBottom: 4 }}>
                Adicione ao .env:
              </div>
              <code
                style={{
                  display: 'block',
                  background: '#000000aa',
                  color: '#22d3ee',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 10,
                  wordBreak: 'break-all',
                  marginBottom: 10,
                }}
              >
                {createdEnvVar}
              </code>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(createdEnvVar);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      // ignore clipboard errors
                    }
                  }}
                  style={{
                    background: '#22c55e22',
                    border: '1px solid #22c55e55',
                    color: '#22c55e',
                    fontFamily: 'monospace',
                    fontSize: 10,
                    padding: '4px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  {copied ? '✓ Copiado' : 'Copiar'}
                </button>
                <button
                  onClick={() => setCreatedEnvVar(null)}
                  style={{
                    background: '#ffffff11',
                    border: '1px solid #ffffff22',
                    color: '#ffffff88',
                    fontFamily: 'monospace',
                    fontSize: 10,
                    padding: '4px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  OK
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Provider edit panel */}
        <AnimatePresence>
          {editingProviderName && (() => {
            const editingProvider = providers.find((p) => p.name === editingProviderName);
            const accentColor = editingProvider?.executionMode === 'cloud' ? '#22d3ee' : '#f97316';
            return (
              <motion.div
                key={`edit-${editingProviderName}`}
                initial={{ x: 340, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 340, opacity: 0 }}
                transition={{ duration: 0.22 }}
                style={{
                  width: panelWidth,
                  flexShrink: 0,
                  background: '#0a0a00',
                  borderLeft: `1px solid ${accentColor}33`,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <ResizeHandle onMouseDown={onResizeMouseDown} color={accentColor} />
                {/* Fixed header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 16px',
                    borderBottom: `1px solid ${accentColor}22`,
                    flexShrink: 0,
                    background: '#0a0a00',
                  }}
                >
                  <span style={{ fontSize: 14 }}>✎</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: accentColor, letterSpacing: '0.06em' }}>
                      {editingProvider?.label ?? editingProviderName}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff33', marginTop: 1 }}>
                      {editingProviderName}
                    </div>
                  </div>
                  {/* Zoom controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => setPanelZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))}
                      title="Diminuir zoom"
                      style={{ background: '#ffffff11', border: '1px solid #ffffff22', color: '#ffffff66', fontFamily: 'monospace', fontSize: 12, width: 22, height: 22, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                    >−</button>
                    <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff44', minWidth: 28, textAlign: 'center' }}>
                      {Math.round(panelZoom * 100)}%
                    </span>
                    <button
                      onClick={() => setPanelZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))}
                      title="Aumentar zoom"
                      style={{ background: '#ffffff11', border: '1px solid #ffffff22', color: '#ffffff66', fontFamily: 'monospace', fontSize: 12, width: 22, height: 22, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                    >+</button>
                  </div>
                  <button
                    onClick={() => setEditingProviderName(null)}
                    style={{ background: 'transparent', border: 'none', color: '#ffffff44', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1, marginLeft: 2 }}
                  >×</button>
                </div>

                {/* Scrollable content with zoom */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                <div style={{ zoom: panelZoom, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Label */}
                <div>
                  <label style={{ ...labelStyle, color: `${accentColor}aa` }}>Nome de exibição</label>
                  <input
                    style={{ ...inputStyle, borderColor: `${accentColor}33` }}
                    value={editForm.label}
                    onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="Nome exibido no canvas"
                  />
                </div>

                {/* Caminho do workflow */}
                <div>
                  <label style={{ ...labelStyle, color: `${accentColor}aa` }}>Caminho do workflow</label>
                  <input
                    style={{ ...inputStyle, borderColor: `${accentColor}33` }}
                    value={editForm.workflowPath}
                    onChange={(e) => setEditForm((f) => ({ ...f, workflowPath: e.target.value }))}
                    placeholder="/workflows/meu_workflow.json"
                  />
                  <div style={{ marginTop: 4, fontSize: 8, color: '#ffffff22', fontFamily: 'monospace' }}>
                    Caminho absoluto para o arquivo .json exportado do ComfyUI.
                  </div>
                </div>

                {/* Tipo de geração */}
                <div>
                  <label style={{ ...labelStyle, color: `${accentColor}aa` }}>Tipo de geração</label>
                  <select
                    style={{ ...inputStyle, borderColor: `${accentColor}33`, cursor: 'pointer' }}
                    value={editForm.generationType}
                    onChange={(e) => setEditForm((f) => ({ ...f, generationType: e.target.value }))}
                  >
                    <option value="text2img">text2img</option>
                    <option value="img2img">img2img</option>
                    <option value="pulid">pulid</option>
                  </select>
                </div>

                {/* Pré-prompt obrigatório */}
                <div>
                  <label style={{ ...labelStyle, color: `${accentColor}aa` }}>Pré-prompt obrigatório</label>
                  <textarea
                    style={{
                      ...inputStyle,
                      borderColor: `${accentColor}44`,
                      resize: 'vertical',
                      minHeight: 90,
                      lineHeight: 1.6,
                    }}
                    value={editForm.prePrompt}
                    onChange={(e) => setEditForm((f) => ({ ...f, prePrompt: e.target.value }))}
                    placeholder="Texto sempre adicionado no início do prompt antes de enviar ao ComfyUI…"
                  />
                  <div style={{ marginTop: 4, fontSize: 8, color: '#ffffff22', fontFamily: 'monospace', lineHeight: 1.5 }}>
                    Este texto é concatenado automaticamente antes do prompt gerado pelo LLM.
                    Use para forçar estilos, qualidade ou instruções fixas do workflow.
                  </div>
                </div>

                {/* Descrição para o LLM */}
                <div>
                  <label style={{ ...labelStyle, color: `${accentColor}aa` }}>Descrição para o LLM</label>
                  <textarea
                    style={{
                      ...inputStyle,
                      borderColor: `${accentColor}33`,
                      resize: 'vertical',
                      minHeight: 60,
                    }}
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Descreva quando este workflow deve ser usado…"
                  />
                  <div style={{ marginTop: 4, fontSize: 8, color: '#ffffff22', fontFamily: 'monospace' }}>
                    O orquestrador usa este texto para decidir qual workflow escolher.
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={handleSaveEdit}
                    disabled={savingEdit}
                    style={{
                      background: savingEdit ? '#1a0a00' : `${accentColor}22`,
                      border: `1px solid ${savingEdit ? `${accentColor}33` : `${accentColor}66`}`,
                      color: savingEdit ? `${accentColor}77` : accentColor,
                      fontFamily: 'monospace',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '8px 0',
                      borderRadius: 6,
                      cursor: savingEdit ? 'not-allowed' : 'pointer',
                      letterSpacing: '0.06em',
                      transition: 'background 0.15s',
                    }}
                  >
                    {savingEdit ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                  <button
                    onClick={() => { setEditingProviderName(null); setConfirmDelete(false); }}
                    style={{
                      background: 'transparent',
                      border: '1px solid #ffffff22',
                      color: '#ffffff44',
                      fontFamily: 'monospace',
                      fontSize: 10,
                      padding: '6px 0',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>

                  {/* Delete section */}
                  <div style={{ marginTop: 4, borderTop: '1px solid #ff000022', paddingTop: 10 }}>
                    {!confirmDelete ? (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: '1px solid #ef444433',
                          color: '#ef444488',
                          fontFamily: 'monospace',
                          fontSize: 10,
                          padding: '6px 0',
                          borderRadius: 6,
                          cursor: 'pointer',
                          letterSpacing: '0.04em',
                          transition: 'border-color 0.15s, color 0.15s',
                        }}
                      >
                        ✕ Excluir workflow
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{
                          fontFamily: 'monospace',
                          fontSize: 9,
                          color: '#ef4444bb',
                          textAlign: 'center',
                          padding: '4px 0',
                          lineHeight: 1.5,
                        }}>
                          Tem certeza? Esta ação não pode ser desfeita.
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={handleDeleteWorkflow}
                            disabled={deletingWorkflow}
                            style={{
                              flex: 1,
                              background: deletingWorkflow ? '#1a0000' : '#ef444422',
                              border: '1px solid #ef444466',
                              color: deletingWorkflow ? '#ef444455' : '#ef4444',
                              fontFamily: 'monospace',
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '6px 0',
                              borderRadius: 6,
                              cursor: deletingWorkflow ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {deletingWorkflow ? 'Excluindo…' : 'Sim, excluir'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(false)}
                            disabled={deletingWorkflow}
                            style={{
                              flex: 1,
                              background: 'transparent',
                              border: '1px solid #ffffff22',
                              color: '#ffffff44',
                              fontFamily: 'monospace',
                              fontSize: 10,
                              padding: '6px 0',
                              borderRadius: 6,
                              cursor: deletingWorkflow ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Não
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </div>{/* end zoom */}
                </div>{/* end scroll */}
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Dispatcher config panel */}
        <AnimatePresence>
          {dispatcherPanelOpen && (
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{
                width: panelWidth,
                flexShrink: 0,
                background: '#0a0014',
                borderLeft: '1px solid #c026d344',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <ResizeHandle onMouseDown={onResizeMouseDown} color="#c026d3" />
              {/* Fixed header + zoom controls */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  borderBottom: '1px solid #c026d322',
                  flexShrink: 0,
                  background: '#0a0014',
                }}
              >
                <span style={{ fontSize: 16 }}>⎇</span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#c026d3',
                    letterSpacing: '0.08em',
                    flex: 1,
                  }}
                >
                  Dispatcher
                </span>
                {/* Zoom controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    onClick={() => setPanelZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))}
                    title="Diminuir zoom"
                    style={{ background: '#ffffff11', border: '1px solid #ffffff22', color: '#ffffff66', fontFamily: 'monospace', fontSize: 12, width: 22, height: 22, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                  >−</button>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff44', minWidth: 28, textAlign: 'center' }}>
                    {Math.round(panelZoom * 100)}%
                  </span>
                  <button
                    onClick={() => setPanelZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))}
                    title="Aumentar zoom"
                    style={{ background: '#ffffff11', border: '1px solid #ffffff22', color: '#ffffff66', fontFamily: 'monospace', fontSize: 12, width: 22, height: 22, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                  >+</button>
                </div>
                <button
                  onClick={() => setDispatcherPanelOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: '#ffffff44', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1, marginLeft: 2 }}
                >×</button>
              </div>

              {/* Scrollable content (zoom applied here) */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <div style={{ zoom: panelZoom, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Bloco: O que é */}
                  <Section title="O que é o Dispatcher?" color="#c026d3">
                    <p style={infoText}>
                      O Dispatcher é o <em style={{ color: '#c026d3' }}>roteador de disponibilidade</em> do
                      sub-fluxo de geração de imagem. Ele recebe a requisição e escolhe qual
                      provider/workflow executar com base em <strong style={{ color: '#ffffff99' }}>regras
                      determinísticas de disponibilidade</strong> — sem envolver o LLM nessa decisão.
                    </p>
                  </Section>

                  {/* Bloco: Como decide */}
                  <Section title="Como ele decide?" color="#22d3ee">
                    <p style={infoText}>
                      A decisão é feita em tempo real, na hora em que a geração é solicitada.
                      O dispatcher verifica, nesta ordem de prioridade:
                    </p>
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <DecisionStep
                        step="1"
                        color="#f97316"
                        condition="ComfyUI online + workflow configurado?"
                        result="→ comfyui_reference"
                        note="Cobre txt2img (placeholder 1×1) e img2img com foto do cliente."
                      />
                      <DecisionStep
                        step="2"
                        color="#22d3ee"
                        condition="Tem foto de referência + FAL_KEY configurado?"
                        result="→ fal_pulid (cloud)"
                        note="Fallback cloud quando ComfyUI está offline ou sem workflow."
                      />
                      <DecisionStep
                        step="3"
                        color="#c026d3"
                        condition="ComfyUI online mas sem workflow?"
                        result="→ comfyui (básico)"
                        note="txt2img legado via detecção automática de modelo GGUF."
                      />
                      <DecisionStep
                        step="✗"
                        color="#ef4444"
                        condition="Nenhuma opção disponível"
                        result="→ image.gen_failed"
                        note="Evento de falha emitido no EventBus. Orquestrador omite imagem."
                      />
                    </div>
                    <div style={{ ...infoText, marginTop: 10, color: '#ffffff44' }}>
                      A ordem acima é fixa no código (<code style={{ color: '#c026d3' }}>selectAutoImageProvider</code> em{' '}
                      <code style={{ color: '#ffffff55' }}>imageProvider.js</code>). A variável de
                      ambiente <code style={{ color: '#22d3ee' }}>IMAGE_PROVIDER</code> pode forçar
                      um provider específico ignorando a ordem.
                    </div>
                  </Section>

                  {/* Bloco: LLM envolvido? */}
                  <Section title="O LLM decide qual provider usar?" color="#22c55e">
                    <p style={infoText}>
                      <strong style={{ color: '#ef4444' }}>Não.</strong> O LLM nunca é consultado
                      para escolher o provider de imagem. Ele atua <em>antes</em> do dispatcher,
                      apenas para gerar o <strong style={{ color: '#f97316' }}>prompt textual</strong>{' '}
                      que descreve a imagem a ser criada. A escolha do pipeline de execução é 100%
                      baseada em disponibilidade de infraestrutura.
                    </p>
                    <div style={{ marginTop: 8, background: '#001a22', border: '1px solid #22c55e22', borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#22c55eaa', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Fluxo real</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff66', lineHeight: 1.8 }}>
                        LLM → <span style={{ color: '#f97316' }}>image_prompt</span>{' '}
                        → image_qc (reparo) → <span style={{ color: '#c026d3' }}>Dispatcher</span>{' '}
                        → verifica infra → executa provider → <span style={{ color: '#22c55e' }}>imagem gerada</span>
                      </div>
                    </div>
                  </Section>

                  {/* Bloco: Quando um provider falha */}
                  <Section title="Fallback automático" color="#f97316">
                    <p style={infoText}>
                      Cada provider tem um <strong style={{ color: '#f97316' }}>fallbackProvider</strong>{' '}
                      definido internamente. Se o provider primário lançar uma exceção durante a
                      execução (ex: ComfyUI trava no meio da geração), o dispatcher tenta
                      automaticamente o fallback antes de declarar falha.
                    </p>
                    <div style={{ ...infoText, marginTop: 8, color: '#ffffff44' }}>
                      Providers <em>desabilitados</em> (toggle off neste canvas) são pulados
                      completamente — nem chegam a ser tentados.
                    </div>
                  </Section>

                  {/* Separador */}
                  <div style={{ borderTop: '1px solid #c026d322', paddingTop: 16 }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#c026d3aa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                      Configuração
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Strategy */}
                      <div>
                        <label style={{ ...labelStyle, color: '#c026d3aa' }}>Estratégia de seleção</label>
                        <select
                          style={{ ...inputStyle, border: '1px solid #c026d344', cursor: 'pointer' }}
                          value={dispatcherForm.strategy}
                          onChange={(e) => setDispatcherForm((f) => ({ ...f, strategy: e.target.value }))}
                        >
                          <option value="priority_list">priority_list — ordem de prioridade (atual)</option>
                          <option value="round_robin">round_robin — rodízio entre habilitados</option>
                          <option value="random">random — escolha aleatória</option>
                          <option value="fastest_first">fastest_first — histórico de latência</option>
                        </select>
                        <div style={{ marginTop: 4, fontSize: 8, color: '#ffffff33', fontFamily: 'monospace' }}>
                          Salvo em <code>orchestrator.flow.json</code>. A lógica atual usa sempre{' '}
                          <code style={{ color: '#c026d3' }}>priority_list</code>; outros modos são
                          preparação para versões futuras do engine.
                        </div>
                      </div>

                      {/* Max attempts */}
                      <div>
                        <label style={{ ...labelStyle, color: '#c026d3aa' }}>Máximo de tentativas</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          style={{ ...inputStyle, border: '1px solid #c026d344', width: 80 }}
                          value={dispatcherForm.maxAttempts}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v >= 1) setDispatcherForm((f) => ({ ...f, maxAttempts: v }));
                          }}
                        />
                        <div style={{ marginTop: 4, fontSize: 8, color: '#ffffff33', fontFamily: 'monospace' }}>
                          Providers a tentar (incluindo fallbacks) antes de emitir{' '}
                          <code style={{ color: '#ef4444' }}>image.gen_failed</code>.
                        </div>
                      </div>

                      {/* Save */}
                      <button
                        onClick={handleSaveDispatcher}
                        disabled={savingDispatcher}
                        style={{
                          background: savingDispatcher ? '#1a0028' : '#c026d322',
                          border: `1px solid ${savingDispatcher ? '#c026d333' : '#c026d366'}`,
                          color: savingDispatcher ? '#c026d377' : '#c026d3',
                          fontFamily: 'monospace',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '8px 0',
                          borderRadius: 6,
                          cursor: savingDispatcher ? 'not-allowed' : 'pointer',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {savingDispatcher ? 'Salvando…' : 'Salvar configuração'}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* LLM Router config panel */}
        <AnimatePresence>
          {routerPanelOpen && (
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{
                width: panelWidth,
                flexShrink: 0,
                background: '#080f12',
                borderLeft: '1px solid #22d3ee44',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <ResizeHandle onMouseDown={onResizeMouseDown} color="#22d3ee" />
              {/* Header + zoom */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  borderBottom: '1px solid #22d3ee22',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 14 }}>🤖</span>
                <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#22d3ee', letterSpacing: '0.08em', flex: 1 }}>
                  LLM Router
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => setPanelZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))} title="Diminuir zoom" style={{ background: '#ffffff11', border: '1px solid #ffffff22', color: '#ffffff66', fontFamily: 'monospace', fontSize: 12, width: 22, height: 22, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>−</button>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff44', minWidth: 28, textAlign: 'center' }}>{Math.round(panelZoom * 100)}%</span>
                  <button onClick={() => setPanelZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))} title="Aumentar zoom" style={{ background: '#ffffff11', border: '1px solid #ffffff22', color: '#ffffff66', fontFamily: 'monospace', fontSize: 12, width: 22, height: 22, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>+</button>
                </div>
                <button onClick={() => setRouterPanelOpen(false)} style={{ background: 'transparent', border: 'none', color: '#ffffff44', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1, marginLeft: 2 }}>×</button>
              </div>

              {/* Scrollable content */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <div style={{ zoom: panelZoom, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* What is it */}
                  <Section title="O que é o LLM Router?" color="#22d3ee">
                    <p style={infoText}>
                      Quando há múltiplos workflows habilitados que aceitam os mesmos tipos de entrada
                      (ex: dois workflows img2img), um LLM leve analisa o <strong style={{ color: '#f97316' }}>prompt</strong>{' '}
                      e a <strong style={{ color: '#22d3ee' }}>descrição</strong> de cada workflow para
                      decidir qual é mais adequado ao pedido do cliente.
                    </p>
                    <div style={{ ...infoText, marginTop: 8, color: '#ffffff44' }}>
                      Se o modelo estiver vazio, a seleção é <em>determinística</em>: o dispatcher
                      usa apenas disponibilidade e prioridade numérica.
                    </div>
                  </Section>

                  {/* Vision Descriptor */}
                  <Section title="👁 Vision Descriptor" color="#a855f7">
                    <p style={infoText}>
                      O LLM Router também é responsável por <strong style={{ color: '#a855f7' }}>descrever imagens de referência</strong>{' '}
                      usando um modelo multimodal antes de construir o prompt final para o ComfyUI.
                      O modelo vision analisa a foto do cliente e gera uma descrição detalhada
                      (cabelo, pele, traços, roupa) que substitui o texto genérico{' '}
                      <em style={{ color: '#f97316' }}>"Transform the person from the reference photo"</em>.
                    </p>
                    <div style={{ ...infoText, marginTop: 6, color: '#ffffff33' }}>
                      Apenas modelos com capacidade multimodal aparecem no seletor abaixo.
                      Modelos locais (Ollama) mantêm o lock de GPU durante a chamada.
                    </div>
                  </Section>

                  <div style={{ borderTop: '1px solid #22d3ee22', paddingTop: 16 }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#22d3eeaa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                      Configuração
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                      {/* Model */}
                      <div>
                        <label style={{ ...labelStyle, color: '#22d3eeaa' }}>Modelo LLM</label>
                        <ModelSelector
                          baseUrl={baseUrl}
                          provider={routerForm.provider}
                          value={routerForm.model}
                          onChange={(m) => setRouterForm((f) => ({ ...f, model: m }))}
                          color="#22d3ee"
                        />
                      </div>

                      {/* Provider */}
                      <div>
                        <label style={{ ...labelStyle, color: '#22d3eeaa' }}>Provider</label>
                        <select
                          style={{ ...inputStyle, borderColor: '#22d3ee33', cursor: 'pointer' }}
                          value={routerForm.provider}
                          onChange={(e) => setRouterForm((f) => ({ ...f, provider: e.target.value }))}
                        >
                          <option value="ollama">ollama (local)</option>
                          <option value="anthropic">anthropic (cloud)</option>
                          <option value="openai">openai (cloud)</option>
                          <option value="xai">xai (cloud)</option>
                        </select>
                        <div style={{ marginTop: 4, fontSize: 8, color: '#ffffff33', fontFamily: 'monospace' }}>
                          Cloud providers exigem API key configurada no .env.
                        </div>
                      </div>

                      {/* Timeout */}
                      <div>
                        <label style={{ ...labelStyle, color: '#22d3eeaa' }}>Timeout (ms)</label>
                        <input
                          type="number"
                          style={{ ...inputStyle, borderColor: '#22d3ee33', width: 120 }}
                          value={routerForm.timeoutMs || ''}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            setRouterForm((f) => ({ ...f, timeoutMs: isNaN(v) ? 0 : v }));
                          }}
                          onBlur={(e) => {
                            const v = parseInt(e.target.value, 10);
                            const clamped = isNaN(v) ? 1000 : Math.min(120000, Math.max(1000, v));
                            setRouterForm((f) => ({ ...f, timeoutMs: clamped }));
                          }}
                        />
                        <div style={{ marginTop: 4, fontSize: 8, color: '#ffffff33', fontFamily: 'monospace' }}>
                          Se o LLM não responder no tempo, a seleção cai para determinística.
                        </div>
                      </div>

                      {/* Save Router */}
                      <button
                        onClick={handleSaveRouter}
                        disabled={savingRouter}
                        style={{
                          background: savingRouter ? '#001522' : '#22d3ee22',
                          border: `1px solid ${savingRouter ? '#22d3ee33' : '#22d3ee66'}`,
                          color: savingRouter ? '#22d3ee77' : '#22d3ee',
                          fontFamily: 'monospace',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '8px 0',
                          borderRadius: 6,
                          cursor: savingRouter ? 'not-allowed' : 'pointer',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {savingRouter ? 'Salvando…' : 'Salvar configuração'}
                      </button>
                    </div>
                  </div>

                  {/* Vision Descriptor configuration */}
                  <div style={{ borderTop: '1px solid #a855f722', paddingTop: 16 }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#a855f7aa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                      👁 Vision Descriptor
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                      {/* Enable toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          onClick={() => setVisionForm((f) => ({ ...f, enabled: !f.enabled }))}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                        >
                          {visionForm.enabled
                            ? <ToggleRight size={22} style={{ color: '#a855f7' }} />
                            : <ToggleLeft size={22} style={{ color: '#555555' }} />}
                        </button>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: visionForm.enabled ? '#a855f7' : '#555555' }}>
                          {visionForm.enabled ? 'Habilitado' : 'Desabilitado'}
                        </span>
                      </div>

                      {/* Provider */}
                      <div>
                        <label style={{ ...labelStyle, color: '#a855f7aa' }}>Provider (vision)</label>
                        <select
                          style={{ ...inputStyle, borderColor: '#a855f733', cursor: 'pointer' }}
                          value={visionForm.provider}
                          onChange={(e) => setVisionForm((f) => ({ ...f, provider: e.target.value, model: '' }))}
                        >
                          <option value="ollama">ollama (local — GPU lock)</option>
                          <option value="anthropic">anthropic (cloud)</option>
                          <option value="openai">openai (cloud)</option>
                        </select>
                      </div>

                      {/* Model — only vision-capable */}
                      <div>
                        <label style={{ ...labelStyle, color: '#a855f7aa' }}>Modelo vision</label>
                        <ModelSelector
                          baseUrl={baseUrl}
                          provider={visionForm.provider}
                          value={visionForm.model ?? ''}
                          onChange={(m) => setVisionForm((f) => ({ ...f, model: m }))}
                          color="#a855f7"
                          visionOnly
                        />
                        <div style={{ marginTop: 4, fontSize: 8, color: '#ffffff33', fontFamily: 'monospace', lineHeight: 1.5 }}>
                          Apenas modelos multimodais. Para Ollama: instale com{' '}
                          <code style={{ color: '#a855f7' }}>ollama pull llama3.2-vision:11b</code>.
                        </div>
                      </div>

                      {/* Timeout */}
                      <div>
                        <label style={{ ...labelStyle, color: '#a855f7aa' }}>Timeout (ms)</label>
                        <input
                          type="number"
                          style={{ ...inputStyle, borderColor: '#a855f733', width: 120 }}
                          value={visionForm.timeoutMs ?? 60000}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            setVisionForm((f) => ({ ...f, timeoutMs: isNaN(v) ? 60000 : v }));
                          }}
                          onBlur={(e) => {
                            const v = parseInt(e.target.value, 10);
                            const clamped = isNaN(v) ? 60000 : Math.min(300000, Math.max(5000, v));
                            setVisionForm((f) => ({ ...f, timeoutMs: clamped }));
                          }}
                        />
                        <div style={{ marginTop: 4, fontSize: 8, color: '#ffffff33', fontFamily: 'monospace' }}>
                          Se exceder o tempo, o prompt original é mantido (sem falha crítica).
                        </div>
                      </div>

                      {/* Fallback provider */}
                      <div>
                        <label style={{ ...labelStyle, color: '#a855f7aa' }}>Fallback provider</label>
                        <select
                          style={{ ...inputStyle, borderColor: '#a855f733', cursor: 'pointer' }}
                          value={visionForm.fallback?.provider ?? 'openai'}
                          onChange={(e) => setVisionForm((f) => ({ ...f, fallback: { ...f.fallback, provider: e.target.value, model: '' } }))}
                        >
                          <option value="openai">openai (gpt-4o)</option>
                          <option value="anthropic">anthropic (claude-haiku-4-5)</option>
                          <option value="ollama">ollama</option>
                        </select>
                        <div style={{ marginTop: 4, fontSize: 8, color: '#ffffff33', fontFamily: 'monospace' }}>
                          Usado se o provider principal falhar ou não tiver modelo configurado.
                        </div>
                      </div>

                      {/* Save Vision */}
                      <button
                        onClick={handleSaveVision}
                        disabled={savingVision}
                        style={{
                          background: savingVision ? '#110022' : '#a855f722',
                          border: `1px solid ${savingVision ? '#a855f733' : '#a855f766'}`,
                          color: savingVision ? '#a855f777' : '#a855f7',
                          fontFamily: 'monospace',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '8px 0',
                          borderRadius: 6,
                          cursor: savingVision ? 'not-allowed' : 'pointer',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {savingVision ? 'Salvando…' : 'Salvar vision descriptor'}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add workflow form panel */}
        <AnimatePresence>
          {addingNew && (
            <motion.div
              initial={{ x: 280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 280, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{
                width: panelWidth,
                flexShrink: 0,
                background: '#0a0014',
                borderLeft: '1px solid #f9731433',
                overflowY: 'auto',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                position: 'relative',
              }}
            >
              <ResizeHandle onMouseDown={onResizeMouseDown} color="#f97316" />
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#f97316',
                  letterSpacing: '0.08em',
                  marginBottom: 4,
                }}
              >
                Novo workflow
              </div>

              {/* Nome */}
              <div>
                <label style={labelStyle}>Nome</label>
                <input
                  style={inputStyle}
                  placeholder="ex: my_workflow"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      name: e.target.value.replace(/[^a-zA-Z0-9_]/g, ''),
                    }))
                  }
                />
              </div>

              {/* Tipo de geração */}
              <div>
                <label style={labelStyle}>Tipo de geração</label>
                <select
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  value={form.generationType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, generationType: e.target.value }))
                  }
                >
                  <option value="text2img">text2img</option>
                  <option value="img2img">img2img</option>
                  <option value="pulid">pulid</option>
                </select>
              </div>

              {/* Execução */}
              <div>
                <label style={labelStyle}>Execução</label>
                <select
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  value={form.executionMode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, executionMode: e.target.value }))
                  }
                >
                  <option value="local">local</option>
                  <option value="cloud">cloud</option>
                </select>
              </div>

              {/* Caminho do workflow */}
              <div>
                <label style={labelStyle}>Caminho do workflow</label>
                <input
                  style={inputStyle}
                  placeholder="/workflows/meu_workflow.json"
                  value={form.workflowPath}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, workflowPath: e.target.value }))
                  }
                />
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 8,
                    color: '#ffffff33',
                    fontFamily: 'monospace',
                  }}
                >
                  Path do arquivo exportado do ComfyUI.
                </div>
              </div>

              {/* Descrição para o LLM */}
              <div>
                <label style={labelStyle}>Descrição para o LLM</label>
                <textarea
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    minHeight: 70,
                  }}
                  placeholder="Descreva quando este workflow deve ser usado…"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 8,
                    color: '#ffffff33',
                    fontFamily: 'monospace',
                  }}
                >
                  O orquestrador usará este texto para decidir quando usar este workflow.
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <button
                  onClick={handleAdd}
                  disabled={saving || !form.name}
                  style={{
                    background: saving || !form.name ? '#3a1a0088' : '#f9731422',
                    border: `1px solid ${saving || !form.name ? '#f9731433' : '#f9731466'}`,
                    color: saving || !form.name ? '#f9731677' : '#f97316',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '8px 0',
                    borderRadius: 6,
                    cursor: saving || !form.name ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.06em',
                    transition: 'background 0.15s',
                  }}
                >
                  {saving ? 'Criando…' : 'Criar workflow'}
                </button>

                <button
                  onClick={() => {
                    setAddingNew(false);
                    setForm({
                      name: '',
                      generationType: 'text2img',
                      executionMode: 'local',
                      workflowPath: '',
                      description: '',
                    });
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid #ffffff22',
                    color: '#ffffff55',
                    fontFamily: 'monospace',
                    fontSize: 10,
                    padding: '6px 0',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
