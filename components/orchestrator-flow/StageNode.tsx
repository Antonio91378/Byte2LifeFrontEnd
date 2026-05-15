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
import type { FlowStage } from '../../services/aiOrchestrator.service';

export type StageStatus = 'idle' | 'active' | 'completed' | 'failed';

export interface StageNodeData {
  stage: FlowStage;
  status: StageStatus;
  lastEventName?: string;
  isDecision?: boolean;
  selected?: boolean;
  hasSubFlow?: boolean;
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

export function StageNode({ data }: { data: StageNodeData }) {
  const { stage, status, lastEventName, selected, hasSubFlow } = data;
  const colors = LAYER_COLORS[stage.layer] ?? LAYER_COLORS.core;

  const isActive = status === 'active';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';

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
      }}
    >
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
      </div>

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
