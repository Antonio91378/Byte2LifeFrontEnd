'use client';

import { useEffect, useRef, useState } from 'react';
import type { StageEvent } from '../../services/aiOrchestrator.service';

// ─── Event metadata ───────────────────────────────────────────────────────────

type Severity = 'error' | 'warn' | 'info';

interface EventMeta {
  color: string;
  icon: string;
  severity?: Severity;
}

const EVENT_META: Record<string, EventMeta> = {
  'stage.started':            { color: '#c026d3', icon: '▶' },
  'stage.completed':          { color: '#22c55e', icon: '✓' },
  'stage.failed':             { color: '#ef4444', icon: '✗', severity: 'error' },
  'llm.called':               { color: '#22d3ee', icon: '⟳' },
  'llm.parsed':               { color: '#22d3ee', icon: '◉' },
  'llm.parse_failed':         { color: '#f97316', icon: '⚡', severity: 'error' },
  'llm.fallback_used':        { color: '#f97316', icon: '↩', severity: 'warn' },
  'image.gen_started':        { color: '#f97316', icon: '◈' },
  'image.gen_completed':      { color: '#22c55e', icon: '◈' },
  'image.gen_failed':         { color: '#ef4444', icon: '◈', severity: 'error' },
  'image.gen_blocked':        { color: '#f59e0b', icon: '⊘', severity: 'warn' },
  'image.dispatcher_selected':{ color: '#f97316', icon: '→' },
  'resource.lock_acquired':   { color: '#ff6666', icon: '🔒' },
  'resource.lock_released':   { color: '#ff6666', icon: '🔓' },
  'policy.decided':           { color: '#a78bfa', icon: '⚖' },
  'state.transitioned':       { color: '#34d399', icon: '⇢' },
  'sale.created':             { color: '#fbbf24', icon: '💰' },
};

function getEventMeta(name: string): EventMeta {
  if (EVENT_META[name]) return EVENT_META[name];
  const prefix = name.split('.')[0] + '.';
  const match = Object.entries(EVENT_META).find(([k]) => k.startsWith(prefix));
  return match ? match[1] : { color: '#666688', icon: '●' };
}

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour12: false });
}

function summarize(name: string, p: Record<string, unknown>): string | null {
  if (p.stageId)          return String(p.stageId);
  if (p.reason && name === 'image.gen_blocked') return `bloqueado: ${String(p.reason)}`;
  if (p.reason)           return String(p.reason).slice(0, 72);
  if (p.error)            return String(p.error).slice(0, 72);
  if (p.intent)           return `intent: ${p.intent}`;
  if (p.branch)           return `→ ${p.branch}`;
  if (p.fallbackProvider) return `fallback → ${p.fallbackProvider}`;
  if (p.provider)         return String(p.provider);
  if (p.url)              return 'url gerada';
  return null;
}

function PayloadTable({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {Object.entries(payload).map(([k, v]) => {
        const valStr = v === null || v === undefined
          ? '—'
          : typeof v === 'object'
            ? JSON.stringify(v)
            : String(v);
        return (
          <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <code style={{ fontFamily: 'monospace', fontSize: 8, color: '#c026d377', flexShrink: 0, minWidth: 110 }}>
              {k}
            </code>
            <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff66', wordBreak: 'break-all', lineHeight: 1.55 }}>
              {valStr}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EventLogProps {
  events: StageEvent[];
  onClear?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EventLog({ events, onClear }: EventLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  function toggleExpand(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function copyLog() {
    const text = events
      .map((e) => `[${formatTs(e.ts)}] ${e.eventName}  ${JSON.stringify(e.payload)}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  const errorCount = events.filter((e) => getEventMeta(e.eventName).severity === 'error').length;
  const warnCount  = events.filter((e) => getEventMeta(e.eventName).severity === 'warn').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', background: '#07070f', borderLeft: '1px solid #c026d322' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '9px 12px', borderBottom: '1px solid #c026d322',
        flexShrink: 0, background: '#0a0014',
      }}>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#c026d3', letterSpacing: '0.08em', fontWeight: 700 }}>
          ◈ EVENT LOG
        </span>

        {/* counts */}
        {events.length > 0 && (
          <span style={{
            fontFamily: 'monospace', fontSize: 8, color: '#c026d399',
            background: '#c026d318', border: '1px solid #c026d333',
            borderRadius: 10, padding: '1px 6px', marginLeft: 2,
          }}>
            {events.length}
          </span>
        )}
        {errorCount > 0 && (
          <span style={{
            fontFamily: 'monospace', fontSize: 8, color: '#ef444499',
            background: '#ef444418', border: '1px solid #ef444433',
            borderRadius: 10, padding: '1px 6px',
          }}>
            {errorCount} err
          </span>
        )}
        {warnCount > 0 && (
          <span style={{
            fontFamily: 'monospace', fontSize: 8, color: '#f9731699',
            background: '#f9731618', border: '1px solid #f9731633',
            borderRadius: 10, padding: '1px 6px',
          }}>
            {warnCount} warn
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* copy button */}
        {events.length > 0 && (
          <button
            onClick={copyLog}
            title="Copiar log completo como texto"
            style={{
              background: copied ? '#00330018' : '#ffffff09',
              border: `1px solid ${copied ? '#22c55e55' : '#ffffff22'}`,
              color: copied ? '#22c55e' : '#ffffff55',
              fontSize: 9, borderRadius: 4, padding: '3px 8px',
              cursor: 'pointer', fontFamily: 'monospace', flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            {copied ? '✓ copiado' : '⎘ copiar'}
          </button>
        )}

        {/* clear button */}
        {onClear && events.length > 0 && (
          <button
            onClick={onClear}
            style={{
              background: 'none', border: '1px solid #ffffff18',
              color: '#ffffff33', fontSize: 9, borderRadius: 4,
              padding: '3px 8px', cursor: 'pointer', fontFamily: 'monospace', flexShrink: 0,
            }}
          >
            limpar
          </button>
        )}
      </div>

      {/* ── Event list ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '4px 0' }}>

        {events.length === 0 && (
          <div style={{
            padding: '28px 14px', fontFamily: 'monospace', fontSize: 10,
            color: '#ffffff1a', textAlign: 'center', lineHeight: 1.9,
          }}>
            Selecione uma conversa<br />para ver os eventos ao vivo
          </div>
        )}

        {events.map((evt, i) => {
          const meta     = getEventMeta(evt.eventName);
          const payload  = evt.payload ?? {};
          const summary  = summarize(evt.eventName, payload);
          const isOpen   = expanded.has(i);
          const isError  = meta.severity === 'error';
          const isWarn   = meta.severity === 'warn';
          const hasPload = Object.keys(payload).length > 0;

          return (
            <div
              key={i}
              onClick={() => hasPload && toggleExpand(i)}
              style={{
                borderBottom: '1px solid #ffffff06',
                cursor: hasPload ? 'pointer' : 'default',
                borderLeft: isError
                  ? '3px solid #ef444466'
                  : isWarn
                    ? '3px solid #f9731655'
                    : '3px solid transparent',
                background: isOpen
                  ? (isError ? '#180006' : isWarn ? '#120b00' : '#0d0d1c')
                  : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (!isOpen && hasPload) {
                  (e.currentTarget as HTMLElement).style.background = isError
                    ? '#180006' : isWarn ? '#120b00' : '#0d0d1c';
                }
              }}
              onMouseLeave={(e) => {
                if (!isOpen) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {/* ── Row ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff2a', flexShrink: 0, width: 52 }}>
                  {formatTs(evt.ts)}
                </span>
                <span style={{ fontSize: 9, color: meta.color, flexShrink: 0, width: 14, textAlign: 'center' }}>
                  {meta.icon}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 9, color: meta.color, fontWeight: 600, flexShrink: 0 }}>
                  {evt.eventName}
                </span>
                {summary && (
                  <span style={{
                    fontFamily: 'monospace', fontSize: 8, flex: 1,
                    color: isError ? '#ef444477' : isWarn ? '#f9731677' : '#ffffff33',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {summary}
                  </span>
                )}
                {hasPload && (
                  <span style={{
                    fontSize: 7, color: '#ffffff1a', flexShrink: 0, marginLeft: 'auto',
                    display: 'inline-block',
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.15s',
                  }}>
                    ▶
                  </span>
                )}
              </div>

              {/* ── Expanded payload ── */}
              {isOpen && hasPload && (
                <div style={{
                  padding: '8px 12px 12px 34px',
                  background: isError ? '#120004' : isWarn ? '#0e0800' : '#0a0a18',
                  borderTop: `1px solid ${isError ? '#ef444422' : isWarn ? '#f9731622' : '#ffffff0d'}`,
                }}>

                  {/* Fallback callout card */}
                  {(isError || isWarn) && !!(payload.reason ?? payload.detail ?? payload.fallback ?? payload.fallbackProvider) && (
                    <div style={{
                      background: isError ? '#250008' : '#1e0f00',
                      border: `1px solid ${isError ? '#ef444433' : '#f9731633'}`,
                      borderRadius: 7,
                      padding: '9px 11px',
                      marginBottom: 10,
                    }}>
                      <div style={{
                        fontFamily: 'monospace', fontSize: 9, fontWeight: 700,
                        color: isError ? '#ef4444' : '#f97316',
                        letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6,
                      }}>
                        {isError ? '✗ Falha detectada' : '↩ Fallback acionado'}
                      </div>

                      {!!payload.reason && (
                        <div style={{ fontFamily: 'monospace', fontSize: 9, color: isError ? '#ef444499' : '#f9731699', lineHeight: 1.65, marginBottom: 4 }}>
                          <span style={{ color: isError ? '#ef4444cc' : '#f97316cc', fontWeight: 700 }}>Motivo: </span>
                          {String(payload.reason)}
                        </div>
                      )}

                      {!!payload.detail && (
                        <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff33', lineHeight: 1.65, marginBottom: 4 }}>
                          {String(payload.detail)}
                        </div>
                      )}

                      {!!(payload.fallback ?? payload.fallbackProvider) && (
                        <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff44', lineHeight: 1.65 }}>
                          <span style={{ color: '#22d3ee88' }}>Fallback usado: </span>
                          {String(payload.fallback ?? payload.fallbackProvider)}
                        </div>
                      )}

                      {!!payload.primaryProvider && (
                        <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff33', lineHeight: 1.65, marginTop: 2 }}>
                          <span style={{ color: '#22d3ee66' }}>Primário: </span>
                          {String(payload.primaryProvider)}
                          {!!payload.fallbackProvider && (
                            <>
                              <span style={{ color: '#ffffff22' }}> → </span>
                              <span style={{ color: '#22d3ee88' }}>{String(payload.fallbackProvider)}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Raw payload table */}
                  <PayloadTable payload={payload} />
                </div>
              )}
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
