import React, { useRef, useState } from 'react';
import { useConnectStreams } from '../hooks/useConnectStreams';
import { useAgentStore } from '../store/agentStore';
import { TopBar } from './TopBar';
import { ChatColumn } from './ChatColumn';

export function AgentDesktop() {
  const ccpRef = useRef<HTMLDivElement>(null);
  const slots = useAgentStore(s => s.slots);
  // Start collapsed — the SDK initialises in the background. Expand only if
  // you need to re-authenticate (panel is hidden with display:none, not unmounted,
  // so the iframe stays alive and the Streams SDK keeps receiving events).
  const [ccpVisible, setCcpVisible] = useState(false);

  useConnectStreams(ccpRef);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
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

      {/* ── CCP panel — always in DOM so the SDK iframe is never destroyed ── */}
      <div style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 2000,
        width: 320, borderRadius: 12,
        boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.15)',
        display: ccpVisible ? 'block' : 'none',
      }}>
        <div style={{
          background: '#0f2d5e', color: '#fff', padding: '8px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, fontWeight: 600,
        }}>
          <span>🔌 Connect — Log in as demo-agent</span>
          <button
            onClick={() => setCcpVisible(false)}
            title="Minimize (stays connected)"
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
          >×</button>
        </div>
        {/* CCP iframe target — always mounted */}
        <div ref={ccpRef} style={{ width: 320, height: 460, background: '#fff' }} />
      </div>

      {/* FAB — shown when panel is collapsed */}
      {!ccpVisible && (
        <button
          onClick={() => setCcpVisible(true)}
          title="Open Connect panel"
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 2000,
            width: 48, height: 48, borderRadius: '50%',
            background: '#0f2d5e', color: '#fff', border: 'none',
            fontSize: 20, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          🔌
        </button>
      )}
    </div>
  );
}
