import React from 'react';
import { useAgentStore } from '../store/agentStore';

const STATUS_COLORS: Record<string, string> = {
  Available: '#10b981',
  Away: '#f59e0b',
  Offline: '#9ca3af',
};

export function TopBar() {
  const { agentStatus, setAgentStatus } = useAgentStore();
  const active = useAgentStore(s => s.slots.filter(Boolean).length);

  return (
    <div style={{
      height: 56, background: '#0f2d5e', color: '#fff',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 20,
      boxShadow: '0 2px 8px rgba(0,0,0,.3)', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>B</div>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Bob's — Agent Desktop</span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
        <span style={{ fontSize: 13, opacity: 0.8 }}>
          Active chats: <strong>{active}</strong> / 4
        </span>

        {/* Status toggle */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['Available', 'Away'] as const).map(s => (
            <button
              key={s}
              onClick={() => setAgentStatus(s)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${STATUS_COLORS[s]}`,
                background: agentStatus === s ? STATUS_COLORS[s] : 'transparent',
                color: agentStatus === s ? '#fff' : STATUS_COLORS[s],
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
          DA
        </div>
      </div>
    </div>
  );
}
