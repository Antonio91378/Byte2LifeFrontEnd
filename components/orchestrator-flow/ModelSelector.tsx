'use client';

import { useEffect, useState } from 'react';
import { getProviderModels } from '../../services/aiOrchestrator.service';

const baseInputStyle: React.CSSProperties = {
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

interface ModelSelectorProps {
  baseUrl: string;
  provider: string;
  value: string;
  onChange: (model: string) => void;
  color: string;
  /** When true, only vision-capable models are shown (llava, llama3.2-vision, etc.) */
  visionOnly?: boolean;
}

export function ModelSelector({ baseUrl, provider, value, onChange, color, visionOnly }: ModelSelectorProps) {
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (!provider) return;
    setLoadingModels(true);
    getProviderModels(baseUrl, provider, { visionOnly: visionOnly ?? false })
      .then(({ models: m }) => setModels(m))
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false));
  }, [baseUrl, provider, visionOnly]);

  if (loadingModels) {
    return (
      <div style={{ ...baseInputStyle, borderColor: `${color}33`, display: 'flex', alignItems: 'center', gap: 6, color: `${color}55`, opacity: 0.8 }}>
        <span style={{ fontSize: 10 }}>⟳</span>
        <span style={{ fontSize: 9 }}>Carregando modelos…</span>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <select
          disabled
          style={{ ...baseInputStyle, borderColor: '#f9731644', cursor: 'not-allowed', opacity: 0.6, color: '#f97316aa' }}
        >
          <option>⚠ Nenhum modelo configurado</option>
        </select>
        <div style={{
          background: '#1a0a00',
          border: '1px solid #f9731633',
          borderRadius: 6,
          padding: '8px 10px',
          fontFamily: 'monospace',
          fontSize: 8,
          color: '#f97316aa',
          lineHeight: 1.7,
        }}>
          Para adicionar modelos, edite{' '}
          <code style={{ color: '#f97316' }}>config/orchestrator.flow.json</code>
          {' → '}
          <code style={{ color: '#f97316' }}>llmProviders.{provider}.models[]</code>.
          {' '}
          Para Ollama, os modelos são lidos dinamicamente — garanta que o Ollama está rodando e os modelos estão instalados (
          <code style={{ color: '#22d3ee' }}>ollama pull llama3.1:8b</code>
          ).
        </div>
      </div>
    );
  }

  const currentNotInList = value && !models.includes(value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <select
        style={{ ...baseInputStyle, borderColor: `${color}44`, cursor: 'pointer' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {!value && <option value="">— selecionar modelo —</option>}
        {currentNotInList && <option value={value}>⚠ {value} (não encontrado)</option>}
        {models.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      {currentNotInList && (
        <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#f97316aa', lineHeight: 1.5 }}>
          ⚠ O modelo <code style={{ color: '#f97316' }}>{value}</code> não está na lista.
          Verifique se está instalado ou atualize o config.
        </div>
      )}
    </div>
  );
}
