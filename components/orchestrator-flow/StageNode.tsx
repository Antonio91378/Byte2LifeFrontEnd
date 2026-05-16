'use client';

import { Handle, Position } from '@xyflow/react';
import {
  BrainCircuit,
  CheckCircle2,
  Database,
  GitFork,
  GitMerge,
  Image,
  Inbox,
  ListOrdered,
  MessageCircle,
  Package,
  ScanEye,
  ScanLine,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { FlowStage } from '../../services/aiOrchestrator.service';

export type StageStatus = 'idle' | 'active' | 'completed' | 'failed';

export interface StageNodeData {
  stage: FlowStage;
  status: StageStatus;
  lastEventName?: string;
  isDecision?: boolean;
  selected?: boolean;
  hasSubFlow?: boolean;
  /** Duration in ms from stage.started → stage.completed/failed (undefined = not yet started) */
  durationMs?: number;
  /** Configured timeout for this stage in ms (from orchestrator.flow.json / ResourceManager) */
  timeoutMs?: number;
}

const LAYER_COLORS: Record<string, { border: string; glow: string; bg: string; text: string }> = {
  input:  { border: '#22d3ee', glow: '0 0 12px #22d3ee88', bg: '#0a3a4a', text: '#e0fbff' },
  core:   { border: '#c026d3', glow: '0 0 12px #c026d388', bg: '#2a0a3a', text: '#fce7ff' },
  action: { border: '#f97316', glow: '0 0 12px #f9731688', bg: '#3a1a00', text: '#fff3e0' },
  output: { border: '#ec4899', glow: '0 0 12px #ec489988', bg: '#3a002a', text: '#ffe0f0' },
};

const ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }>> = {
  inbox: Inbox,
  'list-ordered': ListOrdered,
  database: Database,
  'brain-circuit': BrainCircuit,
  'shield-check': ShieldCheck,
  'git-merge': GitMerge,
  'git-fork': GitFork,
  'scan-line': ScanLine,
  image: Image,
  'scan-eye': ScanEye,
  'check-circle-2': CheckCircle2,
  'message-circle': MessageCircle,
  package: Package,
  send: Send,
};

function getTimingColor(durationMs: number, timeoutMs?: number): string {
  if (timeoutMs === undefined) return '#22d3ee'; // no limit → cyan (informational)
  const ratio = durationMs / timeoutMs;
  if (ratio >= 0.9) return '#ef4444'; // red: at/over limit
  if (ratio >= 0.6) return '#f97316'; // orange: slow
  if (ratio >= 0.3) return '#fbbf24'; // yellow: moderate
  return '#22c55e';                    // green: fast
}

interface TimingBarProps {
  durationMs: number;
  timeoutMs: number;
}

function TimingBar({ durationMs, timeoutMs }: TimingBarProps) {
  const pct = Math.min((durationMs / timeoutMs) * 100, 100);
  const color = getTimingColor(durationMs, timeoutMs);
  return (
    <div style={{ marginTop: 6, marginBottom: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 7.5, color: '#ffffff33', marginBottom: 3 }}>
        <span>0s</span>
        <span>{(timeoutMs / 1000).toFixed(0)}s limite</span>
      </div>
      <div style={{ background: '#ffffff11', borderRadius: 3, height: 5, width: '100%', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 3,
          boxShadow: `0 0 6px ${color}`,
          transition: 'width 0.3s',
        }} />
      </div>
    </div>
  );
}

export function StageNode({ data }: { data: StageNodeData }) {
  const { stage, status, lastEventName, selected, hasSubFlow, durationMs, timeoutMs } = data;
  const [hovered, setHovered] = useState(true);
  const [timingDismissed, setTimingDismissed] = useState(false);
  const colors = LAYER_COLORS[stage.layer] ?? LAYER_COLORS.core;

  const isActive = status === 'active';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const hasTiming = durationMs !== undefined && status !== 'idle';

  const borderColor = isFailed ? '#ef4444' : isCompleted ? '#22c55e' : isActive ? colors.border : `${colors.border}55`;
  const boxShadow = isFailed
    ? '0 0 14px #ef444488'
    : isActive
      ? colors.glow
      : isCompleted
        ? '0 0 8px #22c55e44'
        : 'none';
  const selectedRing = selected ? `0 0 0 2px #ffffff, 0 0 0 4px ${colors.border}` : '';

  const Icon = ICON_MAP[stage.icon] ?? Inbox;

  // Timing tooltip derived values
  const durationSec = hasTiming ? (durationMs! / 1000).toFixed(1) : null;
  const isTimedOut = isFailed && timeoutMs !== undefined && durationMs !== undefined && durationMs >= timeoutMs * 0.85;
  const tColor = isActive
    ? '#c026d3'
    : hasTiming
      ? getTimingColor(durationMs!, timeoutMs)
      : '#ffffff44';

  return (
    <div
      style={{
        background: colors.bg,
        border: `1.5px solid ${selected ? colors.border : borderColor}`,
        boxShadow: [boxShadow, selectedRing].filter(Boolean).join(', '),
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 130,
        maxWidth: 170,
        fontFamily: 'monospace',
        transition: 'border-color 0.3s, box-shadow 0.3s',
        animation: isActive ? 'neon-pulse 1s ease-in-out infinite' : 'none',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'visible',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Timing Tooltip (shown on hover) ── */}
      {hovered && hasTiming && timingDismissed && !isActive && (
        <div
          style={{
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
            boxShadow: `0 6px 28px ${tColor}33, 0 0 0 1px #ffffff08`,
            minWidth: 160,
          }}
        >
          {/* Header */}
          <div style={{
            fontFamily: 'monospace',
            fontSize: 8,
            color: tColor,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 7,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}>
            <span style={{ fontSize: 11 }}>
              {isTimedOut ? '⏰' : isActive ? '⏳' : isFailed ? '✗' : '⏱'}
            </span>
            {stage.label}
          </div>

          {/* Duration value */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 3 }}>
            <span style={{
              fontFamily: 'monospace',
              fontSize: 22,
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}>
              {durationSec}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#ffffff88', fontWeight: 700 }}>s</span>
            {isActive && (
              <span style={{ fontFamily: 'monospace', fontSize: 8, color: tColor, marginLeft: 2 }}>
                e contando…
              </span>
            )}
          </div>

          {/* Progress bar vs timeout */}
          {timeoutMs !== undefined && !isActive && (
            <TimingBar durationMs={durationMs!} timeoutMs={timeoutMs} />
          )}

          {/* Timeout reference text */}
          {timeoutMs !== undefined && (
            <div style={{
              fontFamily: 'monospace',
              fontSize: 8,
              color: '#ffffff33',
              marginTop: timeoutMs !== undefined && !isActive ? 5 : 2,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
            }}>
              <span>
                limite: <span style={{ color: '#ffffff55' }}>{(timeoutMs / 1000).toFixed(0)}s</span>
              </span>
              {!isActive && (
                <span style={{ color: tColor }}>
                  {(((durationMs! / timeoutMs) * 100)).toFixed(0)}% usado
                </span>
              )}
            </div>
          )}

          {/* Timeout warning */}
          {isTimedOut && (
            <div style={{
              fontFamily: 'monospace',
              fontSize: 8,
              color: '#ef4444cc',
              marginTop: 7,
              borderTop: '1px solid #ef444422',
              paddingTop: 6,
              lineHeight: 1.6,
            }}>
              ⚠ Stage falhou perto do limite de tempo.<br />
              Considere trocar o LLM desta etapa.
            </div>
          )}

          {/* Normal failed (not timeout) */}
          {isFailed && !isTimedOut && (
            <div style={{
              fontFamily: 'monospace',
              fontSize: 8,
              color: '#ef4444aa',
              marginTop: 5,
              borderTop: '1px solid #ef444422',
              paddingTop: 5,
            }}>
              Stage falhou nesta execução.
            </div>
          )}
        </div>
      )}

      <Handle type="target" position={Position.Left} style={{ background: borderColor, borderColor }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <Icon size={14} style={{ color: borderColor, flexShrink: 0 }} />
        <span style={{ color: colors.text, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1.3, wordBreak: 'break-word' }}>
          {stage.label}
        </span>
        {isFailed && <XCircle size={12} style={{ color: '#ef4444', marginLeft: 'auto', flexShrink: 0 }} />}
        {isCompleted && <CheckCircle2 size={12} style={{ color: '#22c55e', marginLeft: 'auto', flexShrink: 0 }} />}
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
        <span style={{
          fontSize: 9,
          background: `${borderColor}22`,
          color: borderColor,
          borderRadius: 4,
          padding: '1px 5px',
          letterSpacing: '0.03em',
          border: `1px solid ${borderColor}44`,
        }}>
          {stage.layer}
        </span>
        {Boolean(stage.requiresLock) && (
          <span style={{
            fontSize: 9,
            background: '#ff336622',
            color: '#ff7070',
            borderRadius: 4,
            padding: '1px 5px',
            border: '1px solid #ff336644',
          }}>🔒 local</span>
        )}
        {/* Compact timing badge — only shown in dismissed (hover) mode */}
        {hasTiming && !isActive && timingDismissed && (
          <span style={{
            fontSize: 9,
            background: `${tColor}18`,
            color: tColor,
            borderRadius: 4,
            padding: '1px 5px',
            border: `1px solid ${tColor}33`,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}>
            ⏱ {durationSec}s
          </span>
        )}
      </div>

      {/* ── Inline timing panel (default visible, × to dismiss) ── */}
      {hasTiming && !timingDismissed && (
        <div style={{
          marginTop: 7,
          padding: '5px 7px',
          background: `${tColor}0d`,
          border: `1px solid ${tColor}22`,
          borderRadius: 6,
          position: 'relative',
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); setTimingDismissed(true); }}
            style={{ position: 'absolute', top: 1, right: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff33', fontSize: 12, padding: 0, lineHeight: 1, fontFamily: 'monospace' }}
            title="Ocultar"
          >×</button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: timeoutMs ? 4 : 0 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 8, color: tColor }}>{isActive ? '⏳' : '⏱'}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.02em' }}>{durationSec}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff55' }}>s</span>
            {isActive && <span style={{ fontFamily: 'monospace', fontSize: 7, color: tColor, marginLeft: 2 }}>contando…</span>}
          </div>
          {timeoutMs !== undefined && (
            <>
              <div style={{ background: '#ffffff11', borderRadius: 2, height: 3, width: '100%', overflow: 'hidden', marginBottom: 2 }}>
                <div style={{ width: `${Math.min((durationMs! / timeoutMs) * 100, 100)}%`, height: '100%', background: tColor, borderRadius: 2, boxShadow: `0 0 4px ${tColor}` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 7.5, color: '#ffffff2a' }}>
                <span>lim: {(timeoutMs / 1000).toFixed(0)}s</span>
                <span style={{ color: tColor }}>{Math.min((durationMs! / timeoutMs) * 100, 100).toFixed(0)}%</span>
              </div>
            </>
          )}
          {isTimedOut && (
            <div style={{ fontFamily: 'monospace', fontSize: 7.5, color: '#ef4444aa', marginTop: 4 }}>⚠ provável timeout</div>
          )}
        </div>
      )}

      {lastEventName && isActive && (
        <div style={{ fontSize: 9, color: '#ffffff66', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lastEventName}
        </div>
      )}

      {hasSubFlow && (
        <div style={{ fontSize: 8, color: `${colors.border}88`, marginTop: 4, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 7 }}>◈</span> ver sub-fluxo
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: borderColor, borderColor }} />
    </div>
  );
}
