import React, { useRef } from 'react';
import { useConnectStreams } from '../hooks/useConnectStreams';
import { useAgentStore } from '../store/agentStore';
import { TopBar } from './TopBar';
import { ChatColumn } from './ChatColumn';

export function AgentDesktop() {
  const ccpRef = useRef<HTMLDivElement>(null);
  const slots = useAgentStore(s => s.slots);

  useConnectStreams(ccpRef);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Hidden CCP container — 0×0, just for auth/signaling */}
      <div ref={ccpRef} style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }} />

      <TopBar />

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
    </div>
  );
}
