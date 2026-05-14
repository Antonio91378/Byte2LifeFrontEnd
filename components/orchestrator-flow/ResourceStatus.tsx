'use client';

import { useEffect, useState } from 'react';
import { getResourceStatus, type ResourceStatus } from '../../services/aiOrchestrator.service';

interface ResourceStatusBadgeProps {
  baseUrl: string;
}

export function ResourceStatusBadge({ baseUrl }: ResourceStatusBadgeProps) {
  const [status, setStatus] = useState<ResourceStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const s = await getResourceStatus(baseUrl);
        if (!cancelled) setStatus(s);
      } catch {
        if (!cancelled) setStatus(null);
      }
    }
    poll();
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [baseUrl]);

  if (!status) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace', fontSize: 11, color: '#ffffff44' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#444444', display: 'inline-block' }} />
        GPU —
      </div>
    );
  }

  const busy = status.busy;
  const color = busy ? '#f97316' : '#22c55e';
  const label = busy ? `BUSY${status.currentTask?.skillName ? ` — ${status.currentTask.skillName}` : ''}` : 'FREE';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace', fontSize: 11, color }}>
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}`,
        display: 'inline-block',
        animation: busy ? 'neon-pulse 1s ease-in-out infinite' : 'none',
      }} />
      GPU ● {label}
    </div>
  );
}
