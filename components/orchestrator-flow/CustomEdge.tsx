'use client';

import { getBezierPath, type EdgeProps } from '@xyflow/react';

const LAYER_COLOR: Record<string, string> = {
  input: '#22d3ee',
  core: '#c026d3',
  action: '#f97316',
  output: '#ec4899',
};

export function AnimatedFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  animated,
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  const isActive = animated === true;
  const dotColor = (data?.color as string) ?? '#c026d3';
  const pathId = `ep-${id}`;

  return (
    <g>
      {/* Glow layer when active */}
      {isActive && (
        <path
          d={edgePath}
          fill="none"
          stroke={dotColor}
          strokeWidth={4}
          strokeOpacity={0.18}
          style={{ filter: `drop-shadow(0 0 6px ${dotColor})` }}
        />
      )}

      {/* Main path */}
      <path
        id={pathId}
        d={edgePath}
        fill="none"
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: isActive ? dotColor : (style?.stroke ?? '#ffffff22'),
          strokeWidth: isActive ? 2 : 1.5,
          transition: 'stroke 0.3s, stroke-width 0.3s',
        }}
      />

      {/* Traveling dot — only when active */}
      {isActive && (
        <circle r={5} fill={dotColor} style={{ filter: `drop-shadow(0 0 5px ${dotColor})` }}>
          <animateMotion dur="1.2s" repeatCount="indefinite" calcMode="linear">
            <mpath href={`#${pathId}`} />
          </animateMotion>
        </circle>
      )}
    </g>
  );
}
