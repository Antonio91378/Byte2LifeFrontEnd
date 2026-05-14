'use client';

import { useEffect, useRef } from 'react';
import type { StageEvent } from '../../services/aiOrchestrator.service';

const EVENT_COLORS: Record<string, string> = {
  'stage.': '#c026d3',
  'llm.': '#22d3ee',
  'image.': '#f97316',
  'resource.': '#ff6666',
  'policy.': '#a78bfa',
  'state.': '#34d399',
  'sale.': '#fbbf24',
};

function getEventColor(eventName: string): string {
  for (const [prefix, color] of Object.entries(EVENT_COLORS)) {
    if (eventName.startsWith(prefix)) return color;
  }
  return '#888888';
}

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour12: false });
}

interface EventLogProps {
  events: StageEvent[];
  onClear?: () => void;
}

export function EventLog({ events, onClear }: EventLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a14', borderLeft: '1px solid #c026d322' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid #c026d322',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#c026d3', letterSpacing: '0.08em', fontWeight: 700 }}>
          ◈ EVENT LOG
        </span>
        {onClear && (
          <button
            onClick={onClear}
            style={{ background: 'none', border: '1px solid #ffffff22', color: '#ffffff55', fontSize: 10, borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'monospace' }}
          >
            clear
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {events.length === 0 && (
          <div style={{ padding: '20px 14px', fontFamily: 'monospace', fontSize: 11, color: '#ffffff33', textAlign: 'center' }}>
            Selecione uma conversa<br />para ver os eventos ao vivo
          </div>
        )}
        {events.map((evt, i) => {
          const color = getEventColor(evt.eventName);
          const payload = evt.payload ?? {};
          const detail = payload.stageId
            ? String(payload.stageId)
            : payload.intent
              ? `intent: ${payload.intent}`
              : payload.branch
                ? `→ ${payload.branch}`
                : payload.error
                  ? String(payload.error).slice(0, 30)
                  : null;

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 8,
                padding: '4px 14px',
                alignItems: 'baseline',
                borderBottom: '1px solid #ffffff08',
              }}
            >
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff44', flexShrink: 0 }}>
                {formatTs(evt.ts)}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color, fontWeight: 600, flexShrink: 0 }}>
                {evt.eventName}
              </span>
              {detail && (
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#ffffff66', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {detail}
                </span>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
