'use client';

import { useEffect, useState } from 'react';
import {
  getImageJudgeConfig,
  getLLMProviders,
  updateImageJudgeConfig,
  type FlowDefinition,
  type ImageJudgeSkillConfig,
  type LLMProviderConfig,
} from '../../services/aiOrchestrator.service';
import { ModelSelector } from './ModelSelector';

const COLOR = '#f97316'; // orange — action layer

const labelStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 9,
  color: `${COLOR}aa`,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 4,
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  background: '#120010',
  color: '#ffffff',
  border: `1px solid ${COLOR}44`,
  borderRadius: 6,
  fontFamily: 'monospace',
  fontSize: 10,
  padding: '6px 10px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: `${COLOR}09`, border: `1px solid ${COLOR}20`, borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
      <div style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: COLOR, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

interface Props {
  baseUrl: string;
  definition: FlowDefinition;
  conversationId?: string | null;
  onBack: () => void;
}

export function ImageJudgeSubFlow({ baseUrl, onBack }: Props) {
  const [skill, setSkill] = useState<ImageJudgeSkillConfig | null>(null);
  const [providers, setProviders] = useState<LLMProviderConfig[]>([]);
  const [draft, setDraft] = useState<Partial<ImageJudgeSkillConfig>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getImageJudgeConfig(baseUrl).then((s) => {
      setSkill(s);
      setDraft({ provider: s.provider, model: s.model, temperature: s.temperature });
    }).catch(() => {});
    getLLMProviders(baseUrl).then((r) => setProviders(r.providers)).catch(() => {});
  }, [baseUrl]);

  const currentProvider = draft.provider ?? skill?.provider ?? 'ollama';
  const providerCfg = providers.find((p) => p.id === currentProvider);
  const isLocal = providerCfg?.kind === 'local';

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateImageJudgeConfig(baseUrl, draft);
      setSkill(result.skill);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0f', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${COLOR}22`, flexShrink: 0, background: '#0a0a14' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onBack}
            style={{ fontFamily: 'monospace', fontSize: 10, background: 'none', border: `1px solid ${COLOR}33`, color: `${COLOR}aa`, borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
          >
            ← Voltar
          </button>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: COLOR, letterSpacing: '0.12em', fontWeight: 700 }}>
            ◈ AI JUDGE — Revisão Visual Pós-Geração
          </span>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff33' }}>
          Stage: <span style={{ color: `${COLOR}aa` }}>image_judge</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Left: config panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <Section title="O que é o AI Judge?">
            <p style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff77', lineHeight: 1.75, margin: 0 }}>
              Após cada imagem gerada, o AI Judge usa um modelo de visão (ex: <span style={{ color: COLOR }}>llama3.2-vision:11b</span>) para avaliar se a imagem está de acordo com o brief do cliente.
              Se reprovar, devolve um <span style={{ color: '#22d3ee' }}>revised_prompt</span> e a geração é repetida automaticamente (até {skill?.enabledEnvFlag ? '2' : '1'} tentativas).
            </p>
            <p style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff44', lineHeight: 1.75, margin: '6px 0 0' }}>
              Se o campo <span style={{ color: COLOR }}>model</span> estiver vazio, o Judge fica <strong>desabilitado</strong> e a geração ocorre em tentativa única sem revisão.
            </p>
          </Section>

          {/* Provider */}
          <Section title="Provider">
            <label style={labelStyle}>Provider LLM</label>
            <select
              style={inputStyle}
              value={currentProvider}
              onChange={(e) => setDraft((d) => ({ ...d, provider: e.target.value, model: '' }))}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.label} ({p.kind})</option>
              ))}
            </select>
            <p style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff44', marginTop: 6 }}>
              {isLocal ? '🖥 Local — usa VRAM da GPU. Precisa de um modelo com suporte a visão.' : '☁️ Cloud — sem VRAM. Requer chave de API configurada no .env.'}
            </p>
          </Section>

          {/* Model */}
          <Section title="Modelo de Visão">
            <label style={labelStyle}>Modelo (vision-capable)</label>
            <ModelSelector
              baseUrl={baseUrl}
              provider={currentProvider}
              value={draft.model ?? skill?.model ?? ''}
              onChange={(m) => setDraft((d) => ({ ...d, model: m }))}
              color={COLOR}
              visionOnly={isLocal}
            />
            {isLocal && (
              <p style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff44', marginTop: 6 }}>
                Apenas modelos com capacidade de visão são listados: <span style={{ color: COLOR }}>llama3.2-vision:11b</span>, <span style={{ color: COLOR }}>llava:13b</span>, <span style={{ color: COLOR }}>moondream2</span>.
              </p>
            )}
            <p style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff33', marginTop: 4 }}>
              Deixe vazio para desabilitar o Judge (geração sem revisão automática).
            </p>
          </Section>

          {/* Temperature */}
          <Section title="Parâmetros">
            <label style={labelStyle}>Temperatura</label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              style={inputStyle}
              value={draft.temperature ?? skill?.temperature ?? 0.2}
              onChange={(e) => setDraft((d) => ({ ...d, temperature: Number(e.target.value) }))}
            />
            <p style={{ fontFamily: 'monospace', fontSize: 9, color: '#ffffff44', marginTop: 4 }}>
              Recomendado: 0.1–0.2 para avaliação determinística.
            </p>
          </Section>

          {/* Save */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              style={{
                fontFamily: 'monospace', fontSize: 11, cursor: saving ? 'not-allowed' : 'pointer',
                background: saving ? `${COLOR}22` : `${COLOR}28`, border: `1px solid ${COLOR}44`,
                color: saving ? `${COLOR}66` : COLOR, borderRadius: 8, padding: '7px 20px',
                transition: 'all 0.15s',
              }}
            >
              {saving ? '⟳ Salvando…' : saved ? '✓ Salvo!' : '💾 Salvar no flow.json'}
            </button>
            {error && <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#ef4444' }}>{error}</span>}
            {saved && <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#22c55e' }}>Configuração persistida ✓</span>}
          </div>
        </div>

        {/* Right: current effective config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Section title="Config atual (flow.json)">
            {skill ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  ['provider', skill.provider],
                  ['model', skill.model || '—'],
                  ['temperature', skill.temperature],
                  ['executionMode', skill.executionMode],
                  ['requiresLock', skill.requiresLock],
                  ['requiresVision', skill.requiresVision],
                ].filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => (
                  <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 10, borderBottom: '1px solid #ffffff08', paddingBottom: 5 }}>
                    <span style={{ color: '#ffffff55' }}>{String(k)}</span>
                    <span style={{ color: COLOR }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontFamily: 'monospace', fontSize: 10, color: '#ffffff33' }}>Carregando…</p>
            )}
          </Section>

          <Section title="Status de Saúde">
            <div style={{ fontFamily: 'monospace', fontSize: 10 }}>
              {skill?.model ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22c55e' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }} />
                  Judge ativo: <span style={{ color: COLOR }}>{skill.model}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ffffff44' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#444', display: 'inline-block' }} />
                  Judge desabilitado (nenhum modelo)
                </div>
              )}
            </div>
          </Section>

          <Section title="Fluxo de revisão">
            {[
              ['🎨', COLOR, 'Image Gen', 'Imagem gerada pelo ComfyUI ou fal.ai'],
              ['👁', COLOR, 'AI Judge', 'Modelo de visão avalia contra o brief'],
              ['✓ aprovado', '#22c55e', 'Aprovado', 'Imagem enviada ao cliente'],
              ['✗ reprovado', '#ef4444', 'retry prompt', 'revised_prompt + nova tentativa (max 2x)'],
            ].map(([icon, color, label, note]) => (
              <div key={String(label)} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0', borderBottom: '1px solid #ffffff0a' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: String(color), flexShrink: 0, width: 70 }}>{String(icon)}</span>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: String(color) }}>{String(label)}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#ffffff44', marginTop: 2 }}>{String(note)}</div>
                </div>
              </div>
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}
