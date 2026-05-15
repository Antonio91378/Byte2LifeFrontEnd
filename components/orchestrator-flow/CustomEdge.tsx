'use client';

import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

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
  label,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  const isActive = animated === true;
  const dotColor = (data?.color as string) ?? '#c026d3';
  const pathId = `ep-${id}`;

  return (
    <>
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

      {/* Branch label */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
              fontFamily: 'monospace',
              fontSize: 9,
              color: dotColor,
              background: '#0a0a0f',
              padding: '1px 5px',
              borderRadius: 3,
              border: `1px solid ${dotColor}44`,
              whiteSpace: 'nowrap',
              opacity: 0.85,
            }}
            className="nodrag nopan"
          >
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
