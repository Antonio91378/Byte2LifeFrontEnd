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
  getCustomWorkflows,
  getImageGenConfig,
  getImageWorkflows,
  getVisionDescriptorConfig,
  scanCustomWorkflows,
  subscribeToFlowEvents,
  updateCustomWorkflow,
  updateImageDispatcher,
  updateImageRouterConfig,
  updateImageWorkflow,
  updateVisionDescriptorConfig,
  type CustomWorkflowsState,
  type DiscoveredWorkflow,
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
  durationMs?: number;
  limitMs?: number;
}

interface LLMRouterNodeData extends Record<string, unknown> {
  model: string;
  provider: string;
  visionEnabled: boolean;
  visionModel: string;
  onOpenPanel: () => void;
  status?: NodeStatus;
  durationMs?: number;
  limitMs?: number;
}

interface ExecInfo {
  prompt: string;
  reasoning: string;
  ts: number;
}

interface WorkflowNodeData extends Record<string, unknown> {
  provider: ImageWorkflowProvider;
  onToggle: (name: string, enabled: boolean) => void;
  onEdit: (name: string) => void;
  status?: NodeStatus;
  isActiveProvider?: boolean;
  lastExecution?: ExecInfo;
  durationMs?: number;
  limitMs?: number;
}

interface NodeTime {
  startTs: number;
  endTs?: number;
}

// ─── Timing helpers ───────────────────────────────────────────────────────────

function fmtSec(ms: number) { return (ms / 1000).toFixed(1); }

function getTimingColor(ms: number, limitMs?: number): string {
  if (!limitMs) return '#22d3ee';
  const r = ms / limitMs;
  if (r >= 0.9) return '#ef4444';
  if (r >= 0.6) return '#f97316';
  if (r >= 0.3) return '#fbbf24';
  return '#22c55e';
}

/** Compact timing badge — shown inside node when status is completed/failed */
function TimingBadge({ durationMs, limitMs, accentColor }: { durationMs: number; limitMs?: number; accentColor?: string }) {
  const color = accentColor ?? getTimingColor(durationMs, limitMs);
  return (
    <div style={{
      fontFamily: 'monospace',
      fontSize: 8,
      fontWeight: 700,
      color,
      background: `${color}15`,
      border: `1px solid ${color}33`,
      borderRadius: 4,
      padding: '2px 6px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      marginTop: 4,
    }}>
      ⏱ {fmtSec(durationMs)}s
    </div>
  );
}

/** Full timing tooltip rendered inside a positioned parent (parent must have position:relative, overflow:visible) */
function TimingTooltip({
  label, durationMs, limitMs, color, isActive = false,
}: {
  label: string;
  durationMs: number;
  limitMs?: number;
  color: string;
  isActive?: boolean;
}) {
  const tColor = isActive ? color : getTimingColor(durationMs, limitMs);
  const pct = limitMs ? Math.min((durationMs / limitMs) * 100, 100) : null;
  const isTimeout = !isActive && limitMs !== undefined && durationMs >= limitMs * 0.85;
  return (
    <div style={{
      position: 'absolute',
      bottom: 'calc(100% + 12px)',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#060010',
      border: `1.5px solid ${tColor}88`,
      borderRadius: 9,
      padding: '10px 14px',
      zIndex: 9999,
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      boxShadow: `0 6px 28px ${tColor}33`,
      minWidth: 155,
    }}>
      <div style={{ fontFamily: 'monospace', fontSize: 8, color: tColor, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11 }}>{isTimeout ? '⏰' : isActive ? '⏳' : '⏱'}</span>{label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 3 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>{fmtSec(durationMs)}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#fff8', fontWeight: 700 }}>s</span>
        {isActive && <span style={{ fontFamily: 'monospace', fontSize: 8, color: tColor, marginLeft: 2 }}>e contando…</span>}
      </div>
      {pct !== null && !isActive && (
        <>
          <div style={{ marginTop: 4, marginBottom: 3 }}>
            <div style={{ background: '#fff1', borderRadius: 3, height: 5, width: '100%', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: tColor, borderRadius: 3, boxShadow: `0 0 6px ${tColor}` }} />
            </div>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#fff3', display: 'flex', justifyContent: 'space-between' }}>
            <span>limite: <span style={{ color: '#fff5' }}>{(limitMs! / 1000).toFixed(0)}s</span></span>
            <span style={{ color: tColor }}>{pct.toFixed(0)}% usado</span>
          </div>
        </>
      )}
      {isTimeout && (
        <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#ef4444cc', marginTop: 6, borderTop: '1px solid #ef444422', paddingTop: 5, lineHeight: 1.6 }}>
          ⚠ Provável timeout.<br />Considere trocar o LLM.
        </div>
      )}
    </div>
  );
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
  const { provider, onToggle, onEdit, status = 'idle', isActiveProvider = false, lastExecution, durationMs, limitMs = 90_000 } = data as WorkflowNodeData;
  const [showTooltip, setShowTooltip] = useState(false);
  const [timingDismissed, setTimingDismissed] = useState(false);

  const isEnabled = provider.enabled !== false;
  const isCloud = provider.executionMode === 'cloud';
  const accentColor = isEnabled ? (isCloud ? '#22d3ee' : '#f97316') : '#666666';
  // Pulse only while actively generating; steady glow once selected/completed
  const isAnimated = status === 'active';
  const glowShadow = isActiveProvider && status === 'completed'
    ? `0 0 14px ${accentColor}88`
    : isActiveProvider || status === 'active'
      ? `0 0 22px ${accentColor}`
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
        transition: 'opacity 0.2s, border-color 0.2s, box-shadow 0.3s',
        cursor: 'pointer',
        boxShadow: glowShadow,
        animation: isAnimated
          ? `${isCloud ? 'nodeGlowCyan' : 'nodeGlowOrange'} 1.1s ease-in-out infinite alternate`
          : undefined,
        position: 'relative',
        overflow: 'visible',
      }}
      onMouseEnter={(e) => {
        setShowTooltip(true);
        if (!isAnimated) (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 12px ${accentColor}66`;
      }}
      onMouseLeave={(e) => {
        setShowTooltip(false);
        if (!isAnimated) (e.currentTarget as HTMLDivElement).style.boxShadow = glowShadow;
      }}
    >
      {/* Status badge — always visible when active/completed */}
      {(status === 'active' || (isActiveProvider && status === 'completed')) && (
        <div style={{
          position: 'absolute',
          top: -10,
          right: -4,
          background: status === 'active' ? accentColor : '#22c55e',
          color: '#000000',
          fontFamily: 'monospace',
          fontSize: 7,
          fontWeight: 800,
          letterSpacing: '0.05em',
          padding: '1px 5px',
          borderRadius: 4,
          zIndex: 10,
          pointerEvents: 'none',
          boxShadow: `0 0 8px ${status === 'active' ? accentColor : '#22c55e'}`,
        }}>
          {status === 'active' ? '● GERANDO' : '✓ SELECIONADO'}
        </div>
      )}

      {/* Tooltip — shown on hover: execution info only */}
      {showTooltip && lastExecution && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 14px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 290,
            background: '#06000e',
            border: `1.5px solid ${accentColor}99`,
            borderRadius: 9,
            padding: '11px 13px',
            zIndex: 9999,
            boxShadow: `0 6px 32px ${accentColor}44`,
            pointerEvents: 'none',
          }}
        >
          {/* ── Execution info section ── */}
          {lastExecution && (
            <>
              <div style={{ fontFamily: 'monospace', fontSize: 8, color: accentColor, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 10 }}>◈</span>
                Última execução · {new Date(lastExecution.ts).toLocaleTimeString('pt-BR', { hour12: false })}
              </div>
              {lastExecution.reasoning && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 7.5, color: '#c026d3', marginBottom: 3, letterSpacing: '0.04em' }}>REASONING</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff77', lineHeight: 1.6, borderLeft: '2px solid #c026d344', paddingLeft: 6 }}>
                    {lastExecution.reasoning.slice(0, 160)}{lastExecution.reasoning.length > 160 ? '…' : ''}
                  </div>
                </div>
              )}
              <div style={{ fontFamily: 'monospace', fontSize: 7.5, color: accentColor, marginBottom: 4, letterSpacing: '0.04em' }}>PROMPT ENVIADO</div>
              <div style={{
                fontFamily: 'monospace', fontSize: 7.5, color: `${accentColor}cc`, lineHeight: 1.65,
                wordBreak: 'break-word', maxHeight: 130, overflowY: 'auto',
                background: '#100500', borderRadius: 5, padding: '6px 9px',
                border: `1px solid ${accentColor}22`,
              }}>
                {lastExecution.prompt.slice(0, 400)}{lastExecution.prompt.length > 400 ? '…' : ''}
              </div>
            </>
          )}
        </div>
      )}
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

      {/* Compact badge — only in dismissed mode */}
      {durationMs !== undefined && (status === 'completed' || status === 'failed') && timingDismissed && (
        <TimingBadge durationMs={durationMs} limitMs={limitMs} accentColor={status === 'failed' ? '#ef4444' : undefined} />
      )}
      {/* Inline timing panel — default visible, × to dismiss */}
      {durationMs !== undefined && status !== 'idle' && !timingDismissed && (
        <div style={{ marginTop: 6, padding: '5px 7px', background: `${accentColor}0d`, border: `1px solid ${accentColor}22`, borderRadius: 6, position: 'relative' }}>
          <button onClick={(e) => { e.stopPropagation(); setTimingDismissed(true); }} style={{ position: 'absolute', top: 1, right: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff33', fontSize: 12, padding: 0, lineHeight: 1 }} title="Ocultar">×</button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 4 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 8, color: getTimingColor(durationMs, limitMs) }}>⏱</span>
            <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{fmtSec(durationMs)}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff55' }}>s</span>
            {status === 'active' && <span style={{ fontFamily: 'monospace', fontSize: 7, color: accentColor, marginLeft: 2 }}>contando…</span>}
          </div>
          {status !== 'active' && (
            <>
              <div style={{ background: '#ffffff11', borderRadius: 2, height: 3, width: '100%', overflow: 'hidden', marginBottom: 2 }}>
                <div style={{ width: `${Math.min((durationMs / limitMs) * 100, 100)}%`, height: '100%', background: getTimingColor(durationMs, limitMs), borderRadius: 2 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 7.5, color: '#ffffff2a' }}>
                <span>lim: {(limitMs / 1000).toFixed(0)}s</span>
                <span style={{ color: getTimingColor(durationMs, limitMs) }}>{Math.min((durationMs / limitMs) * 100, 100).toFixed(0)}%</span>
              </div>
            </>
          )}
          {status === 'failed' && durationMs >= limitMs * 0.85 && (
            <div style={{ fontFamily: 'monospace', fontSize: 7.5, color: '#ef4444aa', marginTop: 4 }}>⚠ provável timeout</div>
          )}
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
  const { strategy, maxAttempts, onOpenPanel, status = 'idle', durationMs, limitMs = 20_000 } = data as DispatcherNodeData;
  const [hovered, setHovered] = useState(true);
  const [timingDismissed, setTimingDismissed] = useState(false);
  const borderColor = status === 'active' ? '#c026d3' : status === 'completed' ? '#22c55eaa' : '#c026d3aa';

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onOpenPanel();
      }}
      style={{
        background: status === 'active' ? '#2a003a' : '#1a0028',
        border: `1.5px solid ${borderColor}`,
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 150,
        fontFamily: 'monospace',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        boxShadow: status === 'active' ? `0 0 16px ${borderColor}` : status === 'completed' ? `0 0 6px ${borderColor}44` : 'none',
        animation: status === 'active' ? 'nodeGlowPurple 1.1s ease-in-out infinite alternate' : undefined,
        position: 'relative',
        overflow: 'visible',
      }}
      onMouseEnter={(e) => {
        setHovered(true);
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 14px ${borderColor}88`;
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        (e.currentTarget as HTMLDivElement).style.boxShadow = status === 'active' ? `0 0 16px ${borderColor}` : status === 'completed' ? `0 0 6px ${borderColor}44` : 'none';
      }}
    >
      {/* Timing tooltip — hover-only after inline panel is dismissed */}
      {hovered && durationMs !== undefined && status !== 'idle' && timingDismissed && (
        <TimingTooltip
          label="Dispatcher"
          durationMs={durationMs}
          limitMs={limitMs}
          color="#c026d3"
          isActive={status === 'active'}
        />
      )}
      {status !== 'idle' && (
        <div style={{
          position: 'absolute', top: -9, right: -3,
          background: status === 'active' ? '#c026d3' : status === 'completed' ? '#22c55e' : '#ef4444',
          color: '#000', fontFamily: 'monospace', fontSize: 7, fontWeight: 800,
          padding: '1px 4px', borderRadius: 3, zIndex: 10, pointerEvents: 'none',
        }}>
          {status === 'active' ? '●' : status === 'completed' ? '✓' : '✗'}
        </div>
      )}
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
        {/* Compact badge shown only in dismissed mode */}
        {durationMs !== undefined && (status === 'completed' || status === 'failed') && timingDismissed && (
          <TimingBadge durationMs={durationMs} limitMs={limitMs} />
        )}
      </div>
      {/* Inline timing panel — default visible, × to dismiss */}
      {durationMs !== undefined && status !== 'idle' && !timingDismissed && (
        <div style={{ marginTop: 7, padding: '5px 7px', background: '#c026d30d', border: '1px solid #c026d322', borderRadius: 6, position: 'relative' }}>
          <button onClick={(e) => { e.stopPropagation(); setTimingDismissed(true); }} style={{ position: 'absolute', top: 1, right: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff33', fontSize: 12, padding: 0, lineHeight: 1 }} title="Ocultar">×</button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 4 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 8, color: getTimingColor(durationMs, limitMs) }}>⏱</span>
            <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{fmtSec(durationMs)}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff55' }}>s</span>
            {status === 'active' && <span style={{ fontFamily: 'monospace', fontSize: 7, color: '#c026d3', marginLeft: 2 }}>contando…</span>}
          </div>
          {status !== 'active' && (
            <>
              <div style={{ background: '#ffffff11', borderRadius: 2, height: 3, width: '100%', overflow: 'hidden', marginBottom: 2 }}>
                <div style={{ width: `${Math.min((durationMs / limitMs) * 100, 100)}%`, height: '100%', background: getTimingColor(durationMs, limitMs), borderRadius: 2 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 7.5, color: '#ffffff2a' }}>
                <span>lim: {(limitMs / 1000).toFixed(0)}s</span>
                <span style={{ color: getTimingColor(durationMs, limitMs) }}>{Math.min((durationMs / limitMs) * 100, 100).toFixed(0)}%</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── LLMRouterNode (custom ReactFlow node) ───────────────────────────────────

function LLMRouterNode({ data }: NodeProps) {
  const { model, provider, visionEnabled, visionModel, onOpenPanel, status = 'idle', durationMs, limitMs = 20_000 } = data as LLMRouterNodeData;
  const [hovered, setHovered] = useState(true);
  const [timingDismissed, setTimingDismissed] = useState(false);
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
        boxShadow: isActive ? `0 0 16px ${color}` : isCompleted ? `0 0 6px ${color}44` : 'none',
        animation: isActive ? 'nodeGlowCyan 1.1s ease-in-out infinite alternate' : undefined,
        position: 'relative',
        overflow: 'visible',
      }}
      onMouseEnter={(e) => {
        setHovered(true);
        if (!isActive) (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 12px ${color}66`;
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        (e.currentTarget as HTMLDivElement).style.boxShadow = isActive ? `0 0 16px ${color}` : isCompleted ? `0 0 6px ${color}44` : 'none';
      }}
    >
      {/* Timing tooltip — hover-only after inline panel dismissed */}
      {hovered && durationMs !== undefined && status !== 'idle' && timingDismissed && (
        <TimingTooltip
          label="LLM Router"
          durationMs={durationMs}
          limitMs={limitMs}
          color="#22d3ee"
          isActive={isActive}
        />
      )}
      {(isActive || isCompleted) && (
        <div style={{
          position: 'absolute', top: -9, right: -3,
          background: isActive ? '#22d3ee' : '#22c55e',
          color: '#000', fontFamily: 'monospace', fontSize: 7, fontWeight: 800,
          padding: '1px 4px', borderRadius: 3, zIndex: 10, pointerEvents: 'none',
        }}>
          {isActive ? '●' : '✓'}
        </div>
      )}
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
      {/* Compact badge — only in dismissed mode */}
      {durationMs !== undefined && (isCompleted || status === 'failed') && timingDismissed && (
        <TimingBadge durationMs={durationMs} limitMs={limitMs} accentColor={status === 'failed' ? '#ef4444' : '#22d3ee'} />
      )}
      {/* Inline timing panel — default visible, × to dismiss */}
      {durationMs !== undefined && status !== 'idle' && !timingDismissed && (
        <div style={{ marginTop: 7, padding: '5px 7px', background: '#22d3ee0d', border: '1px solid #22d3ee22', borderRadius: 6, position: 'relative' }}>
          <button onClick={(e) => { e.stopPropagation(); setTimingDismissed(true); }} style={{ position: 'absolute', top: 1, right: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff33', fontSize: 12, padding: 0, lineHeight: 1 }} title="Ocultar">×</button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 4 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 8, color: getTimingColor(durationMs, limitMs) }}>⏱</span>
            <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{fmtSec(durationMs)}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff55' }}>s</span>
            {isActive && <span style={{ fontFamily: 'monospace', fontSize: 7, color: '#22d3ee', marginLeft: 2 }}>contando…</span>}
          </div>
          {!isActive && (
            <>
              <div style={{ background: '#ffffff11', borderRadius: 2, height: 3, width: '100%', overflow: 'hidden', marginBottom: 2 }}>
                <div style={{ width: `${Math.min((durationMs / limitMs) * 100, 100)}%`, height: '100%', background: getTimingColor(durationMs, limitMs), borderRadius: 2 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 7.5, color: '#ffffff2a' }}>
                <span>lim: {(limitMs / 1000).toFixed(0)}s</span>
                <span style={{ color: getTimingColor(durationMs, limitMs) }}>{Math.min((durationMs / limitMs) * 100, 100).toFixed(0)}%</span>
              </div>
            </>
          )}
        </div>
      )}
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

export function ImageGenSubFlow({ baseUrl, definition, onBack, conversationId }: ImageGenSubFlowProps) {
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

  // ─── Custom Workflow Scan state ───────────────────────────────────────────
  const [scanPanelOpen, setScanPanelOpen] = useState(false);
  const [customWf, setCustomWf] = useState<CustomWorkflowsState>({ folder: null, discovered: {} });
  const [scanFolder, setScanFolder] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [savingWf, setSavingWf] = useState<string | null>(null);

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
  const [tick, setTick] = useState(0);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [execInfoMap, setExecInfoMap] = useState<Map<string, ExecInfo>>(new Map());
  const [nodeTimes, setNodeTimes] = useState<Map<string, NodeTime>>(new Map());
  const activeProviderRef = useRef<string | null>(null);
  const pendingPromptRef = useRef<string | null>(null);
  const sseCleanupRef = useRef<(() => void) | null>(null);

  // Real-time tick: re-runs liveNodes every second while any node is active.
  useEffect(() => {
    const hasActive = [...nodeStatuses.values()].some(s => s === 'active');
    if (!hasActive) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [nodeStatuses]);

  // Keep ref in sync with state so applyImageEvent can access it without closure issues
  useEffect(() => { activeProviderRef.current = activeProviderId; }, [activeProviderId]);

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

    getCustomWorkflows(baseUrl)
      .then((s) => {
        setCustomWf(s);
        setScanFolder(s.folder ?? '');
      })
      .catch(() => {});
  }, [baseUrl]);

  async function handleScan() {
    setScanning(true);
    setScanError(null);
    try {
      const result = await scanCustomWorkflows(baseUrl, scanFolder || undefined);
      setCustomWf({ folder: result.folder, discovered: result.discovered });
    } catch (e: unknown) {
      setScanError(e instanceof Error ? e.message : 'Erro ao escanear');
    } finally {
      setScanning(false);
    }
  }

  async function handleToggleCustomWf(name: string, entry: DiscoveredWorkflow) {
    setSavingWf(name);
    try {
      const result = await updateCustomWorkflow(baseUrl, name, { enabled: !entry.enabled });
      setCustomWf((prev) => ({
        ...prev,
        discovered: { ...prev.discovered, [name]: result.workflow },
      }));
      // Refresh providers list so the new custom_* provider appears in the canvas
      const { providers: p } = await getImageWorkflows(baseUrl);
      setProviders(p);
    } catch {
      /* silently fail */
    } finally {
      setSavingWf(null);
    }
  }

  async function handleSetCustomWfType(name: string, generationType: 'txt2img' | 'img2img') {
    setSavingWf(name);
    try {
      const result = await updateCustomWorkflow(baseUrl, name, { generationType });
      setCustomWf((prev) => ({
        ...prev,
        discovered: { ...prev.discovered, [name]: result.workflow },
      }));
    } catch {
      /* silently fail */
    } finally {
      setSavingWf(null);
    }
  }

  // ─── SSE animation subscription ───────────────────────────────────────────

  function applyTimeEvent(
    eventName: string,
    payload: Record<string, unknown> | undefined,
    ts: number,
    times: Map<string, NodeTime>,
  ) {
    const end = (id: string) => { const t = times.get(id); if (t && !t.endTs) times.set(id, { ...t, endTs: ts }); };
    if (eventName === 'stage.started' && payload?.stageId === 'image_gen') {
      times.set('entry', { startTs: ts });
    } else if (eventName === 'image.gen_started') {
      // Routing phase starts (dispatcher + LLM router)
      times.set('dispatcher', { startTs: ts });
      times.set('llmRouter', { startTs: ts });
    } else if (eventName === 'image.dispatcher_selected') {
      // Routing done → provider generation starts
      end('dispatcher');
      end('llmRouter');
      const prov = payload?.provider as string | undefined;
      if (prov) times.set(`provider_${prov}`, { startTs: ts });
    } else if (eventName === 'image.gen_completed') {
      const prov = payload?.provider as string | undefined;
      if (prov) end(`provider_${prov}`);
    } else if (eventName === 'stage.completed' && payload?.stageId === 'image_gen') {
      end('entry');
    } else if (eventName === 'stage.failed' && payload?.stageId === 'image_gen') {
      end('entry');
      end('dispatcher');
      end('llmRouter');
    }
  }

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
      if (sel) m.set(`provider_${sel}`, 'active');
      return sel ? `provider_${sel}` : null;
    } else if (eventName === 'image.gen_completed') {
      const prov = payload?.provider as string | undefined;
      if (prov) m.set(`provider_${prov}`, 'completed');
      m.set('entry', 'completed');
    } else if (eventName === 'stage.completed' && payload?.stageId === 'image_gen') {
      m.set('entry', 'completed'); m.set('dispatcher', 'completed'); m.set('llmRouter', 'completed');
      const activeProv = activeProviderRef.current;
      if (activeProv) m.set(activeProv, 'completed');
    } else if (eventName === 'stage.failed' && payload?.stageId === 'image_gen') {
      m.set('entry', 'failed'); m.set('dispatcher', 'failed'); m.set('llmRouter', 'failed');
      const activeProv = activeProviderRef.current;
      if (activeProv) m.set(activeProv, 'failed');
    }
    return undefined;
  }

  useEffect(() => {
    sseCleanupRef.current?.();
    sseCleanupRef.current = null;
    setNodeStatuses(new Map());
    setActiveProviderId(null);
    setExecInfoMap(new Map());
    setNodeTimes(new Map());
    pendingPromptRef.current = null;

    if (!conversationId) return;

    const cleanup = subscribeToFlowEvents(baseUrl, conversationId, (raw) => {
      // Replay: restore full state from past events
      if ('type' in raw && raw.type === 'trace_replay') {
        const replayedStatuses = new Map<string, NodeStatus>();
        const replayedTimes = new Map<string, NodeTime>();
        let replayedActive: string | null = null;
        const replayedExecMap = new Map<string, ExecInfo>();
        let replayedPendingPrompt = '';
        for (const evt of ((raw.events ?? []) as StageEvent[])) {
          if (evt.eventName === 'image.gen_started' && evt.payload?.prompt) {
            replayedPendingPrompt = evt.payload.prompt as string;
          }
          if (evt.eventName === 'image.dispatcher_selected' && evt.payload?.provider) {
            const prov = evt.payload.provider as string;
            const prompt = (evt.payload.prompt as string | undefined) ?? replayedPendingPrompt;
            replayedExecMap.set(`provider_${prov}`, {
              prompt,
              reasoning: (evt.payload.reasoning as string) ?? '',
              ts: evt.ts,
            });
            replayedPendingPrompt = '';
          }
          applyTimeEvent(evt.eventName, evt.payload, evt.ts, replayedTimes);
          const newActive = applyImageEvent(evt.eventName, evt.payload, replayedStatuses);
          if (newActive !== undefined) replayedActive = newActive;
        }
        setNodeStatuses(new Map(replayedStatuses));
        setActiveProviderId(replayedActive);
        setExecInfoMap(replayedExecMap);
        setNodeTimes(new Map(replayedTimes));
        return;
      }

      const { eventName, payload, ts } = raw as StageEvent;

      // Track pending prompt (gen_started fires before dispatcher_selected)
      if (eventName === 'image.gen_started' && payload?.prompt) {
        pendingPromptRef.current = payload.prompt as string;
      }

      // Track which provider was selected and what prompt was sent
      if (eventName === 'image.dispatcher_selected' && payload?.provider) {
        const prov = payload.provider as string;
        const prompt = (payload.prompt as string | undefined) ?? pendingPromptRef.current ?? '';
        pendingPromptRef.current = null;
        setExecInfoMap((prev) => {
          const next = new Map(prev);
          next.set(`provider_${prov}`, {
            prompt,
            reasoning: (payload.reasoning as string) ?? '',
            ts: ts ?? Date.now(),
          });
          return next;
        });
      }

      // Track timing
      setNodeTimes((prev) => {
        const t = new Map(prev);
        applyTimeEvent(eventName, payload, ts ?? Date.now(), t);
        return t;
      });

      let newActiveProvider: string | null | undefined;
      setNodeStatuses((prev) => {
        const m = new Map(prev);
        newActiveProvider = applyImageEvent(eventName, payload, m);
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

  const liveNodes = useMemo(() => {
    const now = Date.now();
    const localTimeoutMs = definition?.resourcePolicy?.localTimeoutMs ?? 90_000;
    const routerLimitMs = routerConfig?.timeoutMs ?? 20_000;
    return baseNodes.map((n) => {
      const status = nodeStatuses.get(n.id) ?? 'idle';
      const isActiveProvider = n.id === activeProviderId;
      const t = nodeTimes.get(n.id);
      const durationMs = t
        ? t.endTs !== undefined
          ? t.endTs - t.startTs
          : status === 'active' ? now - t.startTs : undefined
        : undefined;
      // Assign the real configured limit per node type
      const limitMs = (n.id === 'dispatcher' || n.id === 'llmRouter')
        ? routerLimitMs
        : n.id.startsWith('provider_')
          ? localTimeoutMs
          : undefined;
      const base = {
        ...n,
        data: {
          ...n.data,
          status,
          isActiveProvider,
          durationMs,
          limitMs,
          ...(execInfoMap.has(n.id) ? { lastExecution: execInfoMap.get(n.id) } : {}),
        },
      };
      // Inject animated style into default 'entry' node
      if (n.id === 'entry') {
        base.style = {
          ...n.style,
          border: status === 'completed'
            ? '1.5px solid #22c55ecc'
            : status === 'failed'
              ? '1.5px solid #ef4444cc'
              : '1.5px solid #f97316',
          boxShadow: status === 'active' ? '0 0 18px #f97316' : 'none',
          animation: status === 'active' ? 'nodeGlowOrange 1.1s ease-in-out infinite alternate' : undefined,
        };
      }
      return base;
    });
  }, [baseNodes, nodeStatuses, activeProviderId, execInfoMap, nodeTimes, definition, routerConfig, tick]);

  // ─── Highlight execution path on edges ────────────────────────────────────

  const liveEdges = useMemo(() => {
    const dispatcherDone = (nodeStatuses.get('dispatcher') ?? 'idle') !== 'idle';
    const llmRouterDone  = (nodeStatuses.get('llmRouter')  ?? 'idle') !== 'idle';
    const selectedProv   = activeProviderId; // e.g. "provider_Image_Z_Image_Turbo"

    return edges.map((e) => {
      if (e.id === 'entry→dispatcher' && dispatcherDone) {
        return { ...e, animated: true, style: { ...e.style, stroke: '#f97316dd', strokeWidth: 2.5 } };
      }
      if (e.id === 'dispatcher→llmRouter' && llmRouterDone) {
        return { ...e, animated: true, style: { ...e.style, stroke: '#c026d3dd', strokeWidth: 2.5 } };
      }
      if (selectedProv && e.target === selectedProv) {
        const isCloud = e.style?.stroke?.toString().includes('22d3ee');
        return {
          ...e,
          animated: true,
          style: { ...e.style, stroke: isCloud ? '#22d3eedd' : '#f97316dd', strokeWidth: 3 },
        };
      }
      return e;
    });
  }, [edges, nodeStatuses, activeProviderId]);

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

        {/* Scan Pasta button */}
        <button
          onClick={() => setScanPanelOpen((v) => !v)}
          style={{
            background: scanPanelOpen ? '#22d3ee22' : 'transparent',
            border: `1px solid ${scanPanelOpen ? '#22d3ee66' : '#22d3ee33'}`,
            color: scanPanelOpen ? '#22d3ee' : '#22d3ee88',
            fontFamily: 'monospace',
            fontSize: 11,
            padding: '4px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          📂 Scan Pasta
        </button>

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

      {/* Scan Pasta panel */}
      <AnimatePresence>
        {scanPanelOpen && (
          <motion.div
            key="scan-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              overflow: 'hidden',
              flexShrink: 0,
              background: '#00111a',
              borderBottom: '1px solid #22d3ee22',
            }}
          >
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Folder input + scan button */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, color: '#22d3ee88' }}>Pasta de workflows do ComfyUI</label>
                  <input
                    style={{ ...inputStyle, borderColor: '#22d3ee33', background: '#001522' }}
                    value={scanFolder}
                    onChange={(e) => setScanFolder(e.target.value)}
                    placeholder="D:\ComfyUI\user\default\workflows"
                  />
                </div>
                <div style={{ paddingTop: 20 }}>
                  <button
                    onClick={handleScan}
                    disabled={scanning}
                    style={{
                      background: scanning ? '#001522' : '#22d3ee22',
                      border: `1px solid ${scanning ? '#22d3ee22' : '#22d3ee55'}`,
                      color: scanning ? '#22d3ee55' : '#22d3ee',
                      fontFamily: 'monospace',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '7px 14px',
                      borderRadius: 6,
                      cursor: scanning ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {scanning ? '⟳ Escaneando…' : '⟳ Escanear'}
                  </button>
                </div>
              </div>

              {scanError && (
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#ef4444', background: '#1a0000', border: '1px solid #ef444433', borderRadius: 6, padding: '6px 10px' }}>
                  {scanError}
                </div>
              )}

              {/* Discovered workflows list */}
              {Object.keys(customWf.discovered).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#22d3ee66', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {Object.keys(customWf.discovered).length} workflow(s) encontrado(s)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
                    {Object.entries(customWf.discovered).map(([name, entry]) => {
                      const isApi = entry.format === 'api';
                      const isSaving = savingWf === name;
                      return (
                        <div
                          key={name}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            background: entry.enabled ? '#001a10' : '#0a0a0a',
                            border: `1px solid ${entry.enabled ? '#22c55e33' : '#ffffff11'}`,
                            borderRadius: 6,
                            padding: '7px 10px',
                            opacity: isSaving ? 0.6 : 1,
                            transition: 'opacity 0.15s',
                          }}
                        >
                          {/* Format badge */}
                          <span
                            title={isApi ? 'Formato API — pronto para execução' : `Formato ${entry.format} — não executável diretamente`}
                            style={{
                              fontSize: 8,
                              fontFamily: 'monospace',
                              background: isApi ? '#22c55e22' : '#f9731622',
                              color: isApi ? '#22c55e' : '#f97316',
                              border: `1px solid ${isApi ? '#22c55e44' : '#f9731644'}`,
                              borderRadius: 4,
                              padding: '1px 5px',
                              flexShrink: 0,
                            }}
                          >
                            {isApi ? '✓ API' : `⚠ ${entry.format ?? 'UI'}`}
                          </span>

                          {/* Name */}
                          <span style={{ fontFamily: 'monospace', fontSize: 10, color: entry.enabled ? '#22c55e' : '#ffffff88', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name}
                          </span>

                          {/* Gen type selector — only for API format */}
                          {isApi && (
                            <select
                              value={entry.generationType ?? 'txt2img'}
                              onChange={(e) => handleSetCustomWfType(name, e.target.value as 'txt2img' | 'img2img')}
                              disabled={isSaving}
                              style={{
                                background: '#001a10',
                                color: '#22c55eaa',
                                border: '1px solid #22c55e22',
                                borderRadius: 4,
                                fontFamily: 'monospace',
                                fontSize: 9,
                                padding: '2px 4px',
                                cursor: isSaving ? 'not-allowed' : 'pointer',
                                flexShrink: 0,
                              }}
                            >
                              <option value="txt2img">txt→img</option>
                              <option value="img2img">img→img</option>
                            </select>
                          )}

                          {/* Toggle enable */}
                          <button
                            onClick={() => { if (!isSaving && isApi) handleToggleCustomWf(name, entry); }}
                            disabled={isSaving || !isApi}
                            title={!isApi ? 'Só workflows no formato API podem ser ativados' : entry.enabled ? 'Desativar' : 'Ativar'}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: isSaving || !isApi ? 'not-allowed' : 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              opacity: !isApi ? 0.35 : 1,
                              flexShrink: 0,
                            }}
                          >
                            {entry.enabled
                              ? <ToggleRight size={18} style={{ color: '#22c55e' }} />
                              : <ToggleLeft size={18} style={{ color: '#555555' }} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {Object.values(customWf.discovered).some((e) => e.format !== 'api') && (
                    <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#f9731688', lineHeight: 1.5 }}>
                      ⚠ Workflows com formato UI precisam ser exportados em formato API pelo ComfyUI (Save → Export API).
                    </div>
                  )}
                </div>
              )}

              {Object.keys(customWf.discovered).length === 0 && !scanning && customWf.folder && (
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#ffffff33', fontStyle: 'italic' }}>
                  Nenhum workflow encontrado. Clique em Escanear para atualizar.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                edges={liveEdges}
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
                @keyframes nodeGlowOrange {
                  from { filter: brightness(1.05) drop-shadow(0 0 5px #f97316aa); }
                  to   { filter: brightness(1.25) drop-shadow(0 0 20px #f97316ff); }
                }
                @keyframes nodeGlowCyan {
                  from { filter: brightness(1.05) drop-shadow(0 0 5px #22d3eeaa); }
                  to   { filter: brightness(1.25) drop-shadow(0 0 20px #22d3eeff); }
                }
                @keyframes nodeGlowPurple {
                  from { filter: brightness(1.05) drop-shadow(0 0 5px #c026d3aa); }
                  to   { filter: brightness(1.25) drop-shadow(0 0 20px #c026d3ff); }
                }
                @keyframes nodeGlow {
                  from { filter: brightness(1.05) drop-shadow(0 0 5px #f97316aa); }
                  to   { filter: brightness(1.25) drop-shadow(0 0 20px #f97316ff); }
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
