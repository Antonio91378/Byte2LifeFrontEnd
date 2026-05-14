'use client';

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
  ScanEye,
  ScanLine,
  Send,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import type { FlowDefinition, FlowStage } from '../../services/aiOrchestrator.service';

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
  send: Send,
};

const LAYER_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  input:  { border: '#22d3ee', bg: '#0a3a4a', text: '#e0fbff' },
  core:   { border: '#c026d3', bg: '#2a0a3a', text: '#fce7ff' },
  action: { border: '#f97316', bg: '#3a1a00', text: '#fff3e0' },
  output: { border: '#ec4899', bg: '#3a002a', text: '#ffe0f0' },
};

const LAYER_LABELS: Record<string, string> = {
  input: 'Entrada',
  core: 'Pipeline principal',
  action: 'Ação',
  output: 'Saída',
};

const EXEC_MODE_LABELS: Record<string, { label: string; color: string }> = {
  local:     { label: '🔒 Local (GPU)', color: '#ff7070' },
  local_cpu: { label: '⚙️ Local (CPU)', color: '#facc15' },
  cloud:     { label: '☁️ Cloud (paralelo)', color: '#22d3ee' },
  'depends_on_provider': { label: '🔀 Depende do provider', color: '#a78bfa' },
};

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontFamily: 'monospace',
      fontSize: 9,
      background: `${color}1a`,
      color,
      borderRadius: 4,
      padding: '2px 6px',
      border: `1px solid ${color}44`,
      display: 'inline-block',
    }}>
      {label}
    </span>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: 'monospace', fontSize: 9, color, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 14, height: 1, background: color, display: 'inline-block', opacity: 0.6 }} />
        {title}
      </div>
      {children}
    </div>
  );
}

interface StageInspectorProps {
  stage: FlowStage;
  definition: FlowDefinition;
  onClose: () => void;
}

export function StageInspector({ stage, definition, onClose }: StageInspectorProps) {
  const colors = LAYER_COLORS[stage.layer] ?? LAYER_COLORS.core;
  const Icon = ICON_MAP[stage.icon] ?? Inbox;

  // Compute predecessor stages (stages that have this stage in their `next`)
  const predecessors = (definition.stages ?? []).filter(
    (s) =>
      (s.next ?? []).includes(stage.id) ||
      (s.branches ?? []).some((b) => (b.next ?? []).includes(stage.id)),
  );

  // Skill config
  const skillKey = stage.skill;
  const skillConfig = skillKey
    ? (definition.skills as Record<string, Record<string, unknown>>)[skillKey]
    : null;

  // Exec mode from skill or stage
  const execMode: string = (skillConfig?.executionMode as string) ?? (stage.requiresLock ? 'local' : 'local_cpu');
  const execModeInfo = EXEC_MODE_LABELS[execMode] ?? { label: execMode, color: '#888888' };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0a0a14',
      borderLeft: `1px solid ${colors.border}44`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: `1px solid ${colors.border}33`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        flexShrink: 0,
        background: `${colors.bg}cc`,
      }}>
        <div style={{
          padding: 8,
          borderRadius: 8,
          background: `${colors.border}22`,
          border: `1px solid ${colors.border}44`,
          flexShrink: 0,
        }}>
          <Icon size={16} style={{ color: colors.border, display: 'block' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: colors.text, fontWeight: 700, letterSpacing: '0.04em' }}>
            {stage.label}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: `${colors.border}bb`, marginTop: 2 }}>
            {LAYER_LABELS[stage.layer]} · {stage.id}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: '1px solid #ffffff22', color: '#ffffff55', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <X size={11} />
        </button>
      </div>

      {/* Body — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>

        {/* Description */}
        {stage.description && (
          <Section title="O que faz" color={colors.border}>
            <p style={{ fontFamily: 'monospace', fontSize: 10, color: '#ffffffaa', lineHeight: 1.6, margin: 0 }}>
              {stage.description}
            </p>
          </Section>
        )}

        {/* Execution mode */}
        <Section title="Execução" color={execModeInfo.color}>
          <Tag label={execModeInfo.label} color={execModeInfo.color} />
        </Section>

        {/* Receives from (predecessors) */}
        {predecessors.length > 0 && (
          <Section title="Recebe de" color="#6366f1">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {predecessors.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: LAYER_COLORS[p.layer]?.border ?? '#888', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#ffffff88' }}>{p.label}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Next stages */}
        {(stage.next ?? []).length > 0 && (
          <Section title="Passa para" color="#34d399">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(stage.next ?? []).map((nextId) => {
                const nextStage = (definition.stages ?? []).find((s) => s.id === nextId);
                return (
                  <div key={nextId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: nextStage ? (LAYER_COLORS[nextStage.layer]?.border ?? '#888') : '#888', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#ffffff88' }}>{nextStage?.label ?? nextId}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Branches */}
        {(stage.branches ?? []).length > 0 && (
          <Section title="Decisões" color="#f97316">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(stage.branches ?? []).map((branch) => (
                <div key={branch.id} style={{ padding: '6px 10px', border: '1px solid #f9731644', borderRadius: 6, background: '#f9731611' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#f97316', fontWeight: 600, marginBottom: 2 }}>{branch.label}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff55' }}>→ {branch.next?.join(', ')}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Skill */}
        {skillConfig && (
          <Section title="Skill / LLM" color="#a78bfa">
            <div style={{ padding: '8px 10px', border: '1px solid #a78bfa44', borderRadius: 6, background: '#a78bfa11' }}>
              {!!skillConfig.model && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <BrainCircuit size={10} style={{ color: '#a78bfa', marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#a78bfacc' }}>
                    {String(skillConfig.provider)} / {String(skillConfig.model)}
                  </span>
                </div>
              )}
              {skillConfig.temperature !== undefined && (
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff55' }}>
                  temp: {String(skillConfig.temperature)} · maxTokens: {String(skillConfig.maxTokens ?? '—')}
                </div>
              )}
              {(skillConfig.fallback as Record<string,string> | undefined)?.model && (
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#22d3ee88', marginTop: 4 }}>
                  fallback → {String((skillConfig.fallback as Record<string,string>).provider)} / {String((skillConfig.fallback as Record<string,string>).model)}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Events emitted */}
        {(stage.events ?? []).length > 0 && (
          <Section title="Eventos emitidos" color="#fbbf24">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(stage.events ?? []).map((ev) => (
                <div key={ev} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Zap size={8} style={{ color: '#fbbf24' }} />
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#fbbf24bb' }}>{ev}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Implementation path */}
        {stage.implementationPath && (
          <Section title="Implementação" color="#ffffff44">
            <p style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff44', margin: 0, wordBreak: 'break-all', lineHeight: 1.5 }}>
              {stage.implementationPath}
            </p>
          </Section>
        )}

      </div>
    </div>
  );
}
