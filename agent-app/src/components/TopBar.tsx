import React, { useEffect, useRef, useState } from 'react';
import { useAgentStore } from '../store/agentStore';
import { setConnectAgentState } from '../hooks/useConnectStreams';
import { UiMode } from './AgentDesktop';

const STATUS_COLORS: Record<string, string> = {
  Available: '#10b981',
  Away: '#f59e0b',
  Offline: '#9ca3af',
};

interface Props {
  ccpOpen: boolean;
  onToggleCcp: () => void;
  uiMode: UiMode;
  onModeChange: (mode: UiMode) => void;
}

const UI_MODES: { id: UiMode; label: string; desc: string }[] = [
  { id: 'chatmaxxing', label: 'Chatmaxxing', desc: '4-column multi-chat view' },
  { id: 'focusing',    label: 'Focusing',    desc: 'Single-chat deep-support view' },
];

export function TopBar({ ccpOpen, onToggleCcp, uiMode, onModeChange }: Props) {
  const { agentStatus, setAgentStatus, dailyBonus } = useAgentStore();
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const bIconRef = useRef<HTMLButtonElement>(null);
  const menuRef  = useRef<HTMLDivElement>(null);

  const handleStatusClick = (s: 'Available' | 'Away') => {
    setAgentStatus(s);
    setConnectAgentState(s);
  };

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!modeMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModeMenuOpen(false); };
    const handleClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || bIconRef.current?.contains(t)) return;
      setModeMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [modeMenuOpen]);

  return (
    <div style={{
      height: 56, background: '#0f2d5e', color: '#fff',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 20,
      boxShadow: '0 2px 8px rgba(0,0,0,.3)', flexShrink: 0,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* B icon — hidden mode-switcher trigger */}
        <button
          ref={bIconRef}
          onClick={() => setModeMenuOpen(o => !o)}
          title="Switch view"
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: modeMenuOpen ? '#3b82f6' : '#2563eb',
            border: modeMenuOpen ? '2px solid #93c5fd' : '2px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 14, color: '#fff',
            cursor: 'pointer', flexShrink: 0,
            transition: 'background .15s, border-color .15s',
          }}
        >B</button>

        {/* Mode dropdown */}
        {modeMenuOpen && (
          <div
            ref={menuRef}
            style={{
              position: 'absolute', top: 52, left: 20, zIndex: 3000,
              background: '#fff', borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,.22)',
              border: '1px solid #e5e7eb',
              overflow: 'hidden', minWidth: 200,
            }}
          >
            <div style={{
              padding: '8px 14px 6px',
              fontSize: 10, fontWeight: 700, color: '#9ca3af',
              textTransform: 'uppercase', letterSpacing: '.6px',
              borderBottom: '1px solid #f3f4f6',
            }}>
              View
            </div>
            {UI_MODES.map(m => {
              const active = uiMode === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => { onModeChange(m.id); setModeMenuOpen(false); }}
                  style={{
                    padding: '9px 14px', cursor: 'pointer',
                    background: active ? '#eff6ff' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 13, fontWeight: active ? 700 : 500,
                      color: active ? '#1a56db' : '#1e293b',
                    }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                      {m.desc}
                    </div>
                  </div>
                  {active && (
                    <span style={{ color: '#1a56db', fontSize: 14, fontWeight: 700 }}>✓</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <span style={{ fontWeight: 700, fontSize: 15 }}>Bob's — Agent Desktop</span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
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
