'use client';

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
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getFlowDefinition,
  subscribeToFlowEvents,
  type FlowDefinition,
  type FlowStage,
  type StageEvent,
} from '../../services/aiOrchestrator.service';
import { AnimatedFlowEdge } from './CustomEdge';
import { StageInspector } from './StageInspector';
import { StageNode, type StageNodeData, type StageStatus } from './StageNode';

const NODE_TYPES = { stageNode: StageNode };
const EDGE_TYPES = { animatedFlow: AnimatedFlowEdge };

const LAYER_X: Record<string, number> = { input: 0, core: 1, action: 2, output: 3 };
const LAYER_EDGE_COLOR: Record<string, string> = {
  input:  '#22d3ee',
  core:   '#c026d3',
  action: '#f97316',
  output: '#ec4899',
};

function buildGraph(def: FlowDefinition): { nodes: Node[]; edges: Edge[] } {
  const stages = def.stages ?? [];
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const layerCounters: Record<string, number> = {};

  for (const stage of stages) {
    const lx = (LAYER_X[stage.layer] ?? 0) * 260 + 60;
    const ly = (layerCounters[stage.layer] ?? 0) * 120 + 60;
    layerCounters[stage.layer] = (layerCounters[stage.layer] ?? 0) + 1;

    nodes.push({
      id: stage.id,
      type: 'stageNode',
      position: { x: lx, y: ly },
      data: { stage, status: 'idle', lastEventName: undefined, selected: false } satisfies StageNodeData,
    });

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
      for (const nextId of branch.next ?? []) {
        edges.push({
          id: `${stage.id}→${nextId}:${branch.id}`,
          source: stage.id,
          target: nextId,
          type: 'animatedFlow',
          label: branch.label,
          animated: false,
          data: { color: '#f97316' },
          style: { stroke: '#f9731633', strokeDasharray: '4 2' },
          labelStyle: { fill: '#f97316', fontSize: 9, fontFamily: 'monospace' },
        });
      }
    }
  }

  return { nodes, edges };
}

interface FlowCanvasProps {
  baseUrl: string;
  conversationId: string | null;
  onEventsChange?: (events: StageEvent[]) => void;
}

export function FlowCanvas({ baseUrl, conversationId, onEventsChange }: FlowCanvasProps) {
  const [definition, setDefinition] = useState<FlowDefinition | null>(null);
  const [stageStatuses, setStageStatuses] = useState<Map<string, StageStatus>>(new Map());
  const [stageLastEvent, setStageLastEvent] = useState<Map<string, string>>(new Map());
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    getFlowDefinition(baseUrl).then(setDefinition).catch(() => {});
  }, [baseUrl]);

  useEffect(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setStageStatuses(new Map());
    setStageLastEvent(new Map());
    setEvents([]);

    if (!conversationId) return;

    const cleanup = subscribeToFlowEvents(baseUrl, conversationId, (raw) => {
      if ('type' in raw && raw.type === 'trace_replay' && raw.events) {
        const replayedStatuses = new Map<string, StageStatus>();
        const replayedLast = new Map<string, string>();
        for (const evt of raw.events) applyEventToStatus(evt, replayedStatuses, replayedLast);
        setStageStatuses(new Map(replayedStatuses));
        setStageLastEvent(new Map(replayedLast));
        setEvents([...(raw.events as StageEvent[])]);
        onEventsChange?.([...(raw.events as StageEvent[])]);
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
      setEvents((prev) => {
        const updated = [...prev, entry];
        onEventsChange?.(updated);
        return updated;
      });
    });

    cleanupRef.current = cleanup;
    return () => { cleanupRef.current?.(); cleanupRef.current = null; };
  }, [baseUrl, conversationId]);

  const { nodes, edges } = useMemo(() => definition ? buildGraph(definition) : { nodes: [], edges: [] }, [definition]);

  const liveNodes = useMemo(
    () => nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        status: stageStatuses.get(n.id) ?? 'idle',
        lastEventName: stageLastEvent.get(n.id),
        selected: n.id === selectedStageId,
      },
    })),
    [nodes, stageStatuses, stageLastEvent, selectedStageId],
  );

  const liveEdges = useMemo(
    () => edges.map((e) => {
      const sourceActive = stageStatuses.get(e.source) === 'active';
      return {
        ...e,
        animated: sourceActive,
        data: { ...e.data as object, color: sourceActive ? (LAYER_EDGE_COLOR[(definition?.stages ?? []).find(s => s.id === e.source)?.layer ?? ''] ?? '#c026d3') : '#ffffff18' },
      };
    }),
    [edges, stageStatuses, definition],
  );

  const onNodeClick: NodeMouseHandler = (_event, node) => {
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
    <div style={{ width: '100%', height: '100%', background: '#0a0a0f', position: 'relative', display: 'flex' }}>
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
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
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
          width: 280,
          flexShrink: 0,
          borderLeft: '1px solid #c026d322',
          overflow: 'hidden',
          animation: 'slideInRight 0.18s ease-out',
        }}>
          <StageInspector stage={selectedStage} definition={definition} onClose={() => setSelectedStageId(null)} />
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
