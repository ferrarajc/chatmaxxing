import React from 'react';
import { useAgentStore } from '../store/agentStore';
import { setConnectAgentState } from '../hooks/useConnectStreams';

const STATUS_COLORS: Record<string, string> = {
  Available: '#10b981',
  Away: '#f59e0b',
  Offline: '#9ca3af',
};

interface Props {
  ccpOpen: boolean;
  onToggleCcp: () => void;
}

export function TopBar({ ccpOpen, onToggleCcp }: Props) {
  const { agentStatus, setAgentStatus, dailyBonus } = useAgentStore();
  const active = useAgentStore(s => s.slots.filter(Boolean).length);

  const handleStatusClick = (s: 'Available' | 'Away') => {
    setAgentStatus(s);          // optimistic local update
    setConnectAgentState(s);    // actual Connect API call
  };

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

        {/* Daily bonus tally — visible only when > 0 */}
        {dailyBonus > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(34,197,94,0.18)', borderRadius: 20,
            padding: '4px 12px', border: '1px solid rgba(34,197,94,0.4)',
          }}>
            <span style={{ fontSize: 15 }}>💰</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#4ade80' }}>
              ${dailyBonus}
            </span>
            <span style={{ fontSize: 11, color: '#86efac', opacity: 0.9 }}>today</span>
          </div>
        )}

        {/* Status toggle */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['Available', 'Away'] as const).map(s => (
            <button
              key={s}
              onClick={() => handleStatusClick(s)}
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

        {/* DA avatar — click to open/close the Connect CCP panel */}
        <button
          onClick={onToggleCcp}
          title={ccpOpen ? 'Close Connect panel' : 'Open Connect panel'}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: ccpOpen ? '#3b82f6' : '#2563eb',
            border: ccpOpen ? '2px solid #93c5fd' : '2px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13, color: '#fff',
            cursor: 'pointer', flexShrink: 0,
            transition: 'border-color .15s, background .15s',
          }}
        >
          DA
        </button>
      </div>
    </div>
  );
}
