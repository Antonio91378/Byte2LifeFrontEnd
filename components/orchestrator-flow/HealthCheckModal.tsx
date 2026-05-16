'use client';

import { useEffect, useState } from 'react';
import {
  getProviderHealth,
  type FullProviderHealth,
} from '../../services/aiOrchestrator.service';

interface Props {
  baseUrl: string;
  onClose: () => void;
}

interface Issue {
  id: string;
  label: string;
  category: 'llm' | 'image' | 'router' | 'skill';
  reason: string;
}

function collectIssues(health: FullProviderHealth): Issue[] {
  const issues: Issue[] = [];

  for (const [id, r] of Object.entries(health.providers ?? {})) {
    if (!r.ok) {
      issues.push({ id, label: id, category: 'llm', reason: r.reason ?? 'Problema desconhecido' });
    }
  }

  for (const [id, r] of Object.entries(health.imageProviders ?? {})) {
    if (!r.ok && r.enabled) {
      issues.push({ id, label: r.label ?? id, category: 'image', reason: r.reason ?? 'Problema desconhecido' });
    }
  }

  if (health.router && !health.router.ok) {
    issues.push({
      id: 'image_router',
      label: 'LLM Router (Image)',
      category: 'router',
      reason: health.router.reason ?? 'Modelo não configurado',
    });
  }

  for (const [id, r] of Object.entries(health.skills ?? {})) {
    if (!r.ok) {
      issues.push({ id, label: r.label ?? id, category: 'skill', reason: r.reason ?? 'Modelo não configurado' });
    }
  }

  return issues;
}

const CATEGORY_COLOR: Record<string, string> = {
  llm: '#c026d3',
  image: '#f97316',
  router: '#22d3ee',
  skill: '#ec4899',
};

const CATEGORY_LABEL: Record<string, string> = {
  llm: 'LLM Provider',
  image: 'Image Provider',
  router: 'Router',
  skill: 'Stage',
};

export function HealthCheckModal({ baseUrl, onClose }: Props) {
  const [health, setHealth] = useState<FullProviderHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getProviderHealth(baseUrl)
      .then(setHealth)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [baseUrl]);

  const issues = health ? collectIssues(health) : [];
  const allOk = !loading && !error && issues.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)',
      }}
    >
      <div style={{
        background: '#0d0d1a',
        border: '1px solid #c026d344',
        borderRadius: 12,
        width: 560,
        maxWidth: '96vw',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 0 40px #c026d322',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid #c026d322',
          background: '#0a0a14',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, color: '#c026d3', fontFamily: 'monospace', fontWeight: 700 }}>
              ◈ HEALTH CHECK — Pipeline
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: '1px solid #ffffff22', color: '#ffffff55', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#c026d3aa', textAlign: 'center', margin: '24px 0' }}>
              Verificando providers…
            </p>
          )}

          {error && (
            <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#ef4444', textAlign: 'center', margin: '24px 0' }}>
              Erro ao verificar: {error}
            </p>
          )}

          {allOk && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, margin: '24px 0' }}>
              <span style={{ fontSize: 32 }}>✅</span>
              <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#22c55e', fontWeight: 700 }}>
                Tudo configurado!
              </p>
              <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#ffffff66', textAlign: 'center' }}>
                Nenhuma credencial faltando. O pipeline pode rodar sem erros de configuração.
              </p>
            </div>
          )}

          {!loading && !error && issues.length > 0 && (
            <>
              <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#ffffff66', marginBottom: 14 }}>
                {issues.length === 1 ? '1 problema encontrado' : `${issues.length} problemas encontrados`} — configure as variáveis no <code style={{ color: '#f97316' }}>.env</code> antes de rodar.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {issues.map((issue) => (
                  <div key={issue.id} style={{
                    borderRadius: 8,
                    border: `1px solid ${CATEGORY_COLOR[issue.category]}44`,
                    padding: '10px 14px',
                    background: `${CATEGORY_COLOR[issue.category]}0a`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: CATEGORY_COLOR[issue.category] }}>
                        {issue.label}
                      </span>
                      <span style={{
                        fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.08em',
                        color: CATEGORY_COLOR[issue.category], background: `${CATEGORY_COLOR[issue.category]}22`,
                        borderRadius: 4, padding: '2px 6px',
                      }}>
                        {CATEGORY_LABEL[issue.category]}
                      </span>
                    </div>
                    <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#ffffffaa', margin: 0 }}>
                      {issue.reason}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Skills overview (always show if loaded) */}
          {health && (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#ffffff55', letterSpacing: '0.08em' }}>STAGES CONFIGURADOS</span>

              {/* LLM Router */}
              {health.router && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: '#ffffff08', border: '1px solid #ffffff11', fontFamily: 'monospace', fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#22d3eeaa' }}>LLM Router (imagem)</span>
                    {health.router.ok
                      ? <span style={{ color: '#22c55e', fontSize: 9 }}>✓ {health.router.model} <span style={{ color: '#ffffff33' }}>via {health.router.source === 'flow_json' ? 'Studio' : 'env'}</span></span>
                      : <span style={{ color: '#f97316', fontSize: 9 }}>⚠ determinístico</span>
                    }
                  </div>
                </div>
              )}

              {/* Skill statuses */}
              {Object.entries(health.skills ?? {}).map(([id, s]) => (
                <div key={id} style={{ padding: '8px 12px', borderRadius: 8, background: '#ffffff08', border: '1px solid #ffffff11', fontFamily: 'monospace', fontSize: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#ec4899aa' }}>{s.label}</span>
                    {s.ok
                      ? <span style={{ color: '#22c55e', fontSize: 9 }}>✓ {s.model} <span style={{ color: '#ffffff33' }}>via {s.source === 'flow_json' ? 'Studio' : 'env'}</span></span>
                      : <span style={{ color: '#ef4444', fontSize: 9 }}>✗ {s.reason}</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid #c026d322', background: '#0a0a14', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#ffffff33' }}>
            As credenciais ficam APENAS no .env — nunca no Studio.
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontFamily: 'monospace', fontSize: 11, cursor: 'pointer',
              background: '#c026d322', border: '1px solid #c026d344',
              color: '#c026d3', borderRadius: 6, padding: '4px 14px',
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small badge for Studio header ────────────────────────────────────────────

interface HealthBadgeProps {
  baseUrl: string;
  onClick: () => void;
}

export function HealthBadge({ baseUrl, onClick }: HealthBadgeProps) {
  const [issues, setIssues] = useState<number | null>(null);

  useEffect(() => {
    getProviderHealth(baseUrl)
      .then((h) => setIssues(collectIssues(h).length))
      .catch(() => setIssues(null));
  }, [baseUrl]);

  if (issues === null) return null;

  const ok = issues === 0;
  const color = ok ? '#22c55e' : '#f97316';
  const label = ok ? '✓ Configurado' : `⚠ ${issues} ${issues === 1 ? 'problema' : 'problemas'}`;

  return (
    <button
      type="button"
      onClick={onClick}
      title="Verificar saúde dos providers"
      style={{
        fontFamily: 'monospace', fontSize: 10, cursor: 'pointer',
        background: `${color}14`, border: `1px solid ${color}44`,
        color, borderRadius: 6, padding: '3px 10px',
        display: 'flex', alignItems: 'center', gap: 5,
        boxShadow: ok ? 'none' : `0 0 8px ${color}44`,
        animation: ok ? 'none' : 'neon-pulse 2s ease-in-out infinite',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', boxShadow: `0 0 4px ${color}` }} />
      {label}
    </button>
  );
}
