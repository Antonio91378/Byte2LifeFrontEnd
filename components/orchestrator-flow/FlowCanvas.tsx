'use client';

import dagre from '@dagrejs/dagre';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useResizablePanel } from '../../hooks/useResizablePanel';
import {
  getLLMProviders,
  getFlowDefinition,
  subscribeToFlowEvents,
  type FlowDefinition,
  type FlowStage,
  type LLMProviderConfig,
  type StageEvent,
} from '../../services/aiOrchestrator.service';
import { AnimatedFlowEdge } from './CustomEdge';
import { ImageGenSubFlow } from './ImageGenSubFlow';
import { ImageJudgeSubFlow } from './ImageJudgeSubFlow';
import { LLMExtractionSubFlow } from './LLMExtractionSubFlow';
import { StageInspector } from './StageInspector';
import { StageNode, type StageNodeData, type StageStatus } from './StageNode';

const NODE_TYPES = { stageNode: StageNode };
const EDGE_TYPES = { animatedFlow: AnimatedFlowEdge };

const NODE_W = 200;
const NODE_H = 80;


const LAYER_EDGE_COLOR: Record<string, string> = {
  input:  '#22d3ee',
  core:   '#c026d3',
  action: '#f97316',
  output: '#ec4899',
};

// Branch-label → edge color (for decision branches)
const BRANCH_COLORS: Record<string, string> = {
  image_generation: '#f97316',
  makerworld_suggest: '#22d3ee',
  data_collection:  '#22c55e',
  human_handoff:    '#ef4444',
  finalize:         '#ec4899',
  approved:         '#22c55e',
  retry:            '#ef4444',
  max_retries:      '#f97316',
  download_print:   '#22c55e',
  customize:        '#f97316',
  suggest_only:     '#22d3ee',
};

function buildGraph(def: FlowDefinition): { nodes: Node[]; edges: Edge[] } {
  const stages = def.stages ?? [];
  const edges: Edge[] = [];

  // Build raw edges first (needed for dagre)
  for (const stage of stages) {
    for (const nextId of stage.next ?? []) {
      edges.push({
        id: `${stage.id}→${nextId}`,
        source: stage.id,
        target: nextId,
        type: 'animatedFlow',
        animated: false,
        data: { color: LAYER_EDGE_COLOR[stage.layer] ?? '#c026d3' },
        style: { stroke: '#ffffff18', strokeWidth: 1.5 },
      });
    }

    for (const branch of stage.branches ?? []) {
      const isRetry = (branch as { backEdge?: boolean }).backEdge === true;
      const branchColor = BRANCH_COLORS[branch.id] ?? (isRetry ? '#ef4444' : '#f97316');
      for (const nextId of branch.next ?? []) {
        edges.push({
          id: `${stage.id}→${nextId}:${branch.id}`,
          source: stage.id,
          target: nextId,
          type: 'animatedFlow',
          label: branch.label,
          animated: false,
          data: { color: branchColor, isRetry },
          style: {
            stroke: isRetry ? '#ef444433' : `${branchColor}44`,
            strokeDasharray: isRetry ? '6 3' : '4 2',
            strokeWidth: isRetry ? 1 : 1.5,
          },
          labelStyle: {
            fill: branchColor,
            fontSize: 9,
            fontFamily: 'monospace',
          },
        });
      }
    }
  }

  // Run dagre layout
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 90, marginx: 30, marginy: 30 });

  for (const stage of stages) {
    g.setNode(stage.id, { width: NODE_W, height: NODE_H });
  }
  for (const edge of edges) {
    // Skip back-edges (retry loops) so dagre doesn't create a cycle
    if ((edge.data as { isRetry?: boolean } | undefined)?.isRetry) continue;
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const nodes: Node[] = stages.map((stage) => {
    const nodeData = g.node(stage.id);
    return {
      id: stage.id,
      type: 'stageNode',
      position: {
        x: (nodeData?.x ?? 0) - NODE_W / 2,
        y: (nodeData?.y ?? 0) - NODE_H / 2,
      },
      data: { stage, status: 'idle', lastEventName: undefined, selected: false } satisfies StageNodeData,
    };
  });

  return { nodes, edges };
}

function InspectorResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: 6,
        cursor: 'ew-resize',
        zIndex: 30,
        background: hovered ? '#c026d355' : 'transparent',
        transition: 'background 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {hovered && (
        <div style={{ width: 2, height: 40, borderRadius: 2, background: '#c026d3', boxShadow: '0 0 8px #c026d3' }} />
      )}
    </div>
  );
}

interface FlowCanvasProps {
  baseUrl: string;
  conversationId: string | null;
  onEventsChange?: (events: StageEvent[]) => void;
}

export function FlowCanvas({ baseUrl, conversationId, onEventsChange }: FlowCanvasProps) {
  const [definition, setDefinition] = useState<FlowDefinition | null>(null);
  const [providers, setProviders] = useState<LLMProviderConfig[]>([]);
  const [stageStatuses, setStageStatuses] = useState<Map<string, StageStatus>>(new Map());
  const [stageLastEvent, setStageLastEvent] = useState<Map<string, string>>(new Map());
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const eventsRef = useRef<StageEvent[]>([]);

  useEffect(() => {
    getFlowDefinition(baseUrl).then(setDefinition).catch(() => {});
    getLLMProviders(baseUrl).then(r => setProviders(r.providers)).catch(() => {});
  }, [baseUrl]);

  useEffect(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setStageStatuses(new Map());
    setStageLastEvent(new Map());
    eventsRef.current = [];
    setEvents([]);

    if (!conversationId) return;

    const cleanup = subscribeToFlowEvents(baseUrl, conversationId, (raw) => {
      if ('type' in raw && raw.type === 'trace_replay' && raw.events) {
        const replayedStatuses = new Map<string, StageStatus>();
        const replayedLast = new Map<string, string>();
        for (const evt of raw.events) applyEventToStatus(evt, replayedStatuses, replayedLast);
        setStageStatuses(new Map(replayedStatuses));
        setStageLastEvent(new Map(replayedLast));
        const replayedEvents = [...(raw.events as StageEvent[])];
        eventsRef.current = replayedEvents;
        setEvents(replayedEvents);
        onEventsChange?.(replayedEvents);
        return;
      }
      const entry = raw as StageEvent;
      setStageStatuses((prev) => { const m = new Map(prev); applyEventToStatus(entry, m, undefined); return m; });
      setStageLastEvent((prev) => {
        const m = new Map(prev);
        const sid = entry.payload?.stageId as string | undefined;
        if (sid) m.set(sid, entry.eventName);
        return m;
      });
      const updated = [...eventsRef.current, entry];
      eventsRef.current = updated;
      setEvents(updated);
      onEventsChange?.(updated);
    });

    cleanupRef.current = cleanup;
    return () => { cleanupRef.current?.(); cleanupRef.current = null; };
  }, [baseUrl, conversationId]);

  const { nodes, edges } = useMemo(() => definition ? buildGraph(definition) : { nodes: [], edges: [] }, [definition]);

  // Real-time tick: re-runs liveNodes every second while any stage is active.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const hasActive = [...stageStatuses.values()].some(s => s === 'active');
    if (!hasActive) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [stageStatuses]);

  // Compute per-stage durations by scanning the events array for stage.started/completed/failed pairs.
  // For active stages (no endTs yet) we use Date.now() as an approximate elapsed value.
  const liveNodes = useMemo(() => {
    // Build a timing map from events
    const timings = new Map<string, { startTs: number; endTs?: number }>();
    for (const evt of events) {
      const sid = evt.payload?.stageId as string | undefined;
      if (!sid) continue;
      if (evt.eventName === 'stage.started') {
        timings.set(sid, { startTs: evt.ts });
      } else if (evt.eventName === 'stage.completed' || evt.eventName === 'stage.failed') {
        const ex = timings.get(sid);
        if (ex && ex.endTs === undefined) timings.set(sid, { ...ex, endTs: evt.ts });
      }
    }

    const now = Date.now();
    return nodes.map((n) => {
      const t = timings.get(n.id);
      const status = stageStatuses.get(n.id) ?? 'idle';
      const durationMs = t ? (t.endTs ?? (status === 'active' ? now : undefined)) !== undefined
        ? (t.endTs ?? now) - t.startTs
        : undefined : undefined;
      const timeoutMs = (n.data as unknown as StageNodeData).stage?.timeoutMs;
      return {
        ...n,
        data: {
          ...n.data,
          status,
          lastEventName: stageLastEvent.get(n.id),
          selected: n.id === selectedStageId,
          hasSubFlow: n.id === 'image_gen' || n.id === 'extraction' || n.id === 'image_judge',
          durationMs,
          timeoutMs,
        },
      };
    });
  }, [nodes, stageStatuses, stageLastEvent, selectedStageId, events, definition, tick]);

  const liveEdges = useMemo(
    () => edges.map((e) => {
      const sourceActive = stageStatuses.get(e.source) === 'active';
      const presetColor = (e.data as { color?: string } | undefined)?.color ?? '#c026d3';
      return {
        ...e,
        animated: sourceActive,
        data: { ...e.data as object, color: sourceActive ? presetColor : '#ffffff18' },
      };
    }),
    [edges, stageStatuses],
  );

  const [imageGenSubFlowOpen, setImageGenSubFlowOpen] = useState(false);
  const [extractionSubFlowOpen, setExtractionSubFlowOpen] = useState(false);
  const [imageJudgeSubFlowOpen, setImageJudgeSubFlowOpen] = useState(false);
  const { width: inspectorWidth, onMouseDown: onInspectorResizeDown } = useResizablePanel(300, 220, 700);

  function closeAllSubFlows() {
    setImageGenSubFlowOpen(false);
    setExtractionSubFlowOpen(false);
    setImageJudgeSubFlowOpen(false);
  }

  const onNodeClick: NodeMouseHandler = (_event, node) => {
    if (node.id === 'image_gen') {
      closeAllSubFlows();
      setImageGenSubFlowOpen(true);
      setSelectedStageId(null);
      return;
    }
    if (node.id === 'extraction') {
      closeAllSubFlows();
      setExtractionSubFlowOpen(true);
      setSelectedStageId(null);
      return;
    }
    if (node.id === 'image_judge') {
      closeAllSubFlows();
      setImageJudgeSubFlowOpen(true);
      setSelectedStageId(null);
      return;
    }
    setSelectedStageId((prev) => (prev === node.id ? null : node.id));
  };

  const selectedStage: FlowStage | null = selectedStageId
    ? (definition?.stages ?? []).find((s) => s.id === selectedStageId) ?? null
    : null;

  if (!definition) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0a0a0f', fontFamily: 'monospace', fontSize: 12, color: '#c026d3' }}>
        Carregando pipeline…
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0f', position: 'relative', display: 'flex', overflow: 'hidden' }}>

      {/* Image Gen sub-flow overlay */}
      <AnimatePresence>
        {imageGenSubFlowOpen && definition && (
          <motion.div
            key="image-gen-subflow"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{ position: 'absolute', inset: 0, zIndex: 20, background: '#0a0a0f' }}
          >
            <ImageGenSubFlow
              baseUrl={baseUrl}
              definition={definition}
              conversationId={conversationId}
              onBack={() => setImageGenSubFlowOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* LLM Extraction sub-flow overlay */}
      <AnimatePresence>
        {extractionSubFlowOpen && definition && (
          <motion.div
            key="extraction-subflow"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{ position: 'absolute', inset: 0, zIndex: 20, background: '#0a0a0f' }}
          >
            <LLMExtractionSubFlow
              baseUrl={baseUrl}
              definition={definition}
              conversationId={conversationId}
              onBack={() => setExtractionSubFlowOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Judge sub-flow overlay */}
      <AnimatePresence>
        {imageJudgeSubFlowOpen && definition && (
          <motion.div
            key="image-judge-subflow"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{ position: 'absolute', inset: 0, zIndex: 20, background: '#0a0a0f' }}
          >
            <ImageJudgeSubFlow
              baseUrl={baseUrl}
              definition={definition}
              conversationId={conversationId}
              onBack={() => setImageJudgeSubFlowOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ReactFlow */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={liveNodes}
          edges={liveEdges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodeClick={onNodeClick}
          fitView
          attributionPosition="bottom-left"
          proOptions={{ hideAttribution: true }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          minZoom={0.1}
          maxZoom={3}
        >
          <Background variant={BackgroundVariant.Dots} color="#c026d322" gap={24} size={1} />
          <Controls style={{ background: '#1a0033', border: '1px solid #c026d344', color: '#c026d3' }} />
          <MiniMap
            style={{ background: '#0a0a1a', border: '1px solid #c026d322' }}
            nodeColor={(n) => {
              const status = (n.data as unknown as StageNodeData).status;
              return status === 'active' ? '#c026d3' : status === 'completed' ? '#22c55e' : status === 'failed' ? '#ef4444' : '#333355';
            }}
          />
        </ReactFlow>

        {!conversationId && !selectedStage && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f88', pointerEvents: 'none' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#c026d3', textAlign: 'center', padding: 20, border: '1px solid #c026d344', borderRadius: 12, background: '#0a0a1a' }}>
              ← Selecione uma conversa para ver o pipeline ao vivo<br />
              <span style={{ fontSize: 10, color: '#ffffff44', marginTop: 6, display: 'block' }}>Clique em qualquer stage para ver seus detalhes</span>
            </div>
          </div>
        )}
      </div>

      {/* Stage Inspector — slide in from right when a node is selected */}
      {selectedStage && definition && (
        <div style={{
          width: inspectorWidth,
          flexShrink: 0,
          borderLeft: '1px solid #c026d322',
          overflow: 'hidden',
          position: 'relative',
          animation: 'slideInRight 0.18s ease-out',
        }}>
          {/* Resize handle on the left edge */}
          <InspectorResizeHandle onMouseDown={onInspectorResizeDown} />
          <StageInspector
            stage={selectedStage}
            definition={definition}
            providers={providers}
            baseUrl={baseUrl}
            onClose={() => setSelectedStageId(null)}
            onSkillUpdated={() => getFlowDefinition(baseUrl).then(setDefinition).catch(() => {})}
            onStageTimeoutUpdated={(stageId, timeoutMs) => {
              setDefinition((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  stages: prev.stages.map((s) => s.id === stageId ? { ...s, timeoutMs } : s),
                };
              });
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function applyEventToStatus(evt: StageEvent, statuses: Map<string, StageStatus>, lastEvents?: Map<string, string>) {
  const sid = evt.payload?.stageId as string | undefined;
  if (!sid) return;
  if (lastEvents) lastEvents.set(sid, evt.eventName);
  if (evt.eventName === 'stage.started')    statuses.set(sid, 'active');
  else if (evt.eventName === 'stage.completed') statuses.set(sid, 'completed');
  else if (evt.eventName === 'stage.failed')    statuses.set(sid, 'failed');
}
