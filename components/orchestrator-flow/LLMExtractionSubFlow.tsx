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
import { useEffect, useRef, useState } from 'react';
import { useResizablePanel } from '../../hooks/useResizablePanel';
import {
  getLLMConfig,
  getProviderHealth,
  subscribeToFlowEvents,
  updateExtractionConfig,
  type ExtractionSkillConfig,
  type FlowDefinition,
  type LLMProviderConfig,
  type ProviderHealthResult,
  type StageEvent,
} from '../../services/aiOrchestrator.service';
import { ModelSelector } from './ModelSelector';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LLMExtractionSubFlowProps {
  baseUrl: string;
  definition: FlowDefinition;
  onBack: () => void;
  conversationId?: string | null;
}

type NodeStatus = 'idle' | 'active' | 'completed' | 'failed';

interface LLMNodeData extends Record<string, unknown> {
  role: 'primary' | 'fallback';
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  executionMode?: string;
  status?: NodeStatus;
  health?: ProviderHealthResult | null;
  onEdit: (role: 'primary' | 'fallback') => void;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 9,
  color: '#c026d3aa',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 4,
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  background: '#120020',
  color: '#ffffff',
  border: '1px solid #c026d344',
  borderRadius: 6,
  fontFamily: 'monospace',
  fontSize: 10,
  padding: '6px 10px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

const infoText: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 9,
  color: '#ffffff77',
  lineHeight: 1.75,
  margin: 0,
};

// ─── Doc helpers ──────────────────────────────────────────────────────────────

function DocSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: `${color}09`, border: `1px solid ${color}20`, borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function FieldDoc({ name, type, color, children }: { name: string; type: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid #ffffff0a', paddingBottom: 10, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <code style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color }}>{name}</code>
        <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff33', background: '#ffffff08', borderRadius: 3, padding: '0 4px' }}>{type}</span>
      </div>
      <div style={{ ...infoText, fontSize: 9 }}>{children}</div>
    </div>
  );
}

function FlowStep({ icon, color, label, note }: { icon: string; color: string; label: string; note: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0' }}>
      <span style={{ fontSize: 11, flexShrink: 0, width: 18, textAlign: 'center' }}>{icon}</span>
      <div>
        <div style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color }}>{label}</div>
        <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff44', marginTop: 2, lineHeight: 1.6 }}>{note}</div>
      </div>
    </div>
  );
}

const divider = (
  <div style={{ borderTop: '1px solid #ffffff0d', margin: '2px 0' }} />
);

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
        <div
          style={{
            width: 2,
            height: 40,
            borderRadius: 2,
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      )}
    </div>
  );
}

// ─── LLMExtractionNode ────────────────────────────────────────────────────────

function LLMExtractionNode({ data }: NodeProps) {
  const { role, provider, model, temperature, maxTokens, executionMode, status = 'idle', health, onEdit } = data as LLMNodeData;

  const isPrimary = role === 'primary';
  const isActive = status === 'active';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const hasWarning = health !== undefined && health !== null && !health.ok;

  const color = isFailed
    ? '#ef4444'
    : isActive
      ? '#c026d3'
      : isCompleted
        ? '#22c55ecc'
        : isPrimary
          ? '#c026d3cc'
          : '#c026d366';

  const bg = isFailed ? '#220000' : isActive ? '#1a0028' : '#0d000f';

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onEdit(role); }}
      style={{
        background: bg,
        border: hasWarning ? '1.5px solid #f97316' : `1.5px solid ${color}`,
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 180,
        fontFamily: 'monospace',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        boxShadow: isActive ? `0 0 18px ${color}` : isFailed ? `0 0 12px #ef444466` : 'none',
        animation: isActive ? 'llmNodePulse 1.4s ease-in-out infinite alternate' : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 12px ${color}66`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = isActive ? `0 0 18px ${color}` : isFailed ? `0 0 12px #ef444466` : 'none';
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, borderColor: color }} />
      <Handle type="source" position={Position.Right} style={{ background: color, borderColor: color }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 8,
            color: `${color}99`,
            background: `${color}18`,
            border: `1px solid ${color}33`,
            borderRadius: 3,
            padding: '1px 5px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          {isPrimary ? 'primário' : 'fallback'}
        </span>
        {isActive && <span style={{ color, fontSize: 8, marginLeft: 'auto' }}>●</span>}
        {isFailed && <span style={{ color: '#ef4444', fontSize: 8, marginLeft: 'auto' }}>✗</span>}
        {isCompleted && !isFailed && <span style={{ color: '#22c55e', fontSize: 8, marginLeft: 'auto' }}>✓</span>}
        {hasWarning && (
          <span
            title={health!.reason ?? 'Provider não configurado'}
            style={{ fontSize: 10, marginLeft: isActive || isFailed || isCompleted ? 4 : 'auto', cursor: 'help' }}
          >
            ⚠️
          </span>
        )}
        <span style={{ fontSize: 8, color: `${color}55`, marginLeft: hasWarning || isActive || isFailed || isCompleted ? 4 : 'auto' }}>✎ editar</span>
      </div>

      {/* Provider + Model */}
      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 3 }}>
        {model || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>modelo não definido</span>}
      </div>
      <div style={{ fontSize: 9, color: '#ffffff66' }}>
        {provider}
        {executionMode && (
          <span style={{ marginLeft: 6, color: `${color}77` }}>
            {executionMode === 'cloud' ? '☁️' : '🖥'}
          </span>
        )}
      </div>

      {/* Params */}
      {(temperature !== undefined || maxTokens !== undefined) && (
        <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {temperature !== undefined && (
            <span style={{ fontSize: 8, color: '#ffffff44', background: '#ffffff0a', border: '1px solid #ffffff11', borderRadius: 3, padding: '1px 4px' }}>
              temp: {temperature}
            </span>
          )}
          {maxTokens !== undefined && (
            <span style={{ fontSize: 8, color: '#ffffff44', background: '#ffffff0a', border: '1px solid #ffffff11', borderRadius: 3, padding: '1px 4px' }}>
              max: {maxTokens}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── NODE_TYPES (defined outside component) ───────────────────────────────────

const NODE_TYPES = { llmNode: LLMExtractionNode };
const EDGE_TYPES = {};

// ─── Graph builder ────────────────────────────────────────────────────────────

function buildGraph(
  extraction: ExtractionSkillConfig | null,
  onEdit: (role: 'primary' | 'fallback') => void,
  nodeStatuses: Map<string, NodeStatus>,
  providerHealth: Record<string, ProviderHealthResult>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: 'input',
      type: 'default',
      position: { x: 0, y: 60 },
      data: { label: '📨 Mensagem' },
      style: {
        background: '#001a22',
        border: '1.5px solid #22d3ee',
        borderRadius: 10,
        color: '#22d3ee',
        fontFamily: 'monospace',
        fontSize: 11,
        fontWeight: 700,
        padding: '8px 14px',
        minWidth: 110,
        textAlign: 'center',
      },
    },
    {
      id: 'primary',
      type: 'llmNode',
      position: { x: 200, y: 30 },
      data: {
        role: 'primary',
        provider: extraction?.provider ?? 'ollama',
        model: extraction?.model ?? '',
        temperature: extraction?.temperature,
        maxTokens: extraction?.maxTokens,
        executionMode: extraction?.executionMode,
        status: nodeStatuses.get('primary') ?? 'idle',
        health: providerHealth[extraction?.provider ?? 'ollama'] ?? null,
        onEdit,
      } as LLMNodeData,
    },
    {
      id: 'fallback',
      type: 'llmNode',
      position: { x: 200, y: 160 },
      data: {
        role: 'fallback',
        provider: extraction?.fallback?.provider ?? '',
        model: extraction?.fallback?.model ?? '',
        status: nodeStatuses.get('fallback') ?? 'idle',
        health: extraction?.fallback?.provider ? (providerHealth[extraction.fallback.provider] ?? null) : null,
        onEdit,
      } as LLMNodeData,
    },
    {
      id: 'output',
      type: 'default',
      position: { x: 430, y: 60 },
      data: { label: '🧾 Extração' },
      style: {
        background: '#1a0028',
        border: '1.5px solid #c026d3',
        borderRadius: 10,
        color: '#c026d3',
        fontFamily: 'monospace',
        fontSize: 11,
        fontWeight: 700,
        padding: '8px 14px',
        minWidth: 110,
        textAlign: 'center',
      },
    },
  ];

  const edges: Edge[] = [
    {
      id: 'input→primary',
      source: 'input',
      target: 'primary',
      animated: nodeStatuses.get('primary') === 'active',
      style: { stroke: '#c026d366', strokeWidth: 1.5 },
    },
    {
      id: 'input→fallback',
      source: 'input',
      target: 'fallback',
      animated: nodeStatuses.get('fallback') === 'active',
      style: { stroke: '#c026d333', strokeWidth: 1, strokeDasharray: '4 3' },
      label: 'fallback',
      labelStyle: { fill: '#c026d355', fontSize: 8, fontFamily: 'monospace' },
    },
    {
      id: 'primary→output',
      source: 'primary',
      target: 'output',
      animated: nodeStatuses.get('primary') === 'completed',
      style: { stroke: '#c026d366', strokeWidth: 1.5 },
    },
    {
      id: 'fallback→output',
      source: 'fallback',
      target: 'output',
      animated: nodeStatuses.get('fallback') === 'completed',
      style: { stroke: '#c026d333', strokeWidth: 1, strokeDasharray: '4 3' },
    },
  ];

  return { nodes, edges };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LLMExtractionSubFlow({ baseUrl, onBack, conversationId }: LLMExtractionSubFlowProps) {
  const [extraction, setExtraction] = useState<ExtractionSkillConfig | null>(null);
  const [availableProviders, setAvailableProviders] = useState<Record<string, LLMProviderConfig>>({});
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<'primary' | 'fallback' | null>(null);
  const [panelZoom, setPanelZoom] = useState(1);
  const { width: panelWidth, onMouseDown: onResizeMouseDown } = useResizablePanel(380, 280, 860);
  const [providerHealth, setProviderHealth] = useState<Record<string, ProviderHealthResult>>({});
  const [healthLoading, setHealthLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nodeStatuses, setNodeStatuses] = useState<Map<string, NodeStatus>>(new Map());
  const sseCleanupRef = useRef<(() => void) | null>(null);

  const [primaryForm, setPrimaryForm] = useState({ provider: 'ollama', model: '', temperature: 0.1, maxTokens: 4096, executionMode: 'local' });
  const [fallbackForm, setFallbackForm] = useState({ provider: 'ollama', model: '' });

  // ─── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    getLLMConfig(baseUrl)
      .then(({ skills, providers }) => {
        const ext = skills.extraction;
        setExtraction(ext);
        setAvailableProviders(providers);
        setPrimaryForm({
          provider: ext.provider ?? 'ollama',
          model: ext.model ?? '',
          temperature: ext.temperature ?? 0.1,
          maxTokens: ext.maxTokens ?? 4096,
          executionMode: ext.executionMode ?? 'local',
        });
        setFallbackForm({
          provider: ext.fallback?.provider ?? 'ollama',
          model: ext.fallback?.model ?? '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Health check: verifica env vars e conectividade de cada provider
    setHealthLoading(true);
    getProviderHealth(baseUrl)
      .then(({ providers }) => setProviderHealth(providers))
      .catch(() => {})
      .finally(() => setHealthLoading(false));
  }, [baseUrl]);

  // ─── SSE animation ────────────────────────────────────────────────────────

  useEffect(() => {
    sseCleanupRef.current?.();
    sseCleanupRef.current = null;
    setNodeStatuses(new Map());

    if (!conversationId) return;

    const cleanup = subscribeToFlowEvents(baseUrl, conversationId, (raw) => {
      if ('type' in raw && raw.type === 'trace_replay') return;
      const { eventName, payload } = raw as StageEvent;

      setNodeStatuses((prev) => {
        const m = new Map(prev);
        if (eventName === 'stage.started' && payload?.stageId === 'extraction') {
          m.set('primary', 'active');
        } else if (eventName === 'llm.called') {
          // could refine with payload.skill if available
          m.set('primary', 'active');
        } else if (eventName === 'llm.parsed') {
          m.set('primary', 'completed');
        } else if (eventName === 'llm.parse_failed') {
          m.set('primary', 'failed');
          m.set('fallback', 'active');
        } else if (eventName === 'stage.completed' && payload?.stageId === 'extraction') {
          m.set('primary', 'completed');
        } else if (eventName === 'stage.failed' && payload?.stageId === 'extraction') {
          m.set('primary', 'failed');
        }
        return m;
      });
    });

    sseCleanupRef.current = cleanup;
    return () => { sseCleanupRef.current?.(); sseCleanupRef.current = null; };
  }, [baseUrl, conversationId]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function openEdit(role: 'primary' | 'fallback') {
    setEditingRole(role);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const patch: Partial<ExtractionSkillConfig> = editingRole === 'primary'
        ? {
            provider: primaryForm.provider,
            model: primaryForm.model || undefined,
            temperature: primaryForm.temperature,
            maxTokens: primaryForm.maxTokens,
            executionMode: primaryForm.executionMode,
          }
        : {
            fallback: {
              provider: fallbackForm.provider,
              model: fallbackForm.model || undefined,
            },
          };

      const { extraction: updated } = await updateExtractionConfig(baseUrl, patch);
      setExtraction(updated);
      setEditingRole(null);
    } finally {
      setSaving(false);
    }
  }

  // ─── Graph ────────────────────────────────────────────────────────────────

  const { nodes, edges } = buildGraph(extraction, openEdit, nodeStatuses, providerHealth);

  // ─── Render ────────────────────────────────────────────────────────────────

  const providerOptions = Object.entries(availableProviders).map(([id, cfg]) => ({
    value: id,
    label: cfg.label ?? id,
  }));

  const accentColor = '#c026d3';

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
          borderBottom: '1px solid #c026d322',
        }}
      >
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

        <span
          style={{
            flex: 1,
            fontFamily: 'monospace',
            fontSize: 13,
            fontWeight: 700,
            color: accentColor,
            letterSpacing: '0.12em',
          }}
        >
          ◈ LLM EXTRACTION
        </span>

        {healthLoading && (
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff22', letterSpacing: '0.06em' }}>
            ⟳ verificando providers…
          </span>
        )}
        {!healthLoading && Object.values(providerHealth).some((h) => !h.ok) && (
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#f97316', letterSpacing: '0.06em' }}>
            ⚠️ {Object.values(providerHealth).filter((h) => !h.ok).length} provider(s) com problema
          </span>
        )}
        {conversationId && (
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff33', letterSpacing: '0.06em' }}>
            SSE ativo
          </span>
        )}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* ReactFlow canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: 'monospace', fontSize: 12, color: accentColor }}>
              Carregando configuração LLM…
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
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
              <Background variant={BackgroundVariant.Dots} color="#c026d311" gap={24} size={1} />
              <Controls style={{ background: '#0a0014', border: '1px solid #c026d333', color: accentColor }} />
            </ReactFlow>
          )}

          {/* Info card when no conversation selected */}
          {!conversationId && !loading && (
            <div
              style={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                fontFamily: 'monospace',
                fontSize: 10,
                color: '#ffffff33',
                background: '#0a0014',
                border: '1px solid #c026d322',
                borderRadius: 8,
                padding: '8px 16px',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Selecione uma conversa para ver as animações ao vivo
            </div>
          )}

          <style>{`
            @keyframes llmNodePulse {
              from { filter: brightness(1); }
              to   { filter: brightness(1.35); }
            }
          `}</style>
        </div>

        {/* Edit panel */}
        <AnimatePresence>
          {editingRole && (
            <motion.div
              key={`edit-${editingRole}`}
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{
                width: panelWidth,
                flexShrink: 0,
                background: '#0a0014',
                borderLeft: `1px solid ${accentColor}33`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Resize handle — drag to widen/narrow the panel */}
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
                  background: '#0a0014',
                }}
              >
                <span style={{ fontSize: 14 }}>✎</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: accentColor, letterSpacing: '0.06em' }}>
                    LLM {editingRole === 'primary' ? 'Primário' : 'Fallback'}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff33', marginTop: 1 }}>
                    {editingRole === 'primary' ? 'Chamado em toda extração' : 'Usado quando o primário falha'}
                  </div>
                </div>
                {/* Zoom controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => setPanelZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))} title="Diminuir zoom" style={{ background: '#ffffff11', border: '1px solid #ffffff22', color: '#ffffff66', fontFamily: 'monospace', fontSize: 12, width: 22, height: 22, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>−</button>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff44', minWidth: 28, textAlign: 'center' }}>{Math.round(panelZoom * 100)}%</span>
                  <button onClick={() => setPanelZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))} title="Aumentar zoom" style={{ background: '#ffffff11', border: '1px solid #ffffff22', color: '#ffffff66', fontFamily: 'monospace', fontSize: 12, width: 22, height: 22, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>+</button>
                </div>
                <button onClick={() => setEditingRole(null)} style={{ background: 'transparent', border: 'none', color: '#ffffff44', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1, marginLeft: 2 }}>×</button>
              </div>

              {/* Scrollable content */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <div style={{ zoom: panelZoom, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* ── Health warning banner ── */}
                  {(() => {
                    const provId = editingRole === 'primary' ? extraction?.provider : extraction?.fallback?.provider;
                    const h = provId ? providerHealth[provId] : undefined;
                    if (!h || h.ok) return null;
                    return (
                      <div style={{
                        background: '#2a1200',
                        border: '1px solid #f9731666',
                        borderRadius: 8,
                        padding: '10px 12px',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                      }}>
                        <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.2 }}>⚠️</span>
                        <div>
                          <div style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: '#f97316', marginBottom: 4 }}>
                            Provider não configurado
                          </div>
                          <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#f9731699', lineHeight: 1.6 }}>
                            {h.reason}
                          </div>
                          {healthLoading && (
                            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff33', marginTop: 4 }}>
                              Verificando…
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {editingRole === 'primary' ? (
                    <>
                      {/* ── DOC: O que é o LLM Primário ── */}
                      <DocSection title="O que é o LLM Primário?" color="#c026d3">
                        <p style={infoText}>
                          É o modelo de linguagem responsável por <strong style={{ color: '#c026d3' }}>ler a mensagem do cliente</strong>{' '}
                          e extrair os dados estruturados necessários para montar o pedido.
                          Toda conversa passa obrigatoriamente pelo primário — ele é chamado
                          a cada turno em que o orquestrador processa uma mensagem.
                        </p>
                      </DocSection>

                      {/* ── DOC: O que ele extrai ── */}
                      <DocSection title="O que ele extrai?" color="#f97316">
                        <p style={{ ...infoText, marginBottom: 8 }}>
                          O modelo lê o histórico da conversa e o system prompt de extração
                          e devolve um JSON com os campos abaixo. Campos ausentes ficam{' '}
                          <code style={{ color: '#ef4444' }}>null</code>.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {[
                            ['name', 'Nome do cliente'],
                            ['phoneNumber', 'Telefone para contato'],
                            ['description', 'Descrição livre do pedido'],
                            ['productStyle', 'Estilo/tema do produto (ex: Funko, busto)'],
                            ['referenceImageDescription', 'Descrição da imagem de referência'],
                            ['saleValue', 'Valor acordado (número)'],
                            ['deliveryDate', 'Data de entrega combinada'],
                            ['generate_image', 'true se o cliente pediu prévia visual'],
                            ['image_prompt', 'Prompt para geração da imagem'],
                            ['image_requires_reference', 'true se precisa de foto da pessoa'],
                            ['intent', 'Intenção detectada (buy / browse / support / other)'],
                            ['needs_human', 'true se o bot não consegue resolver sozinho'],
                          ].map(([field, desc]) => (
                            <div key={field} style={{ display: 'flex', gap: 6, fontFamily: 'monospace' }}>
                              <code style={{ fontSize: 8, color: '#c026d3', flexShrink: 0, width: 160 }}>{field}</code>
                              <span style={{ fontSize: 8, color: '#ffffff44', lineHeight: 1.5 }}>{desc}</span>
                            </div>
                          ))}
                        </div>
                      </DocSection>

                      {/* ── DOC: Fluxo de chamada ── */}
                      <DocSection title="Fluxo de chamada" color="#22d3ee">
                        <FlowStep icon="📨" color="#22d3ee" label="1. Mensagem entra" note="O orquestrador monta o histórico + system prompt de extração." />
                        {divider}
                        <FlowStep icon="🤖" color="#c026d3" label="2. LLM Primário processa" note="Recebe todo o contexto dentro da janela de contexto (num_ctx)." />
                        {divider}
                        <FlowStep icon="🧾" color="#22c55e" label="3. JSON extraído" note="O orquestrador valida e usa os campos para tomar decisões (gerar imagem, criar venda, pedir mais dados)." />
                        {divider}
                        <FlowStep icon="⚠️" color="#ef4444" label="4. Falha → Fallback" note="Se o JSON vier malformado ou o modelo timeout, o fallback é acionado." />
                      </DocSection>

                      {/* ── SEPARADOR configuração ── */}
                      <div style={{ borderTop: '1px solid #c026d322', paddingTop: 4 }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: '#c026d3aa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                          Configuração
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {/* Provider */}
                          <FieldDoc name="provider" type="string" color="#c026d3">
                            De onde o modelo é servido.{' '}
                            <strong style={{ color: '#f97316' }}>ollama</strong> = execução local (GPU própria, sem custo por token).{' '}
                            <strong style={{ color: '#22d3ee' }}>anthropic / openai / xai</strong> = cloud (requer API key no .env, cobra por token).
                          </FieldDoc>

                          <FieldDoc name="model" type="string" color="#c026d3">
                            Identificador exato do modelo.
                            Para Ollama: use o nome exato da tag (<code style={{ color: '#22d3ee' }}>ollama list</code>).
                            Para cloud: use o ID da API (ex: <code style={{ color: '#22d3ee' }}>claude-sonnet-4-6</code>, <code style={{ color: '#22d3ee' }}>gpt-4o</code>).
                          </FieldDoc>

                          <FieldDoc name="temperature" type="float 0–2" color="#c026d3">
                            Controla a <strong style={{ color: '#f97316' }}>aleatoriedade</strong> da resposta.
                            <br />• <code style={{ color: '#22d3ee' }}>0</code> = sempre a mesma resposta para o mesmo input (determinístico).
                            <br />• <code style={{ color: '#22d3ee' }}>0.05–0.15</code> = recomendado para extração — respostas estáveis com pequena variação.
                            <br />• Valores acima de <code style={{ color: '#ef4444' }}>0.5</code> aumentam risco de JSON malformado.
                          </FieldDoc>

                          <FieldDoc name="maxTokens" type="int 256–32768" color="#c026d3">
                            <strong style={{ color: '#f97316' }}>Limite máximo de tokens na resposta do LLM</strong>, não no input.
                            <br /><br />
                            O orquestrador envia o histórico + system prompt como input. O modelo responde com o JSON de extração.
                            Se a resposta for maior que <code style={{ color: '#22d3ee' }}>maxTokens</code>, ela é <strong style={{ color: '#ef4444' }}>cortada no meio</strong> — o JSON fica incompleto e vai para o fallback.
                            <br /><br />
                            O JSON de extração típico tem ≈ 200–400 tokens. Valores acima de{' '}
                            <code style={{ color: '#22d3ee' }}>800</code> são seguros para a grande maioria dos casos.
                            Reduza apenas se o modelo for muito pequeno e lento (ex: 3B params).
                            <br /><br />
                            <span style={{ color: '#ffffff44' }}>
                              ⚠️ Não confundir com <code style={{ color: '#ffffff66' }}>OLLAMA_NUM_CTX</code> (janela de contexto do input).
                              maxTokens controla o output; num_ctx controla o quanto de histórico o modelo consegue ler.
                            </span>
                          </FieldDoc>

                          <FieldDoc name="executionMode" type="'local' | 'cloud'" color="#c026d3">
                            <strong style={{ color: '#f97316' }}>local</strong>: o orquestrador adquire o lock da GPU antes de chamar o modelo
                            (evita que geração de imagem e extração rodem simultaneamente e travem a memória).
                            <br />
                            <strong style={{ color: '#22d3ee' }}>cloud</strong>: sem lock — a requisição vai direto à API sem bloquear recursos locais.
                            Use <em>cloud</em> quando o provider for Anthropic, OpenAI ou xAI.
                          </FieldDoc>
                        </div>
                      </div>

                      {/* Form fields */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                          <label style={labelStyle}>Provider</label>
                          <select style={{ ...inputStyle, cursor: 'pointer' }} value={primaryForm.provider} onChange={(e) => setPrimaryForm((f) => ({ ...f, provider: e.target.value }))}>
                            {providerOptions.length > 0 ? providerOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : <><option value="ollama">ollama</option><option value="anthropic">anthropic</option><option value="openai">openai</option></>}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Modelo</label>
                          <ModelSelector
                            baseUrl={baseUrl}
                            provider={primaryForm.provider}
                            value={primaryForm.model}
                            onChange={(m) => setPrimaryForm((f) => ({ ...f, model: m }))}
                            color={accentColor}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Temperature</label>
                            <input type="number" min={0} max={2} step={0.05} style={{ ...inputStyle }} value={primaryForm.temperature} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setPrimaryForm((f) => ({ ...f, temperature: v })); }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Max tokens</label>
                            <input type="number" min={256} max={32768} step={256} style={{ ...inputStyle }} value={primaryForm.maxTokens} onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 256) setPrimaryForm((f) => ({ ...f, maxTokens: v })); }} />
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Modo de execução</label>
                          <select style={{ ...inputStyle, cursor: 'pointer' }} value={primaryForm.executionMode} onChange={(e) => setPrimaryForm((f) => ({ ...f, executionMode: e.target.value }))}>
                            <option value="local">local (requer GPU lock)</option>
                            <option value="cloud">cloud (sem lock)</option>
                          </select>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* ── DOC: O que é o Fallback ── */}
                      <DocSection title="O que é o LLM Fallback?" color="#ef4444">
                        <p style={infoText}>
                          É um segundo modelo de linguagem acionado <strong style={{ color: '#ef4444' }}>automaticamente</strong>{' '}
                          quando o LLM primário não consegue produzir uma resposta válida.
                          Ele recebe exatamente o mesmo prompt e tenta novamente,
                          geralmente usando um modelo diferente (ex: cloud mais capaz).
                        </p>
                      </DocSection>

                      {/* ── DOC: Quando o fallback é ativado ── */}
                      <DocSection title="Quando ele é ativado?" color="#f97316">
                        <p style={{ ...infoText, marginBottom: 10 }}>O fallback entra em ação em qualquer um destes casos:</p>
                        <FlowStep icon="✗" color="#ef4444" label="JSON malformado" note="O primário respondeu algo que não pôde ser parseado como JSON válido — pode ocorrer quando o modelo é pequeno ou a temperatura está alta." />
                        {divider}
                        <FlowStep icon="✗" color="#ef4444" label="Campos obrigatórios ausentes" note="O JSON foi parseado mas faltaram campos críticos que o orquestrador precisa para continuar." />
                        {divider}
                        <FlowStep icon="✗" color="#ef4444" label="Timeout / erro de rede" note="Ollama não respondeu dentro do prazo (HTTP_TIMEOUT_MS) ou retornou erro 5xx." />
                        {divider}
                        <FlowStep icon="✗" color="#ef4444" label="Erro de parse (llm.parse_failed)" note="O evento SSE 'llm.parse_failed' é emitido e o fallback recebe o mesmo contexto imediatamente." />
                      </DocSection>

                      {/* ── DOC: Por que usar um provider diferente no fallback ── */}
                      <DocSection title="Por que usar um provider diferente?" color="#22d3ee">
                        <p style={infoText}>
                          O padrão mais robusto é ter o <strong style={{ color: '#c026d3' }}>primário local</strong> (Ollama, rápido, sem custo)
                          e o <strong style={{ color: '#22d3ee' }}>fallback em cloud</strong> (Anthropic/OpenAI, mais capaz, com custo).
                          Assim a operação normal é gratuita e o cloud entra somente em casos excepcionais.
                        </p>
                        <div style={{ marginTop: 8, background: '#001a22', border: '1px solid #22d3ee18', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#22d3eeaa', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Exemplo recomendado</div>
                          <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff55', lineHeight: 1.9 }}>
                            primário: <span style={{ color: '#f97316' }}>ollama / llama3.1:8b</span> (local, grátis)<br />
                            fallback: <span style={{ color: '#22d3ee' }}>anthropic / claude-haiku-4-5</span> (cloud, pago por token)
                          </div>
                        </div>
                      </DocSection>

                      {/* ── DOC: O que acontece se o fallback tb falhar ── */}
                      <DocSection title="E se o fallback também falhar?" color="#ffffff44">
                        <p style={infoText}>
                          O orquestrador emite o evento <code style={{ color: '#ef4444' }}>stage.failed {'{'} stageId: 'extraction' {'}'}</code>{' '}
                          no EventBus e a resposta ao cliente usa apenas o{' '}
                          <strong style={{ color: '#f97316' }}>último estado conhecido</strong> da conversa
                          (dados já extraídos em turnos anteriores). A conversa não trava — o bot responde
                          com o que sabe, e o operador é alertado via log de nível <code style={{ color: '#ef4444' }}>error</code>.
                        </p>
                      </DocSection>

                      {/* ── SEPARADOR configuração ── */}
                      <div style={{ borderTop: '1px solid #ef444422', paddingTop: 4 }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: '#ef4444aa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                          Configuração
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                          <FieldDoc name="provider" type="string" color="#ef4444">
                            Provider do fallback. Pode ser igual ao primário (mesmo Ollama com modelo maior) ou diferente (cloud).
                            Se deixar o modelo vazio, o fallback fica desabilitado mesmo que o provider esteja configurado.
                          </FieldDoc>
                          <FieldDoc name="model" type="string" color="#ef4444">
                            Modelo usado na segunda tentativa. Recomenda-se um modelo <strong style={{ color: '#f97316' }}>mais capaz</strong> que o primário —
                            o fallback é acionado em situações difíceis onde o primário já falhou.
                            Deixe em branco para desativar o fallback completamente.
                          </FieldDoc>
                        </div>

                        {/* Form fields */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div>
                            <label style={{ ...labelStyle, color: '#ef4444aa' }}>Provider fallback</label>
                            <select style={{ ...inputStyle, borderColor: '#ef444433', cursor: 'pointer' }} value={fallbackForm.provider} onChange={(e) => setFallbackForm((f) => ({ ...f, provider: e.target.value }))}>
                              {providerOptions.length > 0 ? providerOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : <><option value="ollama">ollama</option><option value="anthropic">anthropic</option><option value="openai">openai</option></>}
                            </select>
                          </div>
                          <div>
                            <label style={{ ...labelStyle, color: '#ef4444aa' }}>Modelo fallback</label>
                            <ModelSelector
                              baseUrl={baseUrl}
                              provider={fallbackForm.provider}
                              value={fallbackForm.model}
                              onChange={(m) => setFallbackForm((f) => ({ ...f, model: m }))}
                              color="#ef4444"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      style={{
                        background: saving ? '#1a0028' : `${accentColor}22`,
                        border: `1px solid ${saving ? `${accentColor}33` : `${accentColor}66`}`,
                        color: saving ? `${accentColor}77` : accentColor,
                        fontFamily: 'monospace',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '8px 0',
                        borderRadius: 6,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {saving ? 'Salvando…' : 'Salvar alterações'}
                    </button>
                    <button
                      onClick={() => setEditingRole(null)}
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
                  </div>

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
