"use client";

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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AnimatePresence, motion } from "framer-motion";
import { ToggleLeft, ToggleRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useResizablePanel } from "../../hooks/useResizablePanel";
import {
    addImageCategoryProvider,
    deleteImageCategoryProvider,
    getCustomWorkflows,
    getImageGenConfig,
    getVisionDescriptorConfig,
    scanCustomWorkflows,
    setImageCategoryFallback,
    subscribeToFlowEvents,
    updateCustomWorkflow,
    updateImageCategoryProvider,
    updateImageRouterConfig,
    updateVisionDescriptorConfig,
    type CustomWorkflowsState,
    type DiscoveredWorkflow,
    type FlowDefinition,
    type ImageCategoryConfig,
    type ImageCategoryProvider,
    type ImageRouterConfig,
    type StageEvent,
    type VisionDescriptorSkillConfig,
} from "../../services/aiOrchestrator.service";
import { ModelSelector } from "./ModelSelector";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageGenSubFlowProps {
  baseUrl: string;
  definition: FlowDefinition;
  onBack: () => void;
  conversationId?: string | null;
}

type NodeStatus = "idle" | "active" | "completed" | "failed";

interface AddNodeData extends Record<string, unknown> {
  onAdd: () => void;
}

interface CategoryBranchNodeData extends Record<string, unknown> {
  categoryKey: string;
  label: string;
  providerCount: number;
  status?: NodeStatus;
  durationMs?: number;
  limitMs?: number;
}

interface LLMRouterNodeData extends Record<string, unknown> {
  model: string;
  provider: string;
  onOpenPanel: () => void;
  status?: NodeStatus;
  durationMs?: number;
  limitMs?: number;
}

interface VisionDescriptorNodeData extends Record<string, unknown> {
  enabled: boolean;
  provider: string;
  model: string;
  fallbackProvider: string;
  fallbackModel: string;
  timeoutMs: number;
  onOpenPanel: () => void;
  status?: NodeStatus;
  durationMs?: number;
  limitMs?: number;
}

interface VisionFallbackNodeData extends Record<string, unknown> {
  provider: string;
  model: string;
  onOpenPanel: () => void;
  status?: NodeStatus;
}

interface CategoryFallbackNodeData extends Record<string, unknown> {
  categoryKey: string;
  fallback: ImageCategoryProvider | null;
  onEdit: () => void;
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
  provider: ImageCategoryProvider;
  categoryKey: string;
  onToggle: (category: string, name: string, enabled: boolean) => void;
  onEdit: (category: string, name: string) => void;
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

function fmtSec(ms: number) {
  return (ms / 1000).toFixed(1);
}

function getTimingColor(ms: number, limitMs?: number): string {
  if (!limitMs) return "#22d3ee";
  const r = ms / limitMs;
  if (r >= 0.9) return "#ef4444";
  if (r >= 0.6) return "#f97316";
  if (r >= 0.3) return "#fbbf24";
  return "#22c55e";
}

/** Compact timing badge — shown inside node when status is completed/failed */
function TimingBadge({
  durationMs,
  limitMs,
  accentColor,
}: {
  durationMs: number;
  limitMs?: number;
  accentColor?: string;
}) {
  const color = accentColor ?? getTimingColor(durationMs, limitMs);
  return (
    <div
      style={{
        fontFamily: "monospace",
        fontSize: 8,
        fontWeight: 700,
        color,
        background: `${color}15`,
        border: `1px solid ${color}33`,
        borderRadius: 4,
        padding: "2px 6px",
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        marginTop: 4,
      }}
    >
      ⏱ {fmtSec(durationMs)}s
    </div>
  );
}

/** Full timing tooltip rendered inside a positioned parent (parent must have position:relative, overflow:visible) */
function TimingTooltip({
  label,
  durationMs,
  limitMs,
  color,
  isActive = false,
}: {
  label: string;
  durationMs: number;
  limitMs?: number;
  color: string;
  isActive?: boolean;
}) {
  const tColor = isActive ? color : getTimingColor(durationMs, limitMs);
  const pct = limitMs ? Math.min((durationMs / limitMs) * 100, 100) : null;
  const isTimeout =
    !isActive && limitMs !== undefined && durationMs >= limitMs * 0.85;
  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 12px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#060010",
        border: `1.5px solid ${tColor}88`,
        borderRadius: 9,
        padding: "10px 14px",
        zIndex: 9999,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        boxShadow: `0 6px 28px ${tColor}33`,
        minWidth: 155,
      }}
    >
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 8,
          color: tColor,
          fontWeight: 700,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span style={{ fontSize: 11 }}>
          {isTimeout ? "⏰" : isActive ? "⏳" : "⏱"}
        </span>
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 4,
          marginBottom: 3,
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 22,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          {fmtSec(durationMs)}
        </span>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            color: "#fff8",
            fontWeight: 700,
          }}
        >
          s
        </span>
        {isActive && (
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 8,
              color: tColor,
              marginLeft: 2,
            }}
          >
            e contando…
          </span>
        )}
      </div>
      {pct !== null && !isActive && (
        <>
          <div style={{ marginTop: 4, marginBottom: 3 }}>
            <div
              style={{
                background: "#fff1",
                borderRadius: 3,
                height: 5,
                width: "100%",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: tColor,
                  borderRadius: 3,
                  boxShadow: `0 0 6px ${tColor}`,
                }}
              />
            </div>
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 8,
              color: "#fff3",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>
              limite:{" "}
              <span style={{ color: "#fff5" }}>
                {(limitMs! / 1000).toFixed(0)}s
              </span>
            </span>
            <span style={{ color: tColor }}>{pct.toFixed(0)}% usado</span>
          </div>
        </>
      )}
      {isTimeout && (
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 8,
            color: "#ef4444cc",
            marginTop: 6,
            borderTop: "1px solid #ef444422",
            paddingTop: 5,
            lineHeight: 1.6,
          }}
        >
          ⚠ Provável timeout.
          <br />
          Considere trocar o LLM.
        </div>
      )}
    </div>
  );
}

// ─── Label styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 9,
  color: "#f97316aa",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 4,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  background: "#1a0a00",
  color: "#ffffff",
  border: "1px solid #f9731444",
  borderRadius: 6,
  fontFamily: "monospace",
  fontSize: 10,
  padding: "6px 10px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

// ─── WorkflowProviderNode (custom ReactFlow node) ─────────────────────────────

function WorkflowProviderNode({ data }: NodeProps) {
  const {
    provider,
    categoryKey,
    onToggle,
    onEdit,
    status = "idle",
    isActiveProvider = false,
    lastExecution,
    durationMs,
    limitMs = 90_000,
  } = data as WorkflowNodeData;
  const [showTooltip, setShowTooltip] = useState(false);
  const [timingDismissed, setTimingDismissed] = useState(false);

  const isEnabled = provider.enabled !== false;
  const isCloud = provider.executionMode === "cloud";
  const accentColor = isEnabled ? (isCloud ? "#22d3ee" : "#f97316") : "#666666";
  // Pulse only while actively generating; steady glow once selected/completed
  const isAnimated = status === "active";
  const glowShadow =
    isActiveProvider && status === "completed"
      ? `0 0 14px ${accentColor}88`
      : isActiveProvider || status === "active"
        ? `0 0 22px ${accentColor}`
        : "none";

  const genTypeLabel = categoryKey === "img2img" ? "img→img" : "txt→img";

  const descSnippet = provider.description
    ? provider.description.slice(0, 70)
    : null;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onEdit(categoryKey, provider.name);
      }}
      style={{
        background: isEnabled ? (isCloud ? "#001a22" : "#1a0a00") : "#111111",
        border: `1.5px solid ${isEnabled ? accentColor : "#333333"}`,
        borderRadius: 10,
        padding: "10px 12px",
        minWidth: 160,
        maxWidth: 200,
        fontFamily: "monospace",
        opacity: isEnabled ? 1 : 0.45,
        transition: "opacity 0.2s, border-color 0.2s, box-shadow 0.3s",
        cursor: "pointer",
        boxShadow: glowShadow,
        animation: isAnimated
          ? `${isCloud ? "nodeGlowCyan" : "nodeGlowOrange"} 1.1s ease-in-out infinite alternate`
          : undefined,
        position: "relative",
        overflow: "visible",
      }}
      onMouseEnter={(e) => {
        setShowTooltip(true);
        if (!isAnimated)
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            `0 0 12px ${accentColor}66`;
      }}
      onMouseLeave={(e) => {
        setShowTooltip(false);
        if (!isAnimated)
          (e.currentTarget as HTMLDivElement).style.boxShadow = glowShadow;
      }}
    >
      {/* Status badge — always visible when active/completed */}
      {(status === "active" ||
        (isActiveProvider && status === "completed")) && (
        <div
          style={{
            position: "absolute",
            top: -10,
            right: -4,
            background: status === "active" ? accentColor : "#22c55e",
            color: "#000000",
            fontFamily: "monospace",
            fontSize: 7,
            fontWeight: 800,
            letterSpacing: "0.05em",
            padding: "1px 5px",
            borderRadius: 4,
            zIndex: 10,
            pointerEvents: "none",
            boxShadow: `0 0 8px ${status === "active" ? accentColor : "#22c55e"}`,
          }}
        >
          {status === "active" ? "● GERANDO" : "✓ SELECIONADO"}
        </div>
      )}

      {/* Tooltip — shown on hover: execution info only */}
      {showTooltip && lastExecution && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 14px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: 290,
            background: "#06000e",
            border: `1.5px solid ${accentColor}99`,
            borderRadius: 9,
            padding: "11px 13px",
            zIndex: 9999,
            boxShadow: `0 6px 32px ${accentColor}44`,
            pointerEvents: "none",
          }}
        >
          {/* ── Execution info section ── */}
          {lastExecution && (
            <>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 8,
                  color: accentColor,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 7,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span style={{ fontSize: 10 }}>◈</span>
                Última execução ·{" "}
                {new Date(lastExecution.ts).toLocaleTimeString("pt-BR", {
                  hour12: false,
                })}
              </div>
              {lastExecution.reasoning && (
                <div style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 7.5,
                      color: "#c026d3",
                      marginBottom: 3,
                      letterSpacing: "0.04em",
                    }}
                  >
                    REASONING
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 8,
                      color: "#ffffff77",
                      lineHeight: 1.6,
                      borderLeft: "2px solid #c026d344",
                      paddingLeft: 6,
                    }}
                  >
                    {lastExecution.reasoning.slice(0, 160)}
                    {lastExecution.reasoning.length > 160 ? "…" : ""}
                  </div>
                </div>
              )}
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 7.5,
                  color: accentColor,
                  marginBottom: 4,
                  letterSpacing: "0.04em",
                }}
              >
                PROMPT ENVIADO
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 7.5,
                  color: `${accentColor}cc`,
                  lineHeight: 1.65,
                  wordBreak: "break-word",
                  maxHeight: 130,
                  overflowY: "auto",
                  background: "#100500",
                  borderRadius: 5,
                  padding: "6px 9px",
                  border: `1px solid ${accentColor}22`,
                }}
              >
                {lastExecution.prompt.slice(0, 400)}
                {lastExecution.prompt.length > 400 ? "…" : ""}
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            color: isEnabled ? accentColor : "#777777",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.03em",
            wordBreak: "break-word",
            flex: 1,
            marginRight: 6,
          }}
        >
          {provider.label ?? provider.name}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(categoryKey, provider.name, !isEnabled);
          }}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
          }}
          title={isEnabled ? "Desativar" : "Ativar"}
        >
          {isEnabled ? (
            <ToggleRight size={18} style={{ color: "#22c55e" }} />
          ) : (
            <ToggleLeft size={18} style={{ color: "#555555" }} />
          )}
        </button>
      </div>

      {/* Badge row */}
      <div
        style={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          marginBottom: descSnippet || provider.envKey ? 6 : 0,
        }}
      >
        <span
          style={{
            fontSize: 9,
            background: `${accentColor}22`,
            color: accentColor,
            borderRadius: 4,
            padding: "1px 5px",
            border: `1px solid ${accentColor}44`,
          }}
        >
          {isCloud ? "☁️ cloud" : "🖥 local"}
        </span>
        <span
          style={{
            fontSize: 9,
            background: "#ffffff11",
            color: "#ffffff88",
            borderRadius: 4,
            padding: "1px 5px",
            border: "1px solid #ffffff22",
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
            color: "#ffffff44",
            lineHeight: 1.4,
            marginBottom: provider.envKey ? 4 : 0,
            wordBreak: "break-word",
          }}
        >
          {descSnippet}
          {provider.description && provider.description.length > 70 ? "…" : ""}
        </div>
      )}

      {/* Env key + status dot */}
      {provider.envKey && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginTop: 2,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isEnabled ? "#22c55e" : "#555555",
              flexShrink: 0,
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: 8,
              color: "#ffffff33",
              fontFamily: "monospace",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {provider.envKey}
          </span>
        </div>
      )}


      {/* Compact badge — only in dismissed mode */}
      {durationMs !== undefined &&
        (status === "completed" || status === "failed") &&
        timingDismissed && (
          <TimingBadge
            durationMs={durationMs}
            limitMs={limitMs}
            accentColor={status === "failed" ? "#ef4444" : undefined}
          />
        )}
      {/* Inline timing panel — default visible, × to dismiss */}
      {durationMs !== undefined && status !== "idle" && !timingDismissed && (
        <div
          style={{
            marginTop: 6,
            padding: "5px 7px",
            background: `${accentColor}0d`,
            border: `1px solid ${accentColor}22`,
            borderRadius: 6,
            position: "relative",
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTimingDismissed(true);
            }}
            style={{
              position: "absolute",
              top: 1,
              right: 3,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#ffffff33",
              fontSize: 12,
              padding: 0,
              lineHeight: 1,
            }}
            title="Ocultar"
          >
            ×
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 3,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 8,
                color: getTimingColor(durationMs, limitMs),
              }}
            >
              ⏱
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 18,
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1,
              }}
            >
              {fmtSec(durationMs)}
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                color: "#ffffff55",
              }}
            >
              s
            </span>
            {status === "active" && (
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 7,
                  color: accentColor,
                  marginLeft: 2,
                }}
              >
                contando…
              </span>
            )}
          </div>
          {status !== "active" && (
            <>
              <div
                style={{
                  background: "#ffffff11",
                  borderRadius: 2,
                  height: 3,
                  width: "100%",
                  overflow: "hidden",
                  marginBottom: 2,
                }}
              >
                <div
                  style={{
                    width: `${Math.min((durationMs / limitMs) * 100, 100)}%`,
                    height: "100%",
                    background: getTimingColor(durationMs, limitMs),
                    borderRadius: 2,
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "monospace",
                  fontSize: 7.5,
                  color: "#ffffff2a",
                }}
              >
                <span>lim: {(limitMs / 1000).toFixed(0)}s</span>
                <span style={{ color: getTimingColor(durationMs, limitMs) }}>
                  {Math.min((durationMs / limitMs) * 100, 100).toFixed(0)}%
                </span>
              </div>
            </>
          )}
          {status === "failed" && durationMs >= limitMs * 0.85 && (
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 7.5,
                color: "#ef4444aa",
                marginTop: 4,
              }}
            >
              ⚠ provável timeout
            </div>
          )}
        </div>
      )}

      {/* Edit hint */}
      <div
        style={{
          marginTop: 6,
          fontSize: 8,
          color: `${accentColor}55`,
          fontFamily: "monospace",
          letterSpacing: "0.05em",
          textAlign: "right",
        }}
      >
        ✎ editar
      </div>
    </div>
  );
}

// ─── CategoryBranchNode (custom ReactFlow node) ───────────────────────────────

function CategoryBranchNode({ data }: NodeProps) {
  const {
    categoryKey,
    label,
    providerCount,
    status = "idle",
    durationMs,
    limitMs = 20_000,
  } = data as CategoryBranchNodeData;
  const [timingDismissed, setTimingDismissed] = useState(false);
  const isImg2img = categoryKey === "img2img";
  const baseColor = isImg2img ? "#a855f7" : "#f97316";
  const borderColor =
    status === "active"
      ? baseColor
      : status === "completed"
        ? "#22c55eaa"
        : `${baseColor}88`;

  return (
    <div
      style={{
        background: status === "active"
          ? (isImg2img ? "#1a0030" : "#1a0800")
          : "#0a0014",
        border: `1.5px solid ${borderColor}`,
        borderRadius: 10,
        padding: "8px 12px",
        minWidth: 130,
        fontFamily: "monospace",
        transition: "box-shadow 0.2s",
        boxShadow:
          status === "active"
            ? `0 0 16px ${borderColor}`
            : status === "completed"
              ? `0 0 6px ${borderColor}44`
              : "none",
        animation:
          status === "active"
            ? (isImg2img ? "nodeGlowPurple" : "nodeGlowOrange") + " 1.1s ease-in-out infinite alternate"
            : undefined,
        position: "relative",
        overflow: "visible",
      }}
    >
      {status !== "idle" && (
        <div
          style={{
            position: "absolute",
            top: -9,
            right: -3,
            background:
              status === "active" ? baseColor : status === "completed" ? "#22c55e" : "#ef4444",
            color: "#000",
            fontFamily: "monospace",
            fontSize: 7,
            fontWeight: 800,
            padding: "1px 4px",
            borderRadius: 3,
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          {status === "active" ? "●" : status === "completed" ? "✓" : "✗"}
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

      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
        <span style={{
          fontSize: 9, fontFamily: "monospace", fontWeight: 700,
          color: `${baseColor}cc`, letterSpacing: "0.05em",
          background: `${baseColor}18`, borderRadius: 3, padding: "1px 5px",
        }}>
          {isImg2img ? "img→img" : "txt→img"}
        </span>
        <span style={{ color: borderColor, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>
          {label}
        </span>
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        <span style={{
          fontSize: 8,
          background: `${baseColor}22`,
          color: baseColor,
          borderRadius: 3,
          padding: "1px 4px",
          border: `1px solid ${baseColor}44`,
        }}>
          {providerCount} provider{providerCount !== 1 ? "s" : ""}
        </span>
      </div>
      {/* Compact badge — dismissed mode */}
      {durationMs !== undefined && (status === "completed" || status === "failed") && timingDismissed && (
        <TimingBadge durationMs={durationMs} limitMs={limitMs} />
      )}
      {/* Inline timing panel */}
      {durationMs !== undefined && status !== "idle" && !timingDismissed && (
        <div style={{
          marginTop: 6,
          padding: "4px 6px",
          background: `${baseColor}0d`,
          border: `1px solid ${baseColor}22`,
          borderRadius: 5,
          position: "relative",
        }}>
          <button onClick={(e) => { e.stopPropagation(); setTimingDismissed(true); }}
            style={{ position: "absolute", top: 1, right: 3, background: "none", border: "none", cursor: "pointer", color: "#ffffff33", fontSize: 12, padding: 0, lineHeight: 1 }}
            title="Ocultar">×</button>
          <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
            <span style={{ fontFamily: "monospace", fontSize: 7, color: getTimingColor(durationMs, limitMs) }}>⏱</span>
            <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{fmtSec(durationMs)}</span>
            <span style={{ fontFamily: "monospace", fontSize: 8, color: "#ffffff55" }}>s</span>
            {status === "active" && <span style={{ fontFamily: "monospace", fontSize: 7, color: baseColor, marginLeft: 2 }}>contando…</span>}
          </div>
          {status !== "active" && limitMs && (
            <>
              <div style={{ background: "#ffffff11", borderRadius: 2, height: 3, width: "100%", overflow: "hidden", marginBottom: 2, marginTop: 3 }}>
                <div style={{ width: `${Math.min((durationMs / limitMs) * 100, 100)}%`, height: "100%", background: getTimingColor(durationMs, limitMs), borderRadius: 2 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 7, color: "#ffffff2a" }}>
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
  const {
    model,
    provider,
    onOpenPanel,
    status = "idle",
    durationMs,
    limitMs = 20_000,
  } = data as LLMRouterNodeData;
  const [hovered, setHovered] = useState(true);
  const [timingDismissed, setTimingDismissed] = useState(false);
  const isEnabled = !!model;
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const color = isActive
    ? "#22d3ee"
    : isCompleted
      ? "#22c55ecc"
      : isEnabled
        ? "#22d3ee99"
        : "#555555";

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onOpenPanel();
      }}
      style={{
        background: isActive ? "#001522" : "#080f12",
        border: `1.5px solid ${color}`,
        borderRadius: 10,
        padding: "8px 12px",
        minWidth: 160,
        fontFamily: "monospace",
        cursor: "pointer",
        transition: "box-shadow 0.2s",
        boxShadow: isActive
          ? `0 0 16px ${color}`
          : isCompleted
            ? `0 0 6px ${color}44`
            : "none",
        animation: isActive
          ? "nodeGlowCyan 1.1s ease-in-out infinite alternate"
          : undefined,
        position: "relative",
        overflow: "visible",
      }}
      onMouseEnter={(e) => {
        setHovered(true);
        if (!isActive)
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            `0 0 12px ${color}66`;
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        (e.currentTarget as HTMLDivElement).style.boxShadow = isActive
          ? `0 0 16px ${color}`
          : isCompleted
            ? `0 0 6px ${color}44`
            : "none";
      }}
    >
      {/* Timing tooltip — hover-only after inline panel dismissed */}
      {hovered &&
        durationMs !== undefined &&
        status !== "idle" &&
        timingDismissed && (
          <TimingTooltip
            label="LLM Router"
            durationMs={durationMs}
            limitMs={limitMs}
            color="#22d3ee"
            isActive={isActive}
          />
        )}
      {(isActive || isCompleted) && (
        <div
          style={{
            position: "absolute",
            top: -9,
            right: -3,
            background: isActive ? "#22d3ee" : "#22c55e",
            color: "#000",
            fontFamily: "monospace",
            fontSize: 7,
            fontWeight: 800,
            padding: "1px 4px",
            borderRadius: 3,
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          {isActive ? "●" : "✓"}
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: color, borderColor: color }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: color, borderColor: color }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 11 }}>🤖</span>
        <span
          style={{
            color,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          LLM Router
        </span>
        {isActive && (
          <span style={{ color: "#22d3ee", fontSize: 8, marginLeft: "auto" }}>
            ●
          </span>
        )}
        <span
          style={{
            fontSize: 8,
            color: `${color}66`,
            marginLeft: isActive ? 0 : "auto",
          }}
        >
          ⚙
        </span>
      </div>

      <div style={{ fontSize: 9, fontFamily: "monospace", marginBottom: 4 }}>
        {isEnabled ? (
          <>
            <span style={{ color: `${color}99` }}>{provider}: </span>
            <span style={{ color }}>
              {model.length > 18 ? model.slice(0, 18) + "…" : model}
            </span>
          </>
        ) : (
          <span style={{ color: "#555555", fontStyle: "italic" }}>
            desabilitado
          </span>
        )}
      </div>

      {/* Compact badge — only in dismissed mode */}
      {durationMs !== undefined &&
        (isCompleted || status === "failed") &&
        timingDismissed && (
          <TimingBadge
            durationMs={durationMs}
            limitMs={limitMs}
            accentColor={status === "failed" ? "#ef4444" : "#22d3ee"}
          />
        )}
      {/* Inline timing panel — default visible, × to dismiss */}
      {durationMs !== undefined && status !== "idle" && !timingDismissed && (
        <div
          style={{
            marginTop: 7,
            padding: "5px 7px",
            background: "#22d3ee0d",
            border: "1px solid #22d3ee22",
            borderRadius: 6,
            position: "relative",
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTimingDismissed(true);
            }}
            style={{
              position: "absolute",
              top: 1,
              right: 3,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#ffffff33",
              fontSize: 12,
              padding: 0,
              lineHeight: 1,
            }}
            title="Ocultar"
          >
            ×
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 3,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 8,
                color: getTimingColor(durationMs, limitMs),
              }}
            >
              ⏱
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 18,
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1,
              }}
            >
              {fmtSec(durationMs)}
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                color: "#ffffff55",
              }}
            >
              s
            </span>
            {isActive && (
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 7,
                  color: "#22d3ee",
                  marginLeft: 2,
                }}
              >
                contando…
              </span>
            )}
          </div>
          {!isActive && (
            <>
              <div
                style={{
                  background: "#ffffff11",
                  borderRadius: 2,
                  height: 3,
                  width: "100%",
                  overflow: "hidden",
                  marginBottom: 2,
                }}
              >
                <div
                  style={{
                    width: `${Math.min((durationMs / limitMs) * 100, 100)}%`,
                    height: "100%",
                    background: getTimingColor(durationMs, limitMs),
                    borderRadius: 2,
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "monospace",
                  fontSize: 7.5,
                  color: "#ffffff2a",
                }}
              >
                <span>lim: {(limitMs / 1000).toFixed(0)}s</span>
                <span style={{ color: getTimingColor(durationMs, limitMs) }}>
                  {Math.min((durationMs / limitMs) * 100, 100).toFixed(0)}%
                </span>
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
        background: "transparent",
        border: "1.5px dashed #ffffff22",
        borderRadius: 10,
        padding: "10px 12px",
        minWidth: 160,
        maxWidth: 200,
        fontFamily: "monospace",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#ffffff44";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#ffffff22";
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "#ffffff22", borderColor: "#ffffff22" }}
      />
      <span style={{ color: "#666666", fontSize: 11 }}>+ Novo workflow</span>
    </div>
  );
}

// ─── VisionDescriptorNode (custom ReactFlow node) ────────────────────────────

function VisionDescriptorNode({ data }: NodeProps) {
  const {
    enabled,
    provider,
    model,
    fallbackProvider,
    fallbackModel,
    onOpenPanel,
    status = "idle",
    durationMs,
    limitMs,
  } = data as VisionDescriptorNodeData;
  const [hovered, setHovered] = useState(true);
  const [timingDismissed, setTimingDismissed] = useState(false);
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const color = isFailed
    ? "#ef4444"
    : isActive
      ? "#a855f7"
      : isCompleted
        ? "#a855f799"
        : enabled
          ? "#a855f766"
          : "#333344";

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onOpenPanel(); }}
      style={{
        background: isActive ? "#100018" : "#0a0010",
        border: `1.5px solid ${color}`,
        borderRadius: 10,
        padding: "8px 12px",
        minWidth: 150,
        fontFamily: "monospace",
        cursor: "pointer",
        transition: "box-shadow 0.2s",
        boxShadow: isActive
          ? `0 0 16px ${color}`
          : isCompleted
            ? `0 0 6px ${color}44`
            : "none",
        animation: isActive
          ? "nodeGlowPurple 1.1s ease-in-out infinite alternate"
          : undefined,
        position: "relative",
        overflow: "visible",
        opacity: enabled ? 1 : 0.55,
      }}
      onMouseEnter={(e) => {
        setHovered(true);
        if (!isActive) (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 12px ${color}66`;
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        (e.currentTarget as HTMLDivElement).style.boxShadow = isActive
          ? `0 0 16px ${color}`
          : isCompleted ? `0 0 6px ${color}44` : "none";
      }}
    >
      {hovered && durationMs !== undefined && status !== "idle" && timingDismissed && (
        <TimingTooltip
          label="Vision Descriptor"
          durationMs={durationMs}
          limitMs={limitMs}
          color="#a855f7"
          isActive={isActive}
        />
      )}
      {(isActive || isCompleted || isFailed) && (
        <div style={{
          position: "absolute", top: -9, right: -3,
          background: isFailed ? "#ef4444" : isActive ? "#a855f7" : "#22c55e",
          color: "#000", fontFamily: "monospace", fontSize: 7, fontWeight: 800,
          padding: "1px 4px", borderRadius: 3, zIndex: 10, pointerEvents: "none",
        }}>
          {isFailed ? "✗" : isActive ? "●" : "✓"}
        </div>
      )}

      <Handle type="target" position={Position.Left} style={{ background: color, borderColor: color }} />
      <Handle type="source" position={Position.Right} style={{ background: color, borderColor: color }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 11 }}>👁</span>
        <span style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>
          Vision
        </span>
        {!enabled && (
          <span style={{ fontSize: 8, color: "#555566", marginLeft: "auto", fontStyle: "italic" }}>
            off
          </span>
        )}
        {isActive && (
          <span style={{ color: "#a855f7", fontSize: 8, marginLeft: "auto" }}>●</span>
        )}
        <span style={{ fontSize: 8, color: `${color}66`, marginLeft: isActive ? 0 : (enabled ? "auto" : 0) }}>⚙</span>
      </div>

      {/* Primary model */}
      <div style={{ fontSize: 9, fontFamily: "monospace", marginBottom: 3 }}>
        {enabled && model ? (
          <>
            <span style={{ color: `${color}99` }}>{provider}: </span>
            <span style={{ color }}>
              {model.length > 18 ? model.slice(0, 18) + "…" : model}
            </span>
          </>
        ) : (
          <span style={{ color: "#444455", fontStyle: "italic" }}>
            {enabled ? "sem modelo" : "desabilitado"}
          </span>
        )}
      </div>

      {/* Fallback row */}
      <div style={{
        fontSize: 8, fontFamily: "monospace",
        color: fallbackModel ? "#ffffff33" : "#ffffff16",
        borderTop: "1px solid #ffffff0d", paddingTop: 3,
        display: "flex", alignItems: "center", gap: 4,
      }}>
        <span style={{ color: "#a855f744" }}>↩</span>
        {fallbackModel ? (
          <>
            <span style={{ color: "#a855f755" }}>{fallbackProvider}: </span>
            <span style={{ color: "#a855f777" }}>
              {fallbackModel.length > 16 ? fallbackModel.slice(0, 16) + "…" : fallbackModel}
            </span>
          </>
        ) : (
          <span style={{ fontStyle: "italic", color: "#333344" }}>sem fallback</span>
        )}
      </div>

      {/* Compact badge when dismissed */}
      {durationMs !== undefined && (isCompleted || isFailed) && timingDismissed && (
        <TimingBadge durationMs={durationMs} limitMs={limitMs}
          accentColor={isFailed ? "#ef4444" : "#a855f7"} />
      )}

      {/* Inline timing panel */}
      {durationMs !== undefined && status !== "idle" && !timingDismissed && (
        <div style={{
          marginTop: 7, padding: "5px 7px",
          background: "#a855f70d", border: "1px solid #a855f722",
          borderRadius: 6, position: "relative",
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); setTimingDismissed(true); }}
            style={{
              position: "absolute", top: 1, right: 3, background: "none",
              border: "none", cursor: "pointer", color: "#ffffff33", fontSize: 12, padding: 0, lineHeight: 1,
            }}
            title="Ocultar"
          >×</button>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 4 }}>
            <span style={{ fontFamily: "monospace", fontSize: 8, color: getTimingColor(durationMs, limitMs) }}>⏱</span>
            <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
              {fmtSec(durationMs)}
            </span>
            <span style={{ fontFamily: "monospace", fontSize: 9, color: "#ffffff55" }}>s</span>
            {isActive && (
              <span style={{ fontFamily: "monospace", fontSize: 7, color: "#a855f7", marginLeft: 2 }}>contando…</span>
            )}
          </div>
          {!isActive && limitMs !== undefined && (
            <>
              <div style={{ background: "#ffffff11", borderRadius: 2, height: 3, width: "100%", overflow: "hidden", marginBottom: 2 }}>
                <div style={{
                  width: `${Math.min((durationMs / limitMs) * 100, 100)}%`,
                  height: "100%", background: getTimingColor(durationMs, limitMs), borderRadius: 2,
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 7.5, color: "#ffffff2a" }}>
                <span>lim: {(limitMs / 1000).toFixed(0)}s</span>
                <span style={{ color: getTimingColor(durationMs, limitMs) }}>
                  {Math.min((durationMs / limitMs) * 100, 100).toFixed(0)}%
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── VisionFallbackNode (canvas node showing fallback provider) ──────────────

function VisionFallbackNode({ data }: NodeProps) {
  const { provider, model, onOpenPanel, status = "idle" } = data as VisionFallbackNodeData;
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const hasConfig = !!provider && !!model;
  const color = isFailed
    ? "#ef4444"
    : isActive
      ? "#a855f7"
      : isCompleted
        ? "#a855f799"
        : "#a855f744";

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onOpenPanel(); }}
      style={{
        background: "#08000e",
        border: `1px dashed ${color}`,
        borderRadius: 10,
        padding: "8px 12px",
        minWidth: 150,
        fontFamily: "monospace",
        cursor: "pointer",
        opacity: hasConfig ? 0.82 : 0.42,
        boxShadow: isActive ? `0 0 14px ${color}` : "none",
        animation: isActive ? "nodeGlowPurple 1.1s ease-in-out infinite alternate" : undefined,
        position: "relative",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, borderColor: color }} />
      <Handle type="source" position={Position.Right} style={{ background: color, borderColor: color }} />

      {/* Status badge */}
      {(isActive || isCompleted || isFailed) && (
        <div style={{
          position: "absolute", top: -9, right: -3,
          background: isFailed ? "#ef4444" : isActive ? "#a855f7" : "#22c55e",
          color: "#000", fontFamily: "monospace", fontSize: 7, fontWeight: 800,
          padding: "1px 4px", borderRadius: 3, zIndex: 10, pointerEvents: "none",
        }}>
          {isFailed ? "✗" : isActive ? "●" : "✓"}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{
          fontSize: 7, color: `${color}aa`,
          background: `${color}18`, border: `1px solid ${color}33`,
          borderRadius: 3, padding: "1px 5px",
          letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0,
        }}>
          FALLBACK
        </span>
        <span style={{ color: `${color}55`, fontSize: 8, marginLeft: "auto" }}>⚙ editar</span>
      </div>

      {/* Model row */}
      <div style={{ fontSize: 9, fontFamily: "monospace" }}>
        {hasConfig ? (
          <>
            <span style={{ color: `${color}88` }}>{provider}: </span>
            <span style={{ color }}>
              {model.length > 18 ? model.slice(0, 18) + "…" : model}
            </span>
          </>
        ) : (
          <span style={{ color: "#333344", fontStyle: "italic", fontSize: 8 }}>
            não configurado
          </span>
        )}
      </div>
    </div>
  );
}

// ─── CategoryFallbackNode (canvas node showing category-level fallback provider) ─

function CategoryFallbackNode({ data }: NodeProps) {
  const { categoryKey, fallback, onEdit, status = "idle", durationMs, limitMs } = data as CategoryFallbackNodeData;
  const isText2img = categoryKey === "text2img";
  const baseColor = isText2img ? "#f97316" : "#a855f7";
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const color = isFailed ? "#ef4444" : isActive ? baseColor : isCompleted ? `${baseColor}99` : `${baseColor}44`;
  const hasConfig = !!fallback;

  const [dismissed, setDismissed] = useState(false);
  const showTiming = typeof durationMs === "number" && durationMs > 0 && status !== "idle";

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onEdit(); }}
      style={{
        background: "#08000e",
        border: `1px dashed ${color}`,
        borderRadius: 10,
        padding: "8px 12px",
        minWidth: 160,
        fontFamily: "monospace",
        opacity: hasConfig ? 0.9 : 0.55,
        boxShadow: isActive ? `0 0 14px ${color}` : "none",
        animation: isActive ? (isText2img ? "nodeGlowOrange 1.1s ease-in-out infinite alternate" : "nodeGlowPurple 1.1s ease-in-out infinite alternate") : undefined,
        position: "relative",
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, borderColor: color }} />
      <Handle type="source" position={Position.Right} style={{ background: color, borderColor: color }} />

      {/* Status badge */}
      {(isActive || isCompleted || isFailed) && (
        <div style={{
          position: "absolute", top: -9, right: -3,
          background: isFailed ? "#ef4444" : isActive ? baseColor : "#22c55e",
          color: "#000", fontFamily: "monospace", fontSize: 7, fontWeight: 800,
          padding: "1px 4px", borderRadius: 3, zIndex: 10, pointerEvents: "none",
        }}>
          {isFailed ? "✗" : isActive ? "●" : "✓"}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{
          fontSize: 7, color: `${color}aa`,
          background: `${color}18`, border: `1px solid ${color}33`,
          borderRadius: 3, padding: "1px 5px",
          letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0,
        }}>
          FALLBACK
        </span>
        <span style={{ fontSize: 7, color: `${baseColor}44`, marginLeft: "auto" }}>
          {isText2img ? "txt→img" : "img→img"}
        </span>
        <span style={{ fontSize: 7, color: `${color}55`, marginLeft: 4 }}>⚙ editar</span>
      </div>

      {/* Provider info */}
      <div style={{ fontSize: 9, fontFamily: "monospace" }}>
        {hasConfig ? (
          <>
            <div style={{ color: `${color}88`, marginBottom: 1 }}>
              {fallback!.executionMode === "cloud" ? "☁️" : "🖥"}{" "}
              <span style={{ color }}>{fallback!.label ?? fallback!.name}</span>
            </div>
            {fallback!.model && (
              <div style={{ color: `${color}66`, fontSize: 8 }}>
                {fallback!.model.length > 20 ? fallback!.model.slice(0, 20) + "…" : fallback!.model}
              </div>
            )}
          </>
        ) : (
          <span style={{ color: "#333344", fontStyle: "italic", fontSize: 8 }}>
            não configurado
          </span>
        )}
      </div>

      {/* Timing panel */}
      {showTiming && !dismissed && (
        <div style={{
          marginTop: 6, background: "#0a0010", border: `1px solid ${color}22`,
          borderRadius: 6, padding: "4px 7px", position: "relative",
        }}>
          <button onClick={(e) => { e.stopPropagation(); setDismissed(true); }} style={{
            position: "absolute", top: 2, right: 4,
            background: "none", border: "none", color: "#ffffff44", fontSize: 9, cursor: "pointer", padding: 0, lineHeight: 1,
          }}>×</button>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: getTimingColor(durationMs!, limitMs) }}>
            <span>⏱</span>
            <span style={{ fontWeight: 700 }}>
              {status === "active" ? fmtSec(durationMs!) : fmtSec(durationMs!)}s
            </span>
          </div>
          {limitMs && (
            <div style={{ marginTop: 3, height: 3, borderRadius: 2, background: "#ffffff11", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${Math.min(100, (durationMs! / limitMs) * 100).toFixed(1)}%`,
                background: getTimingColor(durationMs!, limitMs),
                transition: "width 0.5s ease",
              }} />
            </div>
          )}
        </div>
      )}
      {showTiming && dismissed && durationMs && (
        <TimingBadge durationMs={durationMs} limitMs={limitMs} accentColor={baseColor} />
      )}
    </div>
  );
}

// ─── Panel sub-components (info blocks used in side panels) ──────────────────

const infoText: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 9,
  color: "#ffffff77",
  lineHeight: 1.75,
  margin: 0,
};

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
    <div
      style={{
        background: `${color}0a`,
        border: `1px solid ${color}22`,
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 9,
          fontWeight: 700,
          color,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
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
  step,
  color,
  condition,
  result,
  note,
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
        background: "#ffffff06",
        border: `1px solid ${color}22`,
        borderRadius: 6,
        padding: "7px 10px",
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          fontFamily: "monospace",
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
        <div
          style={{ fontFamily: "monospace", fontSize: 9, color: "#ffffff88" }}
        >
          {condition}
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            color,
            fontWeight: 700,
            marginTop: 2,
          }}
        >
          {result}
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 8,
            color: "#ffffff44",
            marginTop: 2,
            lineHeight: 1.5,
          }}
        >
          {note}
        </div>
      </div>
    </div>
  );
}

// ─── ResizeHandle ─────────────────────────────────────────────────────────────

function ResizeHandle({
  onMouseDown,
  color,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
  color: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 6,
        cursor: "ew-resize",
        zIndex: 30,
        background: hovered ? `${color}55` : "transparent",
        transition: "background 0.15s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {hovered && (
        <div
          style={{
            width: 2,
            height: 40,
            borderRadius: 2,
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      )}
    </div>
  );
}

// ─── NODE_TYPES / EDGE_TYPES (defined outside component to avoid re-registering) ───

const NODE_TYPES = {
  workflowNode: WorkflowProviderNode,
  categoryBranchNode: CategoryBranchNode,
  llmRouterNode: LLMRouterNode,
  visionDescriptorNode: VisionDescriptorNode,
  visionFallbackNode: VisionFallbackNode,
  categoryFallbackNode: CategoryFallbackNode,
  addNode: AddWorkflowNode,
};

const EDGE_TYPES = {};

// ─── Graph builder ────────────────────────────────────────────────────────────

function buildNodes(
  categories: Record<string, ImageCategoryConfig>,
  routerConfig: ImageRouterConfig,
  visionConfig: VisionDescriptorSkillConfig,
  onToggle: (category: string, name: string, enabled: boolean) => void,
  onAddInCategory: (category: string) => void,
  onOpenRouterPanel: () => void,
  onOpenVisionPanel: () => void,
  onEdit: (category: string, name: string) => void,
  onEditFallback: (category: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const text2imgProviders = categories?.text2img?.providers ?? [];
  const img2imgProviders = categories?.img2img?.providers ?? [];
  const hasFallback = !!(visionConfig.fallback?.provider && visionConfig.fallback?.model);

  // Layout columns (x):
  //   0: entry
  // 200: llmRouter
  // 400: branch headers (text2img top, img2img bottom)
  // 600: vision (img2img only) / text2img providers
  // 800: visionFallback (img2img) / img2img providers
  // 1000: img2img providers (after vision)

  const text2imgCount = text2imgProviders.length;
  const img2imgCount = img2imgProviders.length;
  // Each branch occupies 110px per provider + vision nodes for img2img
  const visionRows = visionConfig.enabled ? 2 : 0; // vision + fallback
  const img2imgRows = img2imgCount + visionRows + 1; // +1 for add node
  const text2imgRows = text2imgCount + 1; // +1 for add node
  const totalRows = text2imgRows + img2imgRows + 1; // gap between branches
  const text2imgTopY = 0;
  const img2imgTopY = (text2imgRows + 1) * 110;
  const centerY = (totalRows * 110) / 2;

  const nodes: Node[] = [
    // ── Entry ─────────────────────────────────────────────────────────────────
    {
      id: "entry",
      type: "default",
      position: { x: 0, y: centerY - 30 },
      data: { label: "🖼 Image Gen" },
      style: {
        background: "#3a1a00",
        border: "1.5px solid #f97316",
        borderRadius: 10,
        color: "#f97316",
        fontFamily: "monospace",
        fontSize: 11,
        fontWeight: 700,
        padding: "8px 14px",
        minWidth: 120,
        textAlign: "center",
      },
    },
    // ── LLM Router ────────────────────────────────────────────────────────────
    {
      id: "llmRouter",
      type: "llmRouterNode",
      position: { x: 200, y: centerY - 35 },
      data: {
        model: routerConfig.model,
        provider: routerConfig.provider,
        onOpenPanel: onOpenRouterPanel,
      } as LLMRouterNodeData,
    },
    // ── Branch: text2img ──────────────────────────────────────────────────────
    {
      id: "branch_text2img",
      type: "categoryBranchNode",
      position: { x: 400, y: text2imgTopY + (text2imgRows * 110) / 2 - 30 },
      data: {
        categoryKey: "text2img",
        label: categories?.text2img?.label ?? "Text → Imagem",
        providerCount: text2imgCount,
      } as CategoryBranchNodeData,
    },
    // text2img providers
    ...text2imgProviders.map((p, i) => ({
      id: `provider_text2img_${p.name}`,
      type: "workflowNode",
      position: { x: 600, y: text2imgTopY + i * 110 },
      data: {
        provider: p,
        categoryKey: "text2img",
        onToggle,
        onEdit,
      } as WorkflowNodeData,
    })),
    {
      id: "add_text2img",
      type: "addNode",
      position: { x: 600, y: text2imgTopY + text2imgCount * 110 },
      data: { onAdd: () => onAddInCategory("text2img") } as AddNodeData,
    },
    // text2img fallback provider
    {
      id: "fallback_text2img",
      type: "categoryFallbackNode",
      position: { x: 800, y: text2imgTopY + (text2imgRows * 110) / 2 - 30 },
      data: {
        categoryKey: "text2img",
        fallback: categories?.text2img?.fallback ?? null,
        onEdit: () => onEditFallback("text2img"),
      } as CategoryFallbackNodeData,
    },
    // ── Branch: img2img ───────────────────────────────────────────────────────
    {
      id: "branch_img2img",
      type: "categoryBranchNode",
      position: { x: 400, y: img2imgTopY + (img2imgRows * 110) / 2 - 30 },
      data: {
        categoryKey: "img2img",
        label: categories?.img2img?.label ?? "Imagem + Texto → Imagem",
        providerCount: img2imgCount,
      } as CategoryBranchNodeData,
    },
    // Vision Descriptor (img2img branch, before providers)
    {
      id: "vision",
      type: "visionDescriptorNode",
      position: { x: 600, y: img2imgTopY + 0 },
      data: {
        enabled: visionConfig.enabled ?? false,
        provider: visionConfig.provider ?? "ollama",
        model: visionConfig.model ?? "",
        fallbackProvider: visionConfig.fallback?.provider ?? "",
        fallbackModel: visionConfig.fallback?.model ?? "",
        timeoutMs: visionConfig.timeoutMs ?? 60000,
        onOpenPanel: onOpenVisionPanel,
      } as VisionDescriptorNodeData,
    },
    {
      id: "visionFallback",
      type: "visionFallbackNode",
      position: { x: 600, y: img2imgTopY + 110 },
      data: {
        provider: visionConfig.fallback?.provider ?? "",
        model: visionConfig.fallback?.model ?? "",
        onOpenPanel: onOpenVisionPanel,
      } as VisionFallbackNodeData,
    },
    // img2img providers (after vision column)
    ...img2imgProviders.map((p, i) => ({
      id: `provider_img2img_${p.name}`,
      type: "workflowNode",
      position: { x: 800, y: img2imgTopY + i * 110 },
      data: {
        provider: p,
        categoryKey: "img2img",
        onToggle,
        onEdit,
      } as WorkflowNodeData,
    })),
    {
      id: "add_img2img",
      type: "addNode",
      position: { x: 800, y: img2imgTopY + img2imgCount * 110 },
      data: { onAdd: () => onAddInCategory("img2img") } as AddNodeData,
    },
  ];

  const visionColor = visionConfig.enabled ? "#a855f766" : "#333344";
  const fallbackEdgeColor = hasFallback ? "#a855f733" : "#33333322";

  const edges: Edge[] = [
    // entry → llmRouter
    {
      id: "entry→llmRouter",
      source: "entry",
      target: "llmRouter",
      style: { stroke: "#22d3ee55", strokeWidth: 1.5 },
      animated: false,
    },
    // llmRouter → branch_text2img
    {
      id: "llmRouter→branch_text2img",
      source: "llmRouter",
      target: "branch_text2img",
      style: { stroke: "#f9731655", strokeWidth: 1.5 },
      animated: false,
    },
    // llmRouter → branch_img2img
    {
      id: "llmRouter→branch_img2img",
      source: "llmRouter",
      target: "branch_img2img",
      style: { stroke: "#a855f755", strokeWidth: 1.5 },
      animated: false,
    },
    // branch_text2img → text2img providers
    ...text2imgProviders.map((p) => ({
      id: `branch_text2img→provider_text2img_${p.name}`,
      source: "branch_text2img",
      target: `provider_text2img_${p.name}`,
      style: {
        stroke: p.enabled ? (p.executionMode === "cloud" ? "#22d3ee55" : "#f9731655") : "#33333355",
        strokeWidth: 1.5,
      },
      animated: false,
    })),
    {
      id: "branch_text2img→add_text2img",
      source: "branch_text2img",
      target: "add_text2img",
      style: { stroke: "#ffffff11", strokeWidth: 1, strokeDasharray: "4 3" },
      animated: false,
    },
    // branch_text2img → fallback_text2img
    {
      id: "branch_text2img→fallback_text2img",
      source: "branch_text2img",
      target: "fallback_text2img",
      style: { stroke: "#f9731633", strokeWidth: 1, strokeDasharray: "5 4" },
      animated: false,
    },
    // branch_img2img → vision
    {
      id: "branch_img2img→vision",
      source: "branch_img2img",
      target: "vision",
      style: { stroke: visionColor, strokeWidth: 1.5, strokeDasharray: visionConfig.enabled ? undefined : "5 3" },
      animated: false,
    },
    // branch_img2img → visionFallback
    {
      id: "branch_img2img→visionFallback",
      source: "branch_img2img",
      target: "visionFallback",
      style: { stroke: fallbackEdgeColor, strokeWidth: 1, strokeDasharray: "4 3" },
      animated: false,
    },
    // vision → img2img providers
    ...img2imgProviders.map((p) => ({
      id: `vision→provider_img2img_${p.name}`,
      source: "vision",
      target: `provider_img2img_${p.name}`,
      style: {
        stroke: p.enabled ? (p.executionMode === "cloud" ? "#22d3ee55" : "#a855f755") : "#33333355",
        strokeWidth: 1.5,
        strokeDasharray: visionConfig.enabled ? undefined : "5 3",
      },
      animated: false,
    })),
    {
      id: "vision→add_img2img",
      source: "vision",
      target: "add_img2img",
      style: { stroke: "#ffffff11", strokeWidth: 1, strokeDasharray: "4 3" },
      animated: false,
    },
  ];

  return { nodes, edges };
}

// ─── Main component ───────────────────────────────────────────────────────────

const DEFAULT_ROUTER_CONFIG: ImageRouterConfig = {
  model: "",
  provider: "ollama",
  timeoutMs: 12000,
};

export function ImageGenSubFlow({
  baseUrl,
  definition,
  onBack,
  conversationId,
}: ImageGenSubFlowProps) {
  const [categories, setCategories] = useState<Record<string, ImageCategoryConfig>>({});
  const [addingInCategory, setAddingInCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingProviderName, setEditingProviderName] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    label: "",
    description: "",
    workflowPath: "",
    timeoutMs: 300000,
    model: "",
  });
  const [form, setForm] = useState({
    name: "",
    executionMode: "local",
    workflowPath: "",
    description: "",
    timeoutMs: 300000,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingWorkflow, setDeletingWorkflow] = useState(false);
  const [panelZoom, setPanelZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [createdEnvVar, setCreatedEnvVar] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ─── Custom Workflow Scan state ───────────────────────────────────────────
  const [scanPanelOpen, setScanPanelOpen] = useState(false);
  const [customWf, setCustomWf] = useState<CustomWorkflowsState>({
    folder: null,
    discovered: {},
  });
  const [scanFolder, setScanFolder] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [savingWf, setSavingWf] = useState<string | null>(null);

  // ─── Panel resize ─────────────────────────────────────────────────────────

  const { width: panelWidth, onMouseDown: onResizeMouseDown } =
    useResizablePanel(320, 260, 860);

  // ─── LLM Router state ─────────────────────────────────────────────────────

  const [routerConfig, setRouterConfig] = useState<ImageRouterConfig>(
    DEFAULT_ROUTER_CONFIG,
  );
  const [routerPanelOpen, setRouterPanelOpen] = useState(false);
  const [routerForm, setRouterForm] = useState<ImageRouterConfig>(
    DEFAULT_ROUTER_CONFIG,
  );
  const [savingRouter, setSavingRouter] = useState(false);

  // ─── Vision Descriptor state ───────────────────────────────────────────────

  const DEFAULT_VISION_CONFIG: VisionDescriptorSkillConfig = {
    enabled: false,
    provider: "ollama",
    model: "",
    timeoutMs: 60000,
    fallback: { provider: "openai", model: "gpt-4o", timeoutMs: 30000 },
  };
  const [visionConfig, setVisionConfig] = useState<VisionDescriptorSkillConfig>(
    DEFAULT_VISION_CONFIG,
  );
  const [visionForm, setVisionForm] = useState<VisionDescriptorSkillConfig>(
    DEFAULT_VISION_CONFIG,
  );
  const [savingVision, setSavingVision] = useState(false);
  const [visionPanelOpen, setVisionPanelOpen] = useState(false);

  // ─── Category fallback edit state ─────────────────────────────────────────

  const [fallbackPanelCategory, setFallbackPanelCategory] = useState<string | null>(null);
  const [fallbackForm, setFallbackForm] = useState<Partial<ImageCategoryProvider>>({
    name: "", label: "", executionMode: "cloud", timeoutMs: 60000,
  });
  const [savingFallback, setSavingFallback] = useState(false);

  // ─── SSE animation state ───────────────────────────────────────────────────

  const [nodeStatuses, setNodeStatuses] = useState<Map<string, NodeStatus>>(
    new Map(),
  );
  const [tick, setTick] = useState(0);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [execInfoMap, setExecInfoMap] = useState<Map<string, ExecInfo>>(
    new Map(),
  );
  const [nodeTimes, setNodeTimes] = useState<Map<string, NodeTime>>(new Map());
  const activeProviderRef = useRef<string | null>(null);
  const pendingPromptRef = useRef<string | null>(null);
  const sseCleanupRef = useRef<(() => void) | null>(null);

  // Real-time tick: re-runs liveNodes every second while any node is active.
  useEffect(() => {
    const hasActive = [...nodeStatuses.values()].some((s) => s === "active");
    if (!hasActive) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [nodeStatuses]);

  // Keep ref in sync with state so applyImageEvent can access it without closure issues
  useEffect(() => {
    activeProviderRef.current = activeProviderId;
  }, [activeProviderId]);

  // ─── Populate edit form when a provider is selected ───────────────────────

  useEffect(() => {
    if (!editingProviderName || !editingCategory) return;
    const p = (categories[editingCategory]?.providers ?? []).find(
      (x) => x.name === editingProviderName,
    );
    if (!p) return;
    setEditForm({
      label: p.label ?? p.name,
      description: p.description ?? "",
      workflowPath: p.workflowPath ?? "",
      timeoutMs: p.timeoutMs ?? 300000,
      model: p.model ?? "",
    });
  }, [editingProviderName, editingCategory]);

  // ─── Load on mount ────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    getImageGenConfig(baseUrl)
      .then(({ categories: cats, routerConfig: rc }) => {
        setCategories(cats ?? {});
        setRouterConfig(rc);
        setRouterForm(rc);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    getVisionDescriptorConfig(baseUrl)
      .then((vc) => {
        setVisionConfig(vc);
        setVisionForm(vc);
      })
      .catch(() => {});

    getCustomWorkflows(baseUrl)
      .then((s) => {
        setCustomWf(s);
        setScanFolder(s.folder ?? "");
      })
      .catch(() => {});
  }, [baseUrl]);

  async function handleScan() {
    setScanning(true);
    setScanError(null);
    try {
      const result = await scanCustomWorkflows(
        baseUrl,
        scanFolder || undefined,
      );
      setCustomWf({ folder: result.folder, discovered: result.discovered });
    } catch (e: unknown) {
      setScanError(e instanceof Error ? e.message : "Erro ao escanear");
    } finally {
      setScanning(false);
    }
  }

  async function handleToggleCustomWf(name: string, entry: DiscoveredWorkflow) {
    setSavingWf(name);
    try {
      const result = await updateCustomWorkflow(baseUrl, name, {
        enabled: !entry.enabled,
      });
      setCustomWf((prev) => ({
        ...prev,
        discovered: { ...prev.discovered, [name]: result.workflow },
      }));
      // Refresh categories so the new custom_* provider appears in the canvas
      const { categories: cats } = await getImageGenConfig(baseUrl);
      setCategories(cats ?? {});
    } catch {
      /* silently fail */
    } finally {
      setSavingWf(null);
    }
  }

  async function handleSetCustomWfType(
    name: string,
    generationType: "txt2img" | "img2img",
  ) {
    setSavingWf(name);
    try {
      const result = await updateCustomWorkflow(baseUrl, name, {
        generationType,
      });
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
    activeProvNodeId?: string,
  ) {
    const end = (id: string) => {
      const t = times.get(id);
      if (t && !t.endTs) times.set(id, { ...t, endTs: ts });
    };
    if (eventName === "stage.started" && payload?.stageId === "image_gen") {
      times.set("entry", { startTs: ts });
      times.set("llmRouter", { startTs: ts });
    } else if (eventName === "image.category_selected") {
      end("llmRouter");
      // Start branch node timer
      const cat = payload?.category as string | undefined;
      if (cat) times.set(`branch_${cat}`, { startTs: ts });
    } else if (eventName === "image.provider_selected") {
      const cat = payload?.category as string | undefined;
      if (cat) {
        end(`branch_${cat}`);
        // If img2img, start vision timer (vision runs next)
        if (cat === "img2img" && visionConfig.enabled) times.set("vision", { startTs: ts });
      }
    } else if (eventName === "vision.described") {
      const dur = payload?.durationMs as number | undefined;
      if (dur) {
        times.set("vision", { startTs: ts - dur, endTs: ts });
      } else {
        end("vision");
      }
    } else if (eventName === "image.gen_started") {
      // Provider generation begins
      const prov = payload?.provider as string | undefined;
      const cat = payload?.category as string | undefined;
      if (prov && cat) times.set(`provider_${cat}_${prov}`, { startTs: ts });
    } else if (eventName === "image.gen_completed") {
      const prov = payload?.provider as string | undefined;
      const cat = payload?.category as string | undefined;
      if (prov && cat) end(`provider_${cat}_${prov}`);
    } else if (eventName === "image.gen_failed") {
      const prov = payload?.provider as string | undefined;
      const cat = payload?.category as string | undefined;
      if (prov && cat) end(`provider_${cat}_${prov}`);
    } else if (eventName === "stage.completed" && payload?.stageId === "image_gen") {
      end("entry");
      end("llmRouter");
      end("vision");
      if (activeProvNodeId) end(activeProvNodeId);
    } else if (eventName === "stage.failed" && payload?.stageId === "image_gen") {
      end("entry");
      end("llmRouter");
      end("vision");
      if (activeProvNodeId) end(activeProvNodeId);
    }
  }

  function applyImageEvent(
    eventName: string,
    payload: Record<string, unknown> | undefined,
    m: Map<string, NodeStatus>,
    currentActiveProv?: string | null,
  ): string | null | undefined {
    // returns new activeProviderId when provider_selected fires, undefined otherwise
    const activeProv =
      currentActiveProv !== undefined
        ? currentActiveProv
        : activeProviderRef.current;
    if (eventName === "stage.started" && payload?.stageId === "image_gen") {
      m.set("entry", "active");
      m.set("llmRouter", "active");
    } else if (eventName === "image.category_selected") {
      m.set("llmRouter", "completed");
      const cat = payload?.category as string | undefined;
      if (cat) m.set(`branch_${cat}`, "active");
    } else if (eventName === "image.provider_selected") {
      const cat = payload?.category as string | undefined;
      if (cat) {
        m.set(`branch_${cat}`, "completed");
        // If img2img and vision is enabled, start vision phase
        if (cat === "img2img" && visionConfig.enabled) m.set("vision", "active");
      }
    } else if (eventName === "vision.described") {
      m.set("vision", "completed");
    } else if (eventName === "image.gen_started") {
      const prov = payload?.provider as string | undefined;
      const cat = payload?.category as string | undefined;
      if (prov && cat) {
        m.set(`provider_${cat}_${prov}`, "active");
        m.set("entry", "active");
        return `provider_${cat}_${prov}`;
      }
    } else if (eventName === "image.gen_completed") {
      const prov = payload?.provider as string | undefined;
      const cat = payload?.category as string | undefined;
      if (prov && cat) m.set(`provider_${cat}_${prov}`, "completed");
      m.set("entry", "completed");
    } else if (eventName === "image.gen_failed") {
      const prov = payload?.provider as string | undefined;
      const cat = payload?.category as string | undefined;
      if (prov && cat) m.set(`provider_${cat}_${prov}`, "failed");
      m.set("entry", "failed");
    } else if (eventName === "stage.completed" && payload?.stageId === "image_gen") {
      m.set("entry", "completed");
      m.set("llmRouter", "completed");
      if (activeProv) m.set(activeProv, "completed");
      if (m.get("vision") === "active") m.set("vision", "completed");
    } else if (eventName === "stage.failed" && payload?.stageId === "image_gen") {
      m.set("entry", "failed");
      m.set("llmRouter", "failed");
      if (activeProv) m.set(activeProv, "failed");
      if (m.get("vision") === "active") m.set("vision", "failed");
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
      if ("type" in raw && raw.type === "trace_replay") {
        const replayedStatuses = new Map<string, NodeStatus>();
        const replayedTimes = new Map<string, NodeTime>();
        let replayedActive: string | null = null;
        const replayedExecMap = new Map<string, ExecInfo>();
        let replayedPendingPrompt = "";
        for (const evt of (raw.events ?? []) as StageEvent[]) {
          if (evt.eventName === "image.gen_started" && evt.payload?.prompt) {
            replayedPendingPrompt = evt.payload.prompt as string;
          }
          if (evt.eventName === "image.provider_selected" && evt.payload?.provider) {
            const prov = evt.payload.provider as string;
            const cat = (evt.payload.category as string | undefined) ?? "text2img";
            const prompt = (evt.payload.prompt as string | undefined) ?? replayedPendingPrompt;
            replayedExecMap.set(`provider_${cat}_${prov}`, {
              prompt,
              reasoning: (evt.payload.reasoning as string) ?? "",
              ts: evt.ts,
            });
            replayedPendingPrompt = "";
          }
          applyTimeEvent(
            evt.eventName,
            evt.payload,
            evt.ts,
            replayedTimes,
            replayedActive ?? undefined,
          );
          const newActive = applyImageEvent(
            evt.eventName,
            evt.payload,
            replayedStatuses,
            replayedActive,
          );
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
      if (eventName === "image.gen_started" && payload?.prompt) {
        pendingPromptRef.current = payload.prompt as string;
      }

      // Track which provider was selected and what prompt was sent
      if (eventName === "image.provider_selected" && payload?.provider) {
        const prov = payload.provider as string;
        const cat = (payload.category as string | undefined) ?? "text2img";
        const prompt =
          (payload.prompt as string | undefined) ??
          pendingPromptRef.current ??
          "";
        pendingPromptRef.current = null;
        setExecInfoMap((prev) => {
          const next = new Map(prev);
          next.set(`provider_${cat}_${prov}`, {
            prompt,
            reasoning: (payload.reasoning as string) ?? "",
            ts: ts ?? Date.now(),
          });
          return next;
        });
      }

      // Track timing (pass active provider so stage.completed can close its timing)
      setNodeTimes((prev) => {
        const t = new Map(prev);
        applyTimeEvent(
          eventName,
          payload,
          ts ?? Date.now(),
          t,
          activeProviderRef.current ?? undefined,
        );
        return t;
      });

      let newActiveProvider: string | null | undefined;
      setNodeStatuses((prev) => {
        const m = new Map(prev);
        newActiveProvider = applyImageEvent(eventName, payload, m);
        return m;
      });

      if (newActiveProvider !== undefined)
        setActiveProviderId(newActiveProvider);
    });

    sseCleanupRef.current = cleanup;
    return () => {
      sseCleanupRef.current?.();
      sseCleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, conversationId]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleToggle(category: string, name: string, enabled: boolean) {
    setCategories((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        providers: (prev[category]?.providers ?? []).map((p) =>
          p.name === name ? { ...p, enabled } : p,
        ),
      },
    }));
    try {
      await updateImageCategoryProvider(baseUrl, category, name, { enabled });
    } catch {
      // revert on error
      setCategories((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          providers: (prev[category]?.providers ?? []).map((p) =>
            p.name === name ? { ...p, enabled: !enabled } : p,
          ),
        },
      }));
    }
  }

  async function handleAdd() {
    if (!addingInCategory) return;
    setSaving(true);
    try {
      const result = await addImageCategoryProvider(baseUrl, addingInCategory, {
        name: form.name,
        label: form.name.replace(/_/g, " "),
        executionMode: form.executionMode as "cloud" | "local",
        description: form.description,
        timeoutMs: form.timeoutMs,
        workflowPath: form.workflowPath || null,
        enabled: true,
      });
      setCategories((prev) => ({
        ...prev,
        [addingInCategory]: {
          ...prev[addingInCategory],
          providers: [...(prev[addingInCategory]?.providers ?? []), result.provider],
        },
      }));
      setAddingInCategory(null);
      setForm({
        name: "",
        executionMode: "local",
        workflowPath: "",
        description: "",
        timeoutMs: 300000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingProviderName || !editingCategory) return;
    setSavingEdit(true);
    try {
      const { provider: updated } = await updateImageCategoryProvider(
        baseUrl,
        editingCategory,
        editingProviderName,
        {
          label: editForm.label,
          description: editForm.description,
          workflowPath: editForm.workflowPath || null,
          timeoutMs: editForm.timeoutMs,
          model: editForm.model || null,
        },
      );
      setCategories((prev) => ({
        ...prev,
        [editingCategory]: {
          ...prev[editingCategory],
          providers: (prev[editingCategory]?.providers ?? []).map((p) =>
            p.name === editingProviderName ? updated : p,
          ),
        },
      }));
      setEditingProviderName(null);
      setEditingCategory(null);
      setConfirmDelete(false);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteWorkflow() {
    if (!editingProviderName || !editingCategory) return;
    setDeletingWorkflow(true);
    try {
      await deleteImageCategoryProvider(baseUrl, editingCategory, editingProviderName);
      setCategories((prev) => ({
        ...prev,
        [editingCategory]: {
          ...prev[editingCategory],
          providers: (prev[editingCategory]?.providers ?? []).filter(
            (p) => p.name !== editingProviderName,
          ),
        },
      }));
      setEditingProviderName(null);
      setEditingCategory(null);
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
        categories,
        routerConfig,
        visionConfig,
        handleToggle,
        (cat) => setAddingInCategory(cat),
        () => {
          setRouterPanelOpen(true);
          setVisionPanelOpen(false);
          setEditingProviderName(null);
          setEditingCategory(null);
        },
        () => {
          setVisionPanelOpen(true);
          setRouterPanelOpen(false);
          setEditingProviderName(null);
          setEditingCategory(null);
        },
        (category, name) => {
          setEditingCategory(category);
          setEditingProviderName(name);
          setAddingInCategory(null);
          setRouterPanelOpen(false);
          setVisionPanelOpen(false);
          setFallbackPanelCategory(null);
        },
        (category) => {
          const existing = categories[category]?.fallback;
          setFallbackForm(existing ?? { name: "", label: "", executionMode: "cloud", timeoutMs: 60000 });
          setFallbackPanelCategory(category);
          setEditingProviderName(null);
          setEditingCategory(null);
          setRouterPanelOpen(false);
          setVisionPanelOpen(false);
          setAddingInCategory(null);
        },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, routerConfig, visionConfig],
  );

  const liveNodes = useMemo(() => {
    const now = Date.now();
    const globalLocalTimeoutMs =
      definition?.resourcePolicy?.localTimeoutMs ?? 90_000;
    const routerLimitMs = routerConfig?.timeoutMs ?? 20_000;

    return baseNodes.map((n) => {
      const status = nodeStatuses.get(n.id) ?? "idle";
      const isActiveProvider = n.id === activeProviderId;
      const t = nodeTimes.get(n.id);
      const durationMs = t
        ? t.endTs !== undefined
          ? t.endTs - t.startTs
          : status === "active"
            ? now - t.startTs
            : undefined
        : undefined;
      // Per-node timeout limit
      let limitMs: number | undefined;
      if (n.id === "vision" || n.id === "visionFallback") {
        limitMs = visionConfig.timeoutMs ?? 60_000;
      } else if (n.id === "llmRouter") {
        limitMs = routerLimitMs;
      } else if (n.id.startsWith("branch_")) {
        limitMs = routerLimitMs;
      } else if (n.id.startsWith("provider_")) {
        // id format: provider_{category}_{name}
        const withoutPrefix = n.id.slice("provider_".length);
        const [cat, ...nameParts] = withoutPrefix.split("_");
        const provName = nameParts.join("_");
        const prov = (categories[cat]?.providers ?? []).find((p) => p.name === provName);
        limitMs = prov?.timeoutMs ?? globalLocalTimeoutMs;
      }
      const base = {
        ...n,
        data: {
          ...n.data,
          status,
          isActiveProvider,
          durationMs,
          limitMs,
          ...(execInfoMap.has(n.id)
            ? { lastExecution: execInfoMap.get(n.id) }
            : {}),
        },
      };
      // Inject animated style into default 'entry' node
      if (n.id === "entry") {
        base.style = {
          ...n.style,
          border:
            status === "completed"
              ? "1.5px solid #22c55ecc"
              : status === "failed"
                ? "1.5px solid #ef4444cc"
                : "1.5px solid #f97316",
          boxShadow: status === "active" ? "0 0 18px #f97316" : "none",
          animation:
            status === "active"
              ? "nodeGlowOrange 1.1s ease-in-out infinite alternate"
              : undefined,
        };
      }
      return base;
    });
  }, [
    baseNodes,
    nodeStatuses,
    activeProviderId,
    execInfoMap,
    nodeTimes,
    definition,
    routerConfig,
    visionConfig,
    categories,
    tick,
  ]);

  // ─── Highlight execution path on edges ────────────────────────────────────

  const liveEdges = useMemo(() => {
    const llmRouterStatus = nodeStatuses.get("llmRouter") ?? "idle";
    const text2imgBranchStatus = nodeStatuses.get("branch_text2img") ?? "idle";
    const img2imgBranchStatus = nodeStatuses.get("branch_img2img") ?? "idle";
    const visionStatus = nodeStatuses.get("vision") ?? "idle";
    const visionFallbackStatus = nodeStatuses.get("visionFallback") ?? "idle";
    const llmRouterActive = llmRouterStatus !== "idle";
    const text2imgActive = text2imgBranchStatus !== "idle";
    const img2imgActive = img2imgBranchStatus !== "idle";
    const visionActive = visionStatus !== "idle";
    const visionFallbackActive = visionFallbackStatus !== "idle";
    const selectedProv = activeProviderId;

    return edges.map((e) => {
      if (e.id === "entry→llmRouter" && llmRouterActive) {
        return { ...e, animated: true, style: { ...e.style, stroke: "#22d3eedd", strokeWidth: 2.5 } };
      }
      if (e.id === "llmRouter→branch_text2img" && text2imgActive) {
        return { ...e, animated: true, style: { ...e.style, stroke: "#f97316dd", strokeWidth: 2.5 } };
      }
      if (e.id === "llmRouter→branch_img2img" && img2imgActive) {
        return { ...e, animated: true, style: { ...e.style, stroke: "#a855f7dd", strokeWidth: 2.5 } };
      }
      if (e.id === "branch_img2img→vision" && visionActive) {
        return { ...e, animated: true, style: { ...e.style, stroke: "#a855f7dd", strokeWidth: 2, strokeDasharray: undefined } };
      }
      if (e.id === "branch_img2img→visionFallback" && visionFallbackActive) {
        return { ...e, animated: true, style: { ...e.style, stroke: "#a855f7bb", strokeWidth: 2, strokeDasharray: undefined } };
      }
      if (selectedProv && e.target === selectedProv) {
        const isCloud = e.style?.stroke?.toString().includes("22d3ee");
        return {
          ...e,
          animated: true,
          style: { ...e.style, stroke: isCloud ? "#22d3eedd" : (selectedProv.includes("img2img") ? "#a855f7dd" : "#f97316dd"), strokeWidth: 3 },
        };
      }
      return e;
    });
  }, [edges, nodeStatuses, activeProviderId]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#0a0a0f",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: 44,
          paddingLeft: 12,
          paddingRight: 12,
          flexShrink: 0,
          background: "#0a0014",
          borderBottom: "1px solid #22d3ee22",
        }}
      >
        {/* Back button */}
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: "1px solid #ffffff22",
            color: "#ffffff88",
            fontFamily: "monospace",
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 6,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          ← Voltar
        </button>

        {/* Title */}
        <span
          style={{
            flex: 1,
            fontFamily: "monospace",
            fontSize: 13,
            fontWeight: 700,
            color: "#22d3ee",
            letterSpacing: "0.12em",
          }}
        >
          ◈ IMAGE GENERATION
        </span>

        {/* Scan Pasta button */}
        <button
          onClick={() => setScanPanelOpen((v) => !v)}
          style={{
            background: scanPanelOpen ? "#22d3ee22" : "transparent",
            border: `1px solid ${scanPanelOpen ? "#22d3ee66" : "#22d3ee33"}`,
            color: scanPanelOpen ? "#22d3ee" : "#22d3ee88",
            fontFamily: "monospace",
            fontSize: 11,
            padding: "4px 12px",
            borderRadius: 6,
            cursor: "pointer",
            flexShrink: 0,
            transition: "background 0.15s, color 0.15s",
          }}
        >
          📂 Scan Pasta
        </button>

        {/* Add buttons per category */}
        <button
          onClick={() => setAddingInCategory("text2img")}
          style={{
            background: "#f9731422",
            border: "1px solid #f9731466",
            color: "#f97316",
            fontFamily: "monospace",
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 6,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          + txt→img
        </button>
        <button
          onClick={() => setAddingInCategory("img2img")}
          style={{
            background: "#a855f722",
            border: "1px solid #a855f766",
            color: "#a855f7",
            fontFamily: "monospace",
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 6,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          + img→img
        </button>
      </div>

      {/* Scan Pasta panel */}
      <AnimatePresence>
        {scanPanelOpen && (
          <motion.div
            key="scan-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              overflow: "hidden",
              flexShrink: 0,
              background: "#00111a",
              borderBottom: "1px solid #22d3ee22",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {/* Folder input + scan button */}
              <div
                style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
              >
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, color: "#22d3ee88" }}>
                    Pasta de workflows do ComfyUI
                  </label>
                  <input
                    style={{
                      ...inputStyle,
                      borderColor: "#22d3ee33",
                      background: "#001522",
                    }}
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
                      background: scanning ? "#001522" : "#22d3ee22",
                      border: `1px solid ${scanning ? "#22d3ee22" : "#22d3ee55"}`,
                      color: scanning ? "#22d3ee55" : "#22d3ee",
                      fontFamily: "monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "7px 14px",
                      borderRadius: 6,
                      cursor: scanning ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {scanning ? "⟳ Escaneando…" : "⟳ Escanear"}
                  </button>
                </div>
              </div>

              {scanError && (
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    color: "#ef4444",
                    background: "#1a0000",
                    border: "1px solid #ef444433",
                    borderRadius: 6,
                    padding: "6px 10px",
                  }}
                >
                  {scanError}
                </div>
              )}

              {/* Discovered workflows list */}
              {Object.keys(customWf.discovered).length > 0 && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 9,
                      color: "#22d3ee66",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {Object.keys(customWf.discovered).length} workflow(s)
                    encontrado(s)
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      maxHeight: 260,
                      overflowY: "auto",
                    }}
                  >
                    {Object.entries(customWf.discovered).map(
                      ([name, entry]) => {
                        const isApi = entry.format === "api";
                        const isSaving = savingWf === name;
                        return (
                          <div
                            key={name}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              background: entry.enabled ? "#001a10" : "#0a0a0a",
                              border: `1px solid ${entry.enabled ? "#22c55e33" : "#ffffff11"}`,
                              borderRadius: 6,
                              padding: "7px 10px",
                              opacity: isSaving ? 0.6 : 1,
                              transition: "opacity 0.15s",
                            }}
                          >
                            {/* Format badge */}
                            <span
                              title={
                                isApi
                                  ? "Formato API — pronto para execução"
                                  : `Formato ${entry.format} — não executável diretamente`
                              }
                              style={{
                                fontSize: 8,
                                fontFamily: "monospace",
                                background: isApi ? "#22c55e22" : "#f9731622",
                                color: isApi ? "#22c55e" : "#f97316",
                                border: `1px solid ${isApi ? "#22c55e44" : "#f9731644"}`,
                                borderRadius: 4,
                                padding: "1px 5px",
                                flexShrink: 0,
                              }}
                            >
                              {isApi ? "✓ API" : `⚠ ${entry.format ?? "UI"}`}
                            </span>

                            {/* Name */}
                            <span
                              style={{
                                fontFamily: "monospace",
                                fontSize: 10,
                                color: entry.enabled ? "#22c55e" : "#ffffff88",
                                flex: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {name}
                            </span>

                            {/* Gen type selector — only for API format */}
                            {isApi && (
                              <select
                                value={entry.generationType ?? "txt2img"}
                                onChange={(e) =>
                                  handleSetCustomWfType(
                                    name,
                                    e.target.value as "txt2img" | "img2img",
                                  )
                                }
                                disabled={isSaving}
                                style={{
                                  background: "#001a10",
                                  color: "#22c55eaa",
                                  border: "1px solid #22c55e22",
                                  borderRadius: 4,
                                  fontFamily: "monospace",
                                  fontSize: 9,
                                  padding: "2px 4px",
                                  cursor: isSaving ? "not-allowed" : "pointer",
                                  flexShrink: 0,
                                }}
                              >
                                <option value="txt2img">txt→img</option>
                                <option value="img2img">img→img</option>
                              </select>
                            )}

                            {/* Toggle enable */}
                            <button
                              onClick={() => {
                                if (!isSaving && isApi)
                                  handleToggleCustomWf(name, entry);
                              }}
                              disabled={isSaving || !isApi}
                              title={
                                !isApi
                                  ? "Só workflows no formato API podem ser ativados"
                                  : entry.enabled
                                    ? "Desativar"
                                    : "Ativar"
                              }
                              style={{
                                background: "transparent",
                                border: "none",
                                cursor:
                                  isSaving || !isApi
                                    ? "not-allowed"
                                    : "pointer",
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                opacity: !isApi ? 0.35 : 1,
                                flexShrink: 0,
                              }}
                            >
                              {entry.enabled ? (
                                <ToggleRight
                                  size={18}
                                  style={{ color: "#22c55e" }}
                                />
                              ) : (
                                <ToggleLeft
                                  size={18}
                                  style={{ color: "#555555" }}
                                />
                              )}
                            </button>
                          </div>
                        );
                      },
                    )}
                  </div>
                  {Object.values(customWf.discovered).some(
                    (e) => e.format !== "api",
                  ) && (
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: 8,
                        color: "#f9731688",
                        lineHeight: 1.5,
                      }}
                    >
                      ⚠ Workflows com formato UI precisam ser exportados em
                      formato API pelo ComfyUI (Save → Export API).
                    </div>
                  )}
                </div>
              )}

              {Object.keys(customWf.discovered).length === 0 &&
                !scanning &&
                customWf.folder && (
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      color: "#ffffff33",
                      fontStyle: "italic",
                    }}
                  >
                    Nenhum workflow encontrado. Clique em Escanear para
                    atualizar.
                  </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* ReactFlow canvas */}
        <div style={{ flex: 1, position: "relative" }}>
          {loading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                fontFamily: "monospace",
                fontSize: 12,
                color: "#f97316",
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
                    background: "#0a0014",
                    border: "1px solid #22d3ee33",
                    color: "#22d3ee",
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
                position: "absolute",
                top: 16,
                left: "50%",
                transform: "translateX(-50%)",
                background: "#0a1a00",
                border: "1px solid #22c55e66",
                borderRadius: 10,
                padding: "14px 20px",
                fontFamily: "monospace",
                fontSize: 11,
                color: "#22c55e",
                zIndex: 20,
                minWidth: 320,
                boxShadow: "0 4px 24px #000000aa",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                ✓ Workflow criado!
              </div>
              <div
                style={{ color: "#ffffff88", fontSize: 10, marginBottom: 4 }}
              >
                Adicione ao .env:
              </div>
              <code
                style={{
                  display: "block",
                  background: "#000000aa",
                  color: "#22d3ee",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 10,
                  wordBreak: "break-all",
                  marginBottom: 10,
                }}
              >
                {createdEnvVar}
              </code>
              <div style={{ display: "flex", gap: 8 }}>
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
                    background: "#22c55e22",
                    border: "1px solid #22c55e55",
                    color: "#22c55e",
                    fontFamily: "monospace",
                    fontSize: 10,
                    padding: "4px 12px",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  {copied ? "✓ Copiado" : "Copiar"}
                </button>
                <button
                  onClick={() => setCreatedEnvVar(null)}
                  style={{
                    background: "#ffffff11",
                    border: "1px solid #ffffff22",
                    color: "#ffffff88",
                    fontFamily: "monospace",
                    fontSize: 10,
                    padding: "4px 12px",
                    borderRadius: 6,
                    cursor: "pointer",
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
          {editingProviderName &&
            (() => {
              const editingProvider = (
                categories[editingCategory ?? ""]?.providers ?? []
              ).find((p) => p.name === editingProviderName);
              const accentColor =
                editingProvider?.executionMode === "cloud"
                  ? "#22d3ee"
                  : editingCategory === "img2img"
                    ? "#a855f7"
                    : "#f97316";
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
                    background: "#0a0a00",
                    borderLeft: `1px solid ${accentColor}33`,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <ResizeHandle
                    onMouseDown={onResizeMouseDown}
                    color={accentColor}
                  />
                  {/* Fixed header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 16px",
                      borderBottom: `1px solid ${accentColor}22`,
                      flexShrink: 0,
                      background: "#0a0a00",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>✎</span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          fontWeight: 700,
                          color: accentColor,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {editingProvider?.label ?? editingProviderName}
                      </div>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: 8,
                          color: "#ffffff33",
                          marginTop: 1,
                        }}
                      >
                        {editingProviderName}
                      </div>
                    </div>
                    {/* Zoom controls */}
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <button
                        onClick={() =>
                          setPanelZoom((z) =>
                            Math.max(0.7, +(z - 0.1).toFixed(1)),
                          )
                        }
                        title="Diminuir zoom"
                        style={{
                          background: "#ffffff11",
                          border: "1px solid #ffffff22",
                          color: "#ffffff66",
                          fontFamily: "monospace",
                          fontSize: 12,
                          width: 22,
                          height: 22,
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
                          fontSize: 9,
                          color: "#ffffff44",
                          minWidth: 28,
                          textAlign: "center",
                        }}
                      >
                        {Math.round(panelZoom * 100)}%
                      </span>
                      <button
                        onClick={() =>
                          setPanelZoom((z) =>
                            Math.min(2, +(z + 0.1).toFixed(1)),
                          )
                        }
                        title="Aumentar zoom"
                        style={{
                          background: "#ffffff11",
                          border: "1px solid #ffffff22",
                          color: "#ffffff66",
                          fontFamily: "monospace",
                          fontSize: 12,
                          width: 22,
                          height: 22,
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
                      onClick={() => {
                        setEditingProviderName(null);
                        setEditingCategory(null);
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ffffff44",
                        fontSize: 18,
                        cursor: "pointer",
                        padding: 0,
                        lineHeight: 1,
                        marginLeft: 2,
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Scrollable content with zoom */}
                  <div style={{ overflowY: "auto", flex: 1 }}>
                    <div
                      style={{
                        zoom: panelZoom,
                        padding: 20,
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                      }}
                    >
                      {/* Label */}
                      <div>
                        <label
                          style={{ ...labelStyle, color: `${accentColor}aa` }}
                        >
                          Nome de exibição
                        </label>
                        <input
                          style={{
                            ...inputStyle,
                            borderColor: `${accentColor}33`,
                          }}
                          value={editForm.label}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              label: e.target.value,
                            }))
                          }
                          placeholder="Nome exibido no canvas"
                        />
                      </div>

                      {/* Caminho do workflow */}
                      <div>
                        <label
                          style={{ ...labelStyle, color: `${accentColor}aa` }}
                        >
                          Caminho do workflow
                        </label>
                        <input
                          style={{
                            ...inputStyle,
                            borderColor: `${accentColor}33`,
                          }}
                          value={editForm.workflowPath}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              workflowPath: e.target.value,
                            }))
                          }
                          placeholder="/workflows/meu_workflow.json"
                        />
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 8,
                            color: "#ffffff22",
                            fontFamily: "monospace",
                          }}
                        >
                          Caminho absoluto para o arquivo .json exportado do
                          ComfyUI.
                        </div>
                      </div>

                      {/* Descrição para o LLM */}
                      <div>
                        <label
                          style={{ ...labelStyle, color: `${accentColor}aa` }}
                        >
                          Descrição para o LLM
                        </label>
                        <textarea
                          style={{
                            ...inputStyle,
                            borderColor: `${accentColor}33`,
                            resize: "vertical",
                            minHeight: 60,
                          }}
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              description: e.target.value,
                            }))
                          }
                          placeholder="Descreva quando este workflow deve ser usado…"
                        />
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 8,
                            color: "#ffffff22",
                            fontFamily: "monospace",
                          }}
                        >
                          O orquestrador usa este texto para decidir qual
                          workflow escolher.
                        </div>
                      </div>

                      {/* Timeout */}
                      <div>
                        <label
                          style={{ ...labelStyle, color: `${accentColor}aa` }}
                        >
                          Timeout (ms)
                        </label>
                        <input
                          type="number"
                          step={1000}
                          style={{
                            ...inputStyle,
                            borderColor: `${accentColor}33`,
                            width: 140,
                          }}
                          value={editForm.timeoutMs}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v))
                              setEditForm((f) => ({ ...f, timeoutMs: v }));
                          }}
                        />
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 8,
                            color: "#ffffff22",
                            fontFamily: "monospace",
                          }}
                        >
                          Timeout para este workflow específico. Substitui o
                          timeout padrão local do resourcePolicy.
                        </div>
                      </div>

                      {/* Actions */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          marginTop: 4,
                        }}
                      >
                        <button
                          onClick={handleSaveEdit}
                          disabled={savingEdit}
                          style={{
                            background: savingEdit
                              ? "#1a0a00"
                              : `${accentColor}22`,
                            border: `1px solid ${savingEdit ? `${accentColor}33` : `${accentColor}66`}`,
                            color: savingEdit
                              ? `${accentColor}77`
                              : accentColor,
                            fontFamily: "monospace",
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "8px 0",
                            borderRadius: 6,
                            cursor: savingEdit ? "not-allowed" : "pointer",
                            letterSpacing: "0.06em",
                            transition: "background 0.15s",
                          }}
                        >
                          {savingEdit ? "Salvando…" : "Salvar alterações"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingProviderName(null);
                            setEditingCategory(null);
                            setConfirmDelete(false);
                          }}
                          style={{
                            background: "transparent",
                            border: "1px solid #ffffff22",
                            color: "#ffffff44",
                            fontFamily: "monospace",
                            fontSize: 10,
                            padding: "6px 0",
                            borderRadius: 6,
                            cursor: "pointer",
                          }}
                        >
                          Cancelar
                        </button>

                        {/* Delete section */}
                        <div
                          style={{
                            marginTop: 4,
                            borderTop: "1px solid #ff000022",
                            paddingTop: 10,
                          }}
                        >
                          {!confirmDelete ? (
                            <button
                              onClick={() => setConfirmDelete(true)}
                              style={{
                                width: "100%",
                                background: "transparent",
                                border: "1px solid #ef444433",
                                color: "#ef444488",
                                fontFamily: "monospace",
                                fontSize: 10,
                                padding: "6px 0",
                                borderRadius: 6,
                                cursor: "pointer",
                                letterSpacing: "0.04em",
                                transition: "border-color 0.15s, color 0.15s",
                              }}
                            >
                              ✕ Excluir workflow
                            </button>
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                              }}
                            >
                              <div
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: 9,
                                  color: "#ef4444bb",
                                  textAlign: "center",
                                  padding: "4px 0",
                                  lineHeight: 1.5,
                                }}
                              >
                                Tem certeza? Esta ação não pode ser desfeita.
                              </div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  onClick={handleDeleteWorkflow}
                                  disabled={deletingWorkflow}
                                  style={{
                                    flex: 1,
                                    background: deletingWorkflow
                                      ? "#1a0000"
                                      : "#ef444422",
                                    border: "1px solid #ef444466",
                                    color: deletingWorkflow
                                      ? "#ef444455"
                                      : "#ef4444",
                                    fontFamily: "monospace",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "6px 0",
                                    borderRadius: 6,
                                    cursor: deletingWorkflow
                                      ? "not-allowed"
                                      : "pointer",
                                  }}
                                >
                                  {deletingWorkflow
                                    ? "Excluindo…"
                                    : "Sim, excluir"}
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(false)}
                                  disabled={deletingWorkflow}
                                  style={{
                                    flex: 1,
                                    background: "transparent",
                                    border: "1px solid #ffffff22",
                                    color: "#ffffff44",
                                    fontFamily: "monospace",
                                    fontSize: 10,
                                    padding: "6px 0",
                                    borderRadius: 6,
                                    cursor: deletingWorkflow
                                      ? "not-allowed"
                                      : "pointer",
                                  }}
                                >
                                  Não
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* end zoom */}
                  </div>
                  {/* end scroll */}
                </motion.div>
              );
            })()}
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
                background: "#080f12",
                borderLeft: "1px solid #22d3ee44",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <ResizeHandle onMouseDown={onResizeMouseDown} color="#22d3ee" />
              {/* Header + zoom */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 16px",
                  borderBottom: "1px solid #22d3ee22",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 14 }}>🤖</span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#22d3ee",
                    letterSpacing: "0.08em",
                    flex: 1,
                  }}
                >
                  LLM Router
                </span>
                {/* Zoom controls */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    onClick={() =>
                      setPanelZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))
                    }
                    title="Diminuir zoom"
                    style={{
                      background: "#ffffff11",
                      border: "1px solid #ffffff22",
                      color: "#ffffff66",
                      fontFamily: "monospace",
                      fontSize: 12,
                      width: 22,
                      height: 22,
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
                      fontSize: 9,
                      color: "#ffffff44",
                      minWidth: 28,
                      textAlign: "center",
                    }}
                  >
                    {Math.round(panelZoom * 100)}%
                  </span>
                  <button
                    onClick={() =>
                      setPanelZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))
                    }
                    title="Aumentar zoom"
                    style={{
                      background: "#ffffff11",
                      border: "1px solid #ffffff22",
                      color: "#ffffff66",
                      fontFamily: "monospace",
                      fontSize: 12,
                      width: 22,
                      height: 22,
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
                  onClick={() => setRouterPanelOpen(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#ffffff44",
                    fontSize: 18,
                    cursor: "pointer",
                    padding: 0,
                    lineHeight: 1,
                    marginLeft: 2,
                  }}
                >
                  ×
                </button>
              </div>

              {/* Scrollable content */}
              <div style={{ overflowY: "auto", flex: 1 }}>
                <div
                  style={{
                    zoom: panelZoom,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  }}
                >
                  {/* What is it */}
                  <Section title="O que é o LLM Router?" color="#22d3ee">
                    <p style={infoText}>
                      Quando há múltiplos workflows habilitados que aceitam os
                      mesmos tipos de entrada (ex: dois workflows img2img), um
                      LLM leve analisa o{" "}
                      <strong style={{ color: "#f97316" }}>prompt</strong> e a{" "}
                      <strong style={{ color: "#22d3ee" }}>descrição</strong> de
                      cada workflow para decidir qual é mais adequado ao pedido
                      do cliente.
                    </p>
                    <div
                      style={{ ...infoText, marginTop: 8, color: "#ffffff44" }}
                    >
                      Se o modelo estiver vazio, a seleção é{" "}
                      <em>determinística</em>: o dispatcher usa apenas
                      disponibilidade e prioridade numérica.
                    </div>
                  </Section>

                  <div
                    style={{ borderTop: "1px solid #22d3ee22", paddingTop: 16 }}
                  >
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: 9,
                        color: "#22d3eeaa",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginBottom: 14,
                      }}
                    >
                      Configuração
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                      }}
                    >
                      {/* Model */}
                      <div>
                        <label style={{ ...labelStyle, color: "#22d3eeaa" }}>
                          Modelo LLM
                        </label>
                        <ModelSelector
                          baseUrl={baseUrl}
                          provider={routerForm.provider}
                          value={routerForm.model}
                          onChange={(m) =>
                            setRouterForm((f) => ({ ...f, model: m }))
                          }
                          color="#22d3ee"
                        />
                      </div>

                      {/* Provider */}
                      <div>
                        <label style={{ ...labelStyle, color: "#22d3eeaa" }}>
                          Provider
                        </label>
                        <select
                          style={{
                            ...inputStyle,
                            borderColor: "#22d3ee33",
                            cursor: "pointer",
                          }}
                          value={routerForm.provider}
                          onChange={(e) =>
                            setRouterForm((f) => ({
                              ...f,
                              provider: e.target.value,
                            }))
                          }
                        >
                          <option value="ollama">ollama (local)</option>
                          <option value="anthropic">anthropic (cloud)</option>
                          <option value="openai">openai (cloud)</option>
                          <option value="xai">xai (cloud)</option>
                        </select>
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 8,
                            color: "#ffffff33",
                            fontFamily: "monospace",
                          }}
                        >
                          Cloud providers exigem API key configurada no .env.
                        </div>
                      </div>

                      {/* Timeout */}
                      <div>
                        <label style={{ ...labelStyle, color: "#22d3eeaa" }}>
                          Timeout (ms)
                        </label>
                        <input
                          type="number"
                          style={{
                            ...inputStyle,
                            borderColor: "#22d3ee33",
                            width: 120,
                          }}
                          value={routerForm.timeoutMs || ""}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            setRouterForm((f) => ({
                              ...f,
                              timeoutMs: isNaN(v) ? 0 : v,
                            }));
                          }}
                          onBlur={(e) => {
                            const v = parseInt(e.target.value, 10);
                            const clamped = isNaN(v)
                              ? 1000
                              : Math.min(120000, Math.max(1000, v));
                            setRouterForm((f) => ({
                              ...f,
                              timeoutMs: clamped,
                            }));
                          }}
                        />
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 8,
                            color: "#ffffff33",
                            fontFamily: "monospace",
                          }}
                        >
                          Se o LLM não responder no tempo, a seleção cai para
                          determinística.
                        </div>
                      </div>

                      {/* Save Router */}
                      <button
                        onClick={handleSaveRouter}
                        disabled={savingRouter}
                        style={{
                          background: savingRouter ? "#001522" : "#22d3ee22",
                          border: `1px solid ${savingRouter ? "#22d3ee33" : "#22d3ee66"}`,
                          color: savingRouter ? "#22d3ee77" : "#22d3ee",
                          fontFamily: "monospace",
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "8px 0",
                          borderRadius: 6,
                          cursor: savingRouter ? "not-allowed" : "pointer",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {savingRouter ? "Salvando…" : "Salvar configuração"}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vision Descriptor panel */}
        <AnimatePresence>
          {visionPanelOpen && (
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{
                width: panelWidth,
                flexShrink: 0,
                background: "#080f12",
                borderLeft: "1px solid #a855f744",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <ResizeHandle onMouseDown={onResizeMouseDown} color="#a855f7" />
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 16px",
                  borderBottom: "1px solid #a855f722",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 14 }}>👁</span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#a855f7",
                    letterSpacing: "0.08em",
                    flex: 1,
                  }}
                >
                  Vision Descriptor
                </span>
                <button
                  onClick={() => setVisionPanelOpen(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#ffffff44",
                    cursor: "pointer",
                    fontSize: 16,
                    lineHeight: 1,
                    padding: 4,
                  }}
                >
                  ×
                </button>
              </div>

              {/* Scrollable content */}
              <div
                style={{
                  overflowY: "auto",
                  flex: 1,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <Section title="👁 Vision Descriptor" color="#a855f7">
                  <p style={infoText}>
                    Descreve imagens de referência usando um modelo{" "}
                    <strong style={{ color: "#a855f7" }}>multimodal</strong>{" "}
                    antes de construir o prompt para o ComfyUI. O modelo vision
                    analisa a foto do cliente e gera uma descrição detalhada
                    (cabelo, pele, traços, roupa) que substitui o texto genérico{" "}
                    <em style={{ color: "#f97316" }}>
                      "Transform the person from the reference photo"
                    </em>
                    .
                  </p>
                  <div
                    style={{ ...infoText, marginTop: 6, color: "#ffffff33" }}
                  >
                    Apenas modelos com capacidade multimodal aparecem no seletor
                    abaixo. Modelos locais (Ollama) mantêm o lock de GPU durante
                    a chamada.
                  </div>
                </Section>

                <div
                  style={{ borderTop: "1px solid #a855f722", paddingTop: 16 }}
                >
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 9,
                      color: "#a855f7aa",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 14,
                    }}
                  >
                    Configuração
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    {/* Enable toggle */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <button
                        onClick={() =>
                          setVisionForm((f) => ({
                            ...f,
                            enabled: !f.enabled,
                          }))
                        }
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {visionForm.enabled ? (
                          <ToggleRight size={22} style={{ color: "#a855f7" }} />
                        ) : (
                          <ToggleLeft size={22} style={{ color: "#555555" }} />
                        )}
                      </button>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 10,
                          color: visionForm.enabled ? "#a855f7" : "#555555",
                        }}
                      >
                        {visionForm.enabled ? "Habilitado" : "Desabilitado"}
                      </span>
                    </div>

                    {/* Provider */}
                    <div>
                      <label style={{ ...labelStyle, color: "#a855f7aa" }}>
                        Provider (vision)
                      </label>
                      <select
                        style={{
                          ...inputStyle,
                          borderColor: "#a855f733",
                          cursor: "pointer",
                        }}
                        value={visionForm.provider}
                        onChange={(e) =>
                          setVisionForm((f) => ({
                            ...f,
                            provider: e.target.value,
                            model: "",
                          }))
                        }
                      >
                        <option value="ollama">ollama (local — GPU lock)</option>
                        <option value="anthropic">anthropic (cloud)</option>
                        <option value="openai">openai (cloud)</option>
                      </select>
                    </div>

                    {/* Model — only vision-capable */}
                    <div>
                      <label style={{ ...labelStyle, color: "#a855f7aa" }}>
                        Modelo vision
                      </label>
                      <ModelSelector
                        baseUrl={baseUrl}
                        provider={visionForm.provider}
                        value={visionForm.model ?? ""}
                        onChange={(m) =>
                          setVisionForm((f) => ({ ...f, model: m }))
                        }
                        color="#a855f7"
                        visionOnly
                      />
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 8,
                          color: "#ffffff33",
                          fontFamily: "monospace",
                          lineHeight: 1.5,
                        }}
                      >
                        Apenas modelos multimodais. Para Ollama: instale com{" "}
                        <code style={{ color: "#a855f7" }}>
                          ollama pull llama3.2-vision:11b
                        </code>
                        .
                      </div>
                    </div>

                    {/* Timeout */}
                    <div>
                      <label style={{ ...labelStyle, color: "#a855f7aa" }}>
                        Timeout (ms)
                      </label>
                      <input
                        type="number"
                        style={{
                          ...inputStyle,
                          borderColor: "#a855f733",
                          width: 120,
                        }}
                        value={visionForm.timeoutMs ?? 60000}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setVisionForm((f) => ({
                            ...f,
                            timeoutMs: isNaN(v) ? 60000 : v,
                          }));
                        }}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value, 10);
                          const clamped = isNaN(v)
                            ? 60000
                            : Math.min(300000, Math.max(5000, v));
                          setVisionForm((f) => ({
                            ...f,
                            timeoutMs: clamped,
                          }));
                        }}
                      />
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 8,
                          color: "#ffffff33",
                          fontFamily: "monospace",
                        }}
                      >
                        Se exceder o tempo, o prompt original é mantido (sem
                        falha crítica).
                      </div>
                    </div>

                    {/* Fallback provider */}
                    <div>
                      <label style={{ ...labelStyle, color: "#a855f7aa" }}>
                        Fallback provider
                      </label>
                      <select
                        style={{
                          ...inputStyle,
                          borderColor: "#a855f733",
                          cursor: "pointer",
                        }}
                        value={visionForm.fallback?.provider ?? "openai"}
                        onChange={(e) =>
                          setVisionForm((f) => ({
                            ...f,
                            fallback: {
                              ...f.fallback,
                              provider: e.target.value,
                              model: "",
                            },
                          }))
                        }
                      >
                        <option value="openai">openai (cloud)</option>
                        <option value="anthropic">anthropic (cloud)</option>
                        <option value="ollama">ollama (local)</option>
                      </select>
                    </div>

                    {/* Fallback model */}
                    <div>
                      <label style={{ ...labelStyle, color: "#a855f7aa" }}>
                        Modelo fallback
                      </label>
                      <ModelSelector
                        baseUrl={baseUrl}
                        provider={visionForm.fallback?.provider ?? "openai"}
                        value={visionForm.fallback?.model ?? ""}
                        onChange={(m) =>
                          setVisionForm((f) => ({
                            ...f,
                            fallback: { ...f.fallback, provider: f.fallback?.provider ?? "openai", model: m },
                          }))
                        }
                        color="#a855f7"
                        visionOnly
                      />
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 8,
                          color: "#ffffff33",
                          fontFamily: "monospace",
                        }}
                      >
                        Usado se o provider principal falhar ou não tiver modelo
                        configurado. Deixe vazio para desativar o fallback.
                      </div>
                    </div>

                    {/* Fallback timeout */}
                    <div>
                      <label style={{ ...labelStyle, color: "#a855f7aa" }}>
                        Timeout fallback (ms)
                      </label>
                      <input
                        type="number"
                        style={{
                          ...inputStyle,
                          borderColor: "#a855f733",
                          width: 120,
                        }}
                        value={visionForm.fallback?.timeoutMs ?? 30000}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setVisionForm((f) => ({
                            ...f,
                            fallback: {
                              ...f.fallback,
                              provider: f.fallback?.provider ?? "openai",
                              timeoutMs: isNaN(v) ? 30000 : v,
                            },
                          }));
                        }}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value, 10);
                          const clamped = isNaN(v)
                            ? 30000
                            : Math.min(300000, Math.max(5000, v));
                          setVisionForm((f) => ({
                            ...f,
                            fallback: {
                              ...f.fallback,
                              provider: f.fallback?.provider ?? "openai",
                              timeoutMs: clamped,
                            },
                          }));
                        }}
                      />
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 8,
                          color: "#ffffff33",
                          fontFamily: "monospace",
                        }}
                      >
                        Timeout exclusivo do fallback. Se exceder, o prompt
                        original é mantido.
                      </div>
                    </div>

                    {/* Save Vision */}
                    <button
                      onClick={handleSaveVision}
                      disabled={savingVision}
                      style={{
                        background: savingVision ? "#110022" : "#a855f722",
                        border: `1px solid ${savingVision ? "#a855f733" : "#a855f766"}`,
                        color: savingVision ? "#a855f777" : "#a855f7",
                        fontFamily: "monospace",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "8px 0",
                        borderRadius: 6,
                        cursor: savingVision ? "not-allowed" : "pointer",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {savingVision ? "Salvando…" : "Salvar vision descriptor"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add workflow form panel */}
        <AnimatePresence>
          {addingInCategory !== null && (
            <motion.div
              initial={{ x: 280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 280, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{
                width: panelWidth,
                flexShrink: 0,
                background: "#0a0014",
                borderLeft: `1px solid ${addingInCategory === "img2img" ? "#a855f733" : "#f9731433"}`,
                overflowY: "auto",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                position: "relative",
              }}
            >
              <ResizeHandle
                onMouseDown={onResizeMouseDown}
                color={addingInCategory === "img2img" ? "#a855f7" : "#f97316"}
              />
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  fontWeight: 700,
                  color: addingInCategory === "img2img" ? "#a855f7" : "#f97316",
                  letterSpacing: "0.08em",
                  marginBottom: 4,
                }}
              >
                Novo provider —{" "}
                {addingInCategory === "img2img" ? "img→img" : "txt→img"}
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
                      name: e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
                    }))
                  }
                />
              </div>

              {/* Execução */}
              <div>
                <label style={labelStyle}>Execução</label>
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
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
                    color: "#ffffff33",
                    fontFamily: "monospace",
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
                    resize: "vertical",
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
                    color: "#ffffff33",
                    fontFamily: "monospace",
                  }}
                >
                  O orquestrador usará este texto para decidir quando usar este
                  workflow.
                </div>
              </div>

              {/* Timeout */}
              <div>
                <label style={labelStyle}>Timeout (ms)</label>
                <input
                  type="number"
                  style={{ ...inputStyle, width: 140 }}
                  value={form.timeoutMs}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setForm((f) => ({ ...f, timeoutMs: isNaN(v) ? 90000 : v }));
                  }}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value, 10);
                    const clamped = isNaN(v)
                      ? 90000
                      : Math.max(5000, Math.min(300000, v));
                    setForm((f) => ({ ...f, timeoutMs: clamped }));
                  }}
                />
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 8,
                    color: "#ffffff33",
                    fontFamily: "monospace",
                  }}
                >
                  Timeout deste workflow. Substitui o timeout local padrão em
                  caso de execução local.
                </div>
              </div>

              {/* Actions */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <button
                  onClick={handleAdd}
                  disabled={saving || !form.name}
                  style={{
                    background:
                      saving || !form.name
                        ? "#1a001a88"
                        : addingInCategory === "img2img"
                          ? "#a855f722"
                          : "#f9731422",
                    border: `1px solid ${
                      saving || !form.name
                        ? "#a855f733"
                        : addingInCategory === "img2img"
                          ? "#a855f766"
                          : "#f9731466"
                    }`,
                    color:
                      saving || !form.name
                        ? "#a855f777"
                        : addingInCategory === "img2img"
                          ? "#a855f7"
                          : "#f97316",
                    fontFamily: "monospace",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "8px 0",
                    borderRadius: 6,
                    cursor: saving || !form.name ? "not-allowed" : "pointer",
                    letterSpacing: "0.06em",
                    transition: "background 0.15s",
                  }}
                >
                  {saving ? "Criando…" : "Criar provider"}
                </button>

                <button
                  onClick={() => {
                    setAddingInCategory(null);
                    setForm({
                      name: "",
                      executionMode: "local",
                      workflowPath: "",
                      description: "",
                      timeoutMs: 300000,
                    });
                  }}
                  style={{
                    background: "transparent",
                    border: "1px solid #ffffff22",
                    color: "#ffffff55",
                    fontFamily: "monospace",
                    fontSize: 10,
                    padding: "6px 0",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category Fallback edit panel */}
        <AnimatePresence>
          {fallbackPanelCategory !== null && (
            <motion.div
              initial={{ x: 280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 280, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{
                width: panelWidth,
                flexShrink: 0,
                background: "#0a0014",
                borderLeft: `1px solid #f9731633`,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Resize handle */}
              <div
                onMouseDown={onResizeMouseDown}
                style={{
                  position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
                  cursor: "col-resize", zIndex: 10,
                  background: "transparent",
                }}
              />
              <div style={{ overflowY: "auto", flex: 1, padding: "18px 18px 24px" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{
                    fontSize: 7, color: "#f9731688",
                    background: "#f9731618", border: "1px solid #f9731633",
                    borderRadius: 3, padding: "1px 5px",
                    letterSpacing: "0.06em", textTransform: "uppercase",
                  }}>FALLBACK</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#f97316" }}>
                    {fallbackPanelCategory === "text2img" ? "txt→img" : "img→img"}
                  </span>
                  <button
                    onClick={() => setFallbackPanelCategory(null)}
                    style={{
                      marginLeft: "auto", background: "none", border: "none",
                      color: "#ffffff44", fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1,
                    }}
                  >×</button>
                </div>

                <p style={{ fontFamily: "monospace", fontSize: 9, color: "#ffffff44", marginBottom: 16, lineHeight: 1.6 }}>
                  Provider acionado quando o provider principal falha. Não há fallback entre categorias.
                </p>

                {/* Name */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontFamily: "monospace", fontSize: 9, color: "#f97316aa", display: "block", marginBottom: 4 }}>
                    Nome (ID)
                  </label>
                  <input
                    value={fallbackForm.name ?? ""}
                    onChange={(e) => setFallbackForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="ex: gpt_image"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "#0d0020", border: "1px solid #f9731633",
                      color: "#f97316", fontFamily: "monospace", fontSize: 11,
                      padding: "6px 8px", borderRadius: 6, outline: "none",
                    }}
                  />
                </div>

                {/* Label */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontFamily: "monospace", fontSize: 9, color: "#f97316aa", display: "block", marginBottom: 4 }}>
                    Label (exibição)
                  </label>
                  <input
                    value={fallbackForm.label ?? ""}
                    onChange={(e) => setFallbackForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="ex: GPT Image (OpenAI)"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "#0d0020", border: "1px solid #f9731633",
                      color: "#f97316", fontFamily: "monospace", fontSize: 11,
                      padding: "6px 8px", borderRadius: 6, outline: "none",
                    }}
                  />
                </div>

                {/* Execution mode */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontFamily: "monospace", fontSize: 9, color: "#f97316aa", display: "block", marginBottom: 6 }}>
                    Modo de execução
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["cloud", "local"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setFallbackForm((f) => ({ ...f, executionMode: mode }))}
                        style={{
                          flex: 1, padding: "5px 0", fontFamily: "monospace", fontSize: 10,
                          borderRadius: 5, cursor: "pointer",
                          background: fallbackForm.executionMode === mode ? (mode === "cloud" ? "#22d3ee22" : "#f9731622") : "transparent",
                          border: `1px solid ${fallbackForm.executionMode === mode ? (mode === "cloud" ? "#22d3ee" : "#f97316") : "#ffffff22"}`,
                          color: fallbackForm.executionMode === mode ? (mode === "cloud" ? "#22d3ee" : "#f97316") : "#ffffff44",
                        }}
                      >
                        {mode === "cloud" ? "☁️ cloud" : "🖥 local"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timeout */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontFamily: "monospace", fontSize: 9, color: "#f97316aa", display: "block", marginBottom: 4 }}>
                    Timeout (ms)
                  </label>
                  <input
                    type="number"
                    value={fallbackForm.timeoutMs ?? 60000}
                    onChange={(e) => setFallbackForm((f) => ({ ...f, timeoutMs: Number(e.target.value) }))}
                    step={1000}
                    min={1000}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "#0d0020", border: "1px solid #f9731633",
                      color: "#f97316", fontFamily: "monospace", fontSize: 11,
                      padding: "6px 8px", borderRadius: 6, outline: "none",
                    }}
                  />
                </div>

                {/* Save / Remove / Cancel */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    disabled={savingFallback || !fallbackForm.name}
                    onClick={async () => {
                      if (!fallbackPanelCategory || !fallbackForm.name) return;
                      setSavingFallback(true);
                      try {
                        const payload: ImageCategoryProvider = {
                          name: fallbackForm.name!,
                          label: fallbackForm.label || fallbackForm.name!,
                          executionMode: fallbackForm.executionMode ?? "cloud",
                          enabled: true,
                          timeoutMs: fallbackForm.timeoutMs ?? 60000,
                        };
                        const res = await setImageCategoryFallback(baseUrl, fallbackPanelCategory, payload);
                        setCategories((prev) => ({
                          ...prev,
                          [fallbackPanelCategory]: { ...prev[fallbackPanelCategory], fallback: res.fallback },
                        }));
                        setFallbackPanelCategory(null);
                      } finally {
                        setSavingFallback(false);
                      }
                    }}
                    style={{
                      background: savingFallback || !fallbackForm.name ? "#1a0800" : "#f9731622",
                      border: "1px solid #f9731655",
                      color: savingFallback || !fallbackForm.name ? "#f9731644" : "#f97316",
                      fontFamily: "monospace", fontSize: 10, fontWeight: 700,
                      padding: "7px 0", borderRadius: 6,
                      cursor: savingFallback || !fallbackForm.name ? "not-allowed" : "pointer",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {savingFallback ? "Salvando…" : "Salvar fallback"}
                  </button>

                  {categories[fallbackPanelCategory ?? ""]?.fallback && (
                    <button
                      disabled={savingFallback}
                      onClick={async () => {
                        if (!fallbackPanelCategory) return;
                        setSavingFallback(true);
                        try {
                          await setImageCategoryFallback(baseUrl, fallbackPanelCategory, null);
                          setCategories((prev) => ({
                            ...prev,
                            [fallbackPanelCategory]: { ...prev[fallbackPanelCategory], fallback: null },
                          }));
                          setFallbackPanelCategory(null);
                        } finally {
                          setSavingFallback(false);
                        }
                      }}
                      style={{
                        background: "transparent", border: "1px solid #ef444433",
                        color: "#ef444466", fontFamily: "monospace", fontSize: 10,
                        padding: "6px 0", borderRadius: 6, cursor: "pointer",
                      }}
                    >
                      Remover fallback
                    </button>
                  )}

                  <button
                    onClick={() => setFallbackPanelCategory(null)}
                    style={{
                      background: "transparent", border: "1px solid #ffffff22",
                      color: "#ffffff55", fontFamily: "monospace", fontSize: 10,
                      padding: "6px 0", borderRadius: 6, cursor: "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
