"use client";

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
    Pencil,
    Save,
    ScanEye,
    ScanLine,
    Send,
    ShieldCheck,
    X,
    Zap,
} from "lucide-react";
import { useState } from "react";
import type {
    FlowDefinition,
    FlowStage,
    LLMProviderConfig,
    LLMSkillConfig,
} from "../../services/aiOrchestrator.service";
import {
    updateSkillProvider,
    updateStageTimeout,
} from "../../services/aiOrchestrator.service";
import { ModelSelector } from "./ModelSelector";

const ICON_MAP: Record<
  string,
  React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }>
> = {
  inbox: Inbox,
  "list-ordered": ListOrdered,
  database: Database,
  "brain-circuit": BrainCircuit,
  "shield-check": ShieldCheck,
  "git-merge": GitMerge,
  "git-fork": GitFork,
  "scan-line": ScanLine,
  image: Image,
  "scan-eye": ScanEye,
  "check-circle-2": CheckCircle2,
  "message-circle": MessageCircle,
  send: Send,
};

const LAYER_COLORS: Record<
  string,
  { border: string; bg: string; text: string }
> = {
  input: { border: "#22d3ee", bg: "#0a3a4a", text: "#e0fbff" },
  core: { border: "#c026d3", bg: "#2a0a3a", text: "#fce7ff" },
  action: { border: "#f97316", bg: "#3a1a00", text: "#fff3e0" },
  output: { border: "#ec4899", bg: "#3a002a", text: "#ffe0f0" },
};

const LAYER_LABELS: Record<string, string> = {
  input: "Entrada",
  core: "Pipeline principal",
  action: "Ação",
  output: "Saída",
};

const EXEC_MODE_LABELS: Record<string, { label: string; color: string }> = {
  local: { label: "🔒 Local (GPU)", color: "#ff7070" },
  local_cpu: { label: "⚙️ Local (CPU)", color: "#facc15" },
  cloud: { label: "☁️ Cloud (paralelo)", color: "#22d3ee" },
  depends_on_provider: { label: "🔀 Depende do provider", color: "#a78bfa" },
};

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontFamily: "monospace",
        fontSize: 9,
        background: `${color}1a`,
        color,
        borderRadius: 4,
        padding: "2px 6px",
        border: `1px solid ${color}44`,
        display: "inline-block",
      }}
    >
      {label}
    </span>
  );
}

/** Renders the `docs` field: ## headers, - bullets, `inline code`, fenced code blocks */
function DocsRenderer({
  text,
  borderColor,
}: {
  text: string;
  borderColor: string;
}) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  function renderInline(raw: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const regex = /`([^`]+)`/g;
    let last = 0,
      m: RegExpExecArray | null;
    while ((m = regex.exec(raw)) !== null) {
      if (m.index > last) parts.push(raw.slice(last, m.index));
      parts.push(
        <span
          key={m.index}
          style={{
            fontFamily: "monospace",
            background: "#ffffff14",
            color: "#22d3ee",
            borderRadius: 3,
            padding: "0 4px",
            fontSize: "0.95em",
          }}
        >
          {m[1]}
        </span>,
      );
      last = m.index + m[0].length;
    }
    if (last < raw.length) parts.push(raw.slice(last));
    return parts;
  }

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <div
          key={i}
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            color: borderColor,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 700,
            marginTop: 14,
            marginBottom: 5,
            borderBottom: `1px solid ${borderColor}33`,
            paddingBottom: 3,
          }}
        >
          {line.slice(3)}
        </div>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div
          key={i}
          style={{
            display: "flex",
            gap: 7,
            marginBottom: 3,
            alignItems: "flex-start",
          }}
        >
          <span style={{ color: borderColor, flexShrink: 0, marginTop: 1 }}>
            ·
          </span>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              color: "#ffffffaa",
              lineHeight: 1.6,
            }}
          >
            {renderInline(line.slice(2))}
          </span>
        </div>,
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} style={{ height: 6 }} />);
    } else {
      elements.push(
        <div
          key={i}
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: "#ffffffaa",
            lineHeight: 1.65,
            marginBottom: 2,
          }}
        >
          {renderInline(line)}
        </div>,
      );
    }
    i++;
  }

  return <div style={{ paddingTop: 4 }}>{elements}</div>;
}

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 9,
          color,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 700,
          marginBottom: 7,
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <span
          style={{
            width: 14,
            height: 1,
            background: color,
            display: "inline-block",
            opacity: 0.6,
          }}
        />
        {title}
      </div>
      {children}
    </div>
  );
}

interface StageInspectorProps {
  stage: FlowStage;
  definition: FlowDefinition;
  providers?: LLMProviderConfig[];
  baseUrl?: string;
  onClose: () => void;
  onSkillUpdated?: (skillName: string, config: LLMSkillConfig) => void;
  onStageTimeoutUpdated?: (stageId: string, timeoutMs: number) => void;
}

export function StageInspector({
  stage,
  definition,
  providers,
  baseUrl,
  onClose,
  onSkillUpdated,
  onStageTimeoutUpdated,
}: StageInspectorProps) {
  const colors = LAYER_COLORS[stage.layer] ?? LAYER_COLORS.core;
  const Icon = ICON_MAP[stage.icon] ?? Inbox;

  const [editingLLM, setEditingLLM] = useState(false);
  const [editProvider, setEditProvider] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editFallbackProvider, setEditFallbackProvider] = useState("");
  const [editFallbackModel, setEditFallbackModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [editingTimeout, setEditingTimeout] = useState(false);
  const [timeoutInput, setTimeoutInput] = useState<number | string>("");
  const [savingTimeout, setSavingTimeout] = useState(false);

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
  const execMode: string =
    (skillConfig?.executionMode as string) ??
    (stage.requiresLock ? "local" : "local_cpu");
  const execModeInfo = EXEC_MODE_LABELS[execMode] ?? {
    label: execMode,
    color: "#888888",
  };

  async function handleSaveProvider() {
    if (!skillKey || !baseUrl) return;
    setSaving(true);
    try {
      const fallback = editFallbackProvider
        ? {
            provider: editFallbackProvider,
            model: editFallbackModel || undefined,
          }
        : undefined;
      await updateSkillProvider(baseUrl, skillKey, {
        provider: editProvider || undefined,
        model: editModel || undefined,
        fallback,
      });
      onSkillUpdated?.(skillKey, {
        provider: editProvider,
        model: editModel,
      } as LLMSkillConfig);
      setEditingLLM(false);
    } catch {
      // show inline error
    } finally {
      setSaving(false);
    }
  }

  const hasTimeout =
    stage.timeoutMs !== undefined ||
    !!stage.requiresLock ||
    stage.id === "queue";

  async function handleSaveTimeout() {
    if (!baseUrl) return;
    const ms = Number(timeoutInput);
    if (isNaN(ms) || ms < 1000) return;
    setSavingTimeout(true);
    try {
      await updateStageTimeout(baseUrl, stage.id, ms);
      onStageTimeoutUpdated?.(stage.id, ms);
      setEditingTimeout(false);
    } catch {
      /* ignore */
    } finally {
      setSavingTimeout(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#0a0a14",
        borderLeft: `1px solid ${colors.border}44`,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${colors.border}33`,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          flexShrink: 0,
          background: `${colors.bg}cc`,
        }}
      >
        <div
          style={{
            padding: 8,
            borderRadius: 8,
            background: `${colors.border}22`,
            border: `1px solid ${colors.border}44`,
            flexShrink: 0,
          }}
        >
          <Icon size={16} style={{ color: colors.border, display: "block" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 12,
              color: colors.text,
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {stage.label}
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 9,
              color: `${colors.border}bb`,
              marginTop: 2,
            }}
          >
            {LAYER_LABELS[stage.layer]} · {stage.id}
          </div>
        </div>
        {/* Zoom controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))}
            title="Diminuir zoom"
            style={{
              background: "#ffffff0d",
              border: "1px solid #ffffff1a",
              color: "#ffffff55",
              fontFamily: "monospace",
              fontSize: 13,
              width: 20,
              height: 20,
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              lineHeight: 1,
            }}
          >
            −
          </button>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 8,
              color: "#ffffff33",
              minWidth: 26,
              textAlign: "center",
            }}
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))}
            title="Aumentar zoom"
            style={{
              background: "#ffffff0d",
              border: "1px solid #ffffff1a",
              color: "#ffffff55",
              fontFamily: "monospace",
              fontSize: 13,
              width: 20,
              height: 20,
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              lineHeight: 1,
            }}
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "1px solid #ffffff22",
            color: "#ffffff55",
            borderRadius: 6,
            width: 22,
            height: 22,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <X size={11} />
        </button>
      </div>

      {/* Body — scrollable */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ zoom, padding: "14px 14px" }}>
          {/* Description — collapsible, with rich docs when expanded */}
          {stage.description && (
            <Section title="O que faz" color={colors.border}>
              <p
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: "#ffffffaa",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {descExpanded ||
                (stage.description.length <= 120 && !stage.docs)
                  ? stage.description
                  : `${stage.description.slice(0, 120)}…`}
              </p>
              {descExpanded && stage.docs && (
                <div
                  style={{
                    marginTop: 12,
                    borderTop: `1px solid ${colors.border}22`,
                    paddingTop: 4,
                  }}
                >
                  <DocsRenderer text={stage.docs} borderColor={colors.border} />
                </div>
              )}
              {(stage.description.length > 120 || stage.docs) && (
                <button
                  type="button"
                  onClick={() => setDescExpanded((v) => !v)}
                  style={{
                    fontFamily: "monospace",
                    fontSize: 8,
                    color: `${colors.border}99`,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "6px 0 0",
                    letterSpacing: "0.05em",
                  }}
                >
                  {descExpanded ? "▴ Menos" : "▾ Ver documentação técnica"}
                </button>
              )}
            </Section>
          )}

          {/* Execution mode */}
          <Section title="Execução" color={execModeInfo.color}>
            <Tag label={execModeInfo.label} color={execModeInfo.color} />
          </Section>

          {/* Receives from (predecessors) */}
          {predecessors.length > 0 && (
            <Section title="Recebe de" color="#6366f1">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {predecessors.map((p) => (
                  <div
                    key={p.id}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: LAYER_COLORS[p.layer]?.border ?? "#888",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 10,
                        color: "#ffffff88",
                      }}
                    >
                      {p.label}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Next stages */}
          {(stage.next ?? []).length > 0 && (
            <Section title="Passa para" color="#34d399">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {(stage.next ?? []).map((nextId) => {
                  const nextStage = (definition.stages ?? []).find(
                    (s) => s.id === nextId,
                  );
                  return (
                    <div
                      key={nextId}
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: nextStage
                            ? (LAYER_COLORS[nextStage.layer]?.border ?? "#888")
                            : "#888",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 10,
                          color: "#ffffff88",
                        }}
                      >
                        {nextStage?.label ?? nextId}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Branches */}
          {(stage.branches ?? []).length > 0 && (
            <Section title="Decisões" color="#f97316">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(stage.branches ?? []).map((branch) => (
                  <div
                    key={branch.id}
                    style={{
                      padding: "6px 10px",
                      border: "1px solid #f9731644",
                      borderRadius: 6,
                      background: "#f9731611",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: 10,
                        color: "#f97316",
                        fontWeight: 600,
                        marginBottom: 2,
                      }}
                    >
                      {branch.label}
                    </div>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: 9,
                        color: "#ffffff55",
                      }}
                    >
                      → {branch.next?.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Per-stage Timeout */}
          {hasTimeout && (
            <Section title="Timeout" color="#f97316">
              <div
                style={{
                  padding: "8px 10px",
                  border: "1px solid #f9731644",
                  borderRadius: 6,
                  background: "#f9731611",
                }}
              >
                {!editingTimeout ? (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 14,
                        fontWeight: 800,
                        color: "#ffffff",
                      }}
                    >
                      {stage.timeoutMs
                        ? (stage.timeoutMs / 1000).toFixed(0)
                        : "—"}
                    </span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 10,
                        color: "#ffffff55",
                      }}
                    >
                      s
                    </span>
                    {stage.timeoutMs && (
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 8,
                          color: "#f9731688",
                          marginLeft: 2,
                        }}
                      >
                        {stage.id === "queue"
                          ? "fila de mensagens"
                          : "GPU lock"}
                      </span>
                    )}
                    {baseUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setTimeoutInput(stage.timeoutMs ?? 90000);
                          setEditingTimeout(true);
                        }}
                        style={{
                          marginLeft: "auto",
                          background: "none",
                          border: "1px solid #f9731644",
                          borderRadius: 4,
                          color: "#f9731688",
                          cursor: "pointer",
                          padding: "1px 6px",
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                          fontFamily: "monospace",
                          fontSize: 9,
                        }}
                      >
                        <Pencil size={8} /> editar
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <div>
                      <label
                        style={{
                          fontFamily: "monospace",
                          fontSize: 8,
                          color: "#f97316aa",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          marginBottom: 4,
                          display: "block",
                        }}
                      >
                        Timeout em milissegundos
                      </label>
                      <input
                        type="number"
                        min={1000}
                        step={1000}
                        value={timeoutInput}
                        onChange={(e) =>
                          setTimeoutInput(Number(e.target.value))
                        }
                        style={{
                          fontFamily: "monospace",
                          fontSize: 11,
                          background: "#1a0a00",
                          color: "#ffffff",
                          border: "1px solid #f9731444",
                          borderRadius: 4,
                          padding: "5px 8px",
                          width: "100%",
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: 8,
                          color: "#ffffff33",
                          marginTop: 4,
                        }}
                      >
                        ≈{" "}
                        {Number(timeoutInput)
                          ? (Number(timeoutInput) / 1000).toFixed(0)
                          : "?"}
                        s · mín: 1s
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={handleSaveTimeout}
                        disabled={savingTimeout}
                        style={{
                          fontFamily: "monospace",
                          fontSize: 9,
                          background: savingTimeout ? "#f9731633" : "#f9731622",
                          color: "#f97316",
                          border: "1px solid #f9731655",
                          borderRadius: 4,
                          padding: "4px 10px",
                          cursor: savingTimeout ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Save size={8} />{" "}
                        {savingTimeout ? "Salvando…" : "Salvar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTimeout(false)}
                        style={{
                          fontFamily: "monospace",
                          fontSize: 9,
                          background: "none",
                          color: "#ffffff44",
                          border: "1px solid #ffffff22",
                          borderRadius: 4,
                          padding: "4px 10px",
                          cursor: "pointer",
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Skill / LLM + editor */}
          {skillConfig &&
            (() => {
              const isVision = !!(skillConfig as unknown as LLMSkillConfig)
                .requiresVision;
              const fallback = skillConfig.fallback as
                | { provider: string; model?: string }
                | undefined;

              const inputSt: React.CSSProperties = {
                fontFamily: "monospace",
                fontSize: 10,
                background: "#120020",
                color: "#ffffff",
                border: "1px solid #a78bfa44",
                borderRadius: 4,
                padding: "4px 7px",
                width: "100%",
                boxSizing: "border-box",
                outline: "none",
              };
              const labelSt: React.CSSProperties = {
                fontFamily: "monospace",
                fontSize: 8,
                color: "#a78bfaaa",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 3,
                display: "block",
              };

              return (
                <Section title="Skill / LLM" color="#a78bfa">
                  <div
                    style={{
                      padding: "8px 10px",
                      border: "1px solid #a78bfa44",
                      borderRadius: 6,
                      background: "#a78bfa11",
                    }}
                  >
                    {!editingLLM ? (
                      <>
                        {!!skillConfig.model && (
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              marginBottom: 4,
                              alignItems: "center",
                            }}
                          >
                            <BrainCircuit
                              size={10}
                              style={{ color: "#a78bfa", flexShrink: 0 }}
                            />
                            {isVision && (
                              <span style={{ fontSize: 10 }}>👁</span>
                            )}
                            <span
                              style={{
                                fontFamily: "monospace",
                                fontSize: 10,
                                color: "#a78bfacc",
                                flex: 1,
                              }}
                            >
                              {String(skillConfig.provider)} /{" "}
                              {String(skillConfig.model)}
                            </span>
                            {baseUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditProvider(String(skillConfig.provider));
                                  setEditModel(String(skillConfig.model ?? ""));
                                  setEditFallbackProvider(
                                    fallback?.provider ?? "",
                                  );
                                  setEditFallbackModel(fallback?.model ?? "");
                                  setEditingLLM(true);
                                }}
                                style={{
                                  background: "none",
                                  border: "1px solid #a78bfa44",
                                  borderRadius: 4,
                                  color: "#a78bfa88",
                                  cursor: "pointer",
                                  padding: "1px 4px",
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <Pencil size={8} />
                              </button>
                            )}
                          </div>
                        )}
                        {skillConfig.temperature !== undefined && (
                          <div
                            style={{
                              fontFamily: "monospace",
                              fontSize: 9,
                              color: "#ffffff55",
                            }}
                          >
                            temp: {String(skillConfig.temperature)} · maxTokens:{" "}
                            {String(skillConfig.maxTokens ?? "—")}
                          </div>
                        )}
                        {fallback?.model && (
                          <div
                            style={{
                              fontFamily: "monospace",
                              fontSize: 9,
                              color: "#22d3ee88",
                              marginTop: 4,
                            }}
                          >
                            fallback → {fallback.provider} / {fallback.model}
                          </div>
                        )}
                      </>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {/* Provider */}
                        <div>
                          <label style={labelSt}>Provider</label>
                          <select
                            value={editProvider}
                            onChange={(e) => {
                              setEditProvider(e.target.value);
                              setEditModel("");
                            }}
                            style={{ ...inputSt, cursor: "pointer" }}
                          >
                            <option value="ollama">
                              ollama (local — GPU lock)
                            </option>
                            {(providers ?? [])
                              .filter((p) => p.kind === "cloud")
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.label ?? p.id} (cloud)
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Model — vision-only selector for vision skills */}
                        <div>
                          <label style={labelSt}>
                            {isVision ? "Modelo vision 👁" : "Modelo"}
                          </label>
                          {baseUrl && isVision ? (
                            <ModelSelector
                              baseUrl={baseUrl}
                              provider={editProvider}
                              value={editModel}
                              onChange={setEditModel}
                              color="#a78bfa"
                              visionOnly
                            />
                          ) : (
                            <input
                              value={editModel}
                              onChange={(e) => setEditModel(e.target.value)}
                              placeholder="ex: claude-haiku-4-5"
                              style={inputSt}
                            />
                          )}
                          {isVision && (
                            <div
                              style={{
                                fontFamily: "monospace",
                                fontSize: 8,
                                color: "#ffffff33",
                                marginTop: 3,
                                lineHeight: 1.5,
                              }}
                            >
                              Apenas modelos multimodais. Para Ollama:{" "}
                              <code style={{ color: "#a78bfa" }}>
                                ollama pull llava:13b
                              </code>
                            </div>
                          )}
                        </div>

                        {/* Fallback */}
                        <div>
                          <label style={labelSt}>Fallback provider</label>
                          <select
                            value={editFallbackProvider}
                            onChange={(e) => {
                              setEditFallbackProvider(e.target.value);
                              setEditFallbackModel("");
                            }}
                            style={{
                              ...inputSt,
                              cursor: "pointer",
                              marginBottom: 5,
                            }}
                          >
                            <option value="">— sem fallback —</option>
                            <option value="ollama">ollama (local)</option>
                            {(providers ?? [])
                              .filter((p) => p.kind === "cloud")
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.label ?? p.id} (cloud)
                                </option>
                              ))}
                          </select>
                          {editFallbackProvider && (
                            <>
                              <label style={{ ...labelSt, marginTop: 3 }}>
                                Fallback modelo
                              </label>
                              {baseUrl && isVision && editFallbackProvider ? (
                                <ModelSelector
                                  baseUrl={baseUrl}
                                  provider={editFallbackProvider}
                                  value={editFallbackModel}
                                  onChange={setEditFallbackModel}
                                  color="#22d3ee"
                                  visionOnly
                                />
                              ) : (
                                <input
                                  value={editFallbackModel}
                                  onChange={(e) =>
                                    setEditFallbackModel(e.target.value)
                                  }
                                  placeholder="ex: claude-sonnet-4-6"
                                  style={{
                                    ...inputSt,
                                    borderColor: "#22d3ee44",
                                  }}
                                />
                              )}
                            </>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            onClick={handleSaveProvider}
                            disabled={saving}
                            style={{
                              fontFamily: "monospace",
                              fontSize: 9,
                              background: saving ? "#a78bfa33" : "#a78bfa22",
                              color: "#a78bfa",
                              border: "1px solid #a78bfa55",
                              borderRadius: 4,
                              padding: "4px 10px",
                              cursor: saving ? "not-allowed" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Save size={8} /> {saving ? "Salvando…" : "Salvar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingLLM(false)}
                            style={{
                              fontFamily: "monospace",
                              fontSize: 9,
                              background: "none",
                              color: "#ffffff44",
                              border: "1px solid #ffffff22",
                              borderRadius: 4,
                              padding: "4px 10px",
                              cursor: "pointer",
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              );
            })()}

          {/* Image Generation — providers managed via sub-flow (click image_gen node in canvas) */}
          {skillKey === "image_generation" && (
            <Section title="Providers de Imagem" color="#f97316">
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 9,
                  color: "#f97316aa",
                  lineHeight: 1.7,
                }}
              >
                Clique no node{" "}
                <span style={{ color: "#f97316", fontWeight: 700 }}>
                  Image Generation
                </span>{" "}
                no canvas para abrir o sub-fluxo interativo de workflows.
              </div>
            </Section>
          )}

          {/* Events emitted */}
          {(stage.events ?? []).length > 0 && (
            <Section title="Eventos emitidos" color="#fbbf24">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {(stage.events ?? []).map((ev) => (
                  <div
                    key={ev}
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <Zap size={8} style={{ color: "#fbbf24" }} />
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 9,
                        color: "#fbbf24bb",
                      }}
                    >
                      {ev}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Implementation path */}
          {stage.implementationPath && (
            <Section title="Implementação" color="#ffffff44">
              <p
                style={{
                  fontFamily: "monospace",
                  fontSize: 9,
                  color: "#ffffff44",
                  margin: 0,
                  wordBreak: "break-all",
                  lineHeight: 1.5,
                }}
              >
                {stage.implementationPath}
              </p>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
