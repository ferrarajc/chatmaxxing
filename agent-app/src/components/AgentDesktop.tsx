import React, { useRef, useState } from 'react';
import { useConnectStreams } from '../hooks/useConnectStreams';
import { useAgentStore } from '../store/agentStore';
import { TopBar } from './TopBar';
import { ChatColumn } from './ChatColumn';

export function AgentDesktop() {
  const ccpRef = useRef<HTMLDivElement>(null);
  const slots = useAgentStore(s => s.slots);
  const [ccpOpen, setCcpOpen] = useState(false);

  useConnectStreams(ccpRef);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <TopBar ccpOpen={ccpOpen} onToggleCcp={() => setCcpOpen(o => !o)} />

      {/* 4-column grid */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        padding: 12,
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {slots.map((slot, i) => (
          <ChatColumn key={i} slotIndex={i} slot={slot} />
        ))}
      </div>

      {/* ── CCP dropdown — anchored below the TopBar, aligned to the right edge.
          Always in the DOM (display:none not unmount) so the Streams SDK iframe
          keeps running in the background. */}
      <div style={{
        position: 'fixed', top: 56, right: 20, zIndex: 2000,
        width: 320, borderRadius: '0 0 12px 12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        display: ccpOpen ? 'block' : 'none',
      }}>
        <div ref={ccpRef} style={{ width: 320, height: 500, background: '#fff' }} />
      </div>
    </div>
  );
}
