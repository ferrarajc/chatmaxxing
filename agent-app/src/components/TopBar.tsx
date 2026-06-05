import React, { useEffect, useRef, useState } from 'react';
import { useAgentStore } from '../store/agentStore';
import { setConnectAgentState } from '../hooks/useConnectStreams';
import { UiMode } from './AgentDesktop';


interface Props {
  ccpOpen: boolean;
  onToggleCcp: () => void;
  ccpButtonRef?: React.RefObject<HTMLButtonElement | null>;
  uiMode: UiMode;
  onModeChange: (mode: UiMode) => void;
  onOpenLoginPopup: () => void;
}

const UI_MODES: { id: UiMode; label: string; desc: string }[] = [
  { id: 'chatmaxxing', label: 'Chatmaxxing',  desc: '4-column multi-chat view' },
  { id: 'triple-chat', label: 'Triple chat',  desc: '3-column multi-chat view' },
  { id: 'double-chat', label: 'Double chat',  desc: '2-column multi-chat view' },
  { id: 'focusing',    label: 'Focusing',     desc: 'Single-chat deep-support view' },
];

export function TopBar({ ccpOpen, onToggleCcp, ccpButtonRef, uiMode, onModeChange, onOpenLoginPopup }: Props) {
  const { agentStatus, setAgentStatus, dailyBonus, agentConnected, agentName, agentUsername } = useAgentStore();

  const initials = (() => {
    // 1. Multi-word display name: "John Ferrara" → "JF"
    const nameParts = agentName.trim().split(/\s+/).filter(Boolean);
    if (nameParts.length >= 2) {
      return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
    }
    // 2. Username with delimiter: "john.ferrara" / "john_ferrara" → "JF"
    const userParts = agentUsername.split(/[.\-_@]/).filter(Boolean);
    if (userParts.length >= 2) {
      return (userParts[0][0] + userParts[userParts.length - 1][0]).toUpperCase();
    }
    // 3. Single name: first letter only; empty: fallback "DA"
    return (nameParts[0]?.[0] ?? agentUsername[0] ?? 'DA').toUpperCase();
  })();
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

        {/* Status toggle switch — hidden until Connect confirms login */}
        {agentConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: agentStatus === 'Available' ? '#4ade80' : '#9ca3af', paddingRight: 8 }}>
              {agentStatus === 'Available' ? 'On queue' : 'Off queue'}
            </span>
            <button
              onClick={() => handleStatusClick(agentStatus === 'Available' ? 'Away' : 'Available')}
              style={{
                position: 'relative', width: 44, height: 24, borderRadius: 12,
                background: agentStatus === 'Available' ? '#10b981' : '#6b7280',
                border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
                marginRight: 10,
                transition: 'background .2s',
              }}
              title={agentStatus === 'Available' ? 'Go off queue' : 'Go on queue'}
            >
              <span style={{
                position: 'absolute', top: 3,
                left: agentStatus === 'Available' ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                transition: 'left .2s',
                display: 'block',
              }} />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenLoginPopup}
            title="Click to sign in"
            style={{ fontSize: 17, fontWeight: 500, color: '#6b7280', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            Not logged on
          </button>
        )}

        {/* DA avatar — click to open/close the Connect CCP panel */}
        <button
          ref={ccpButtonRef}
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
          {initials}
        </button>
      </div>
    </div>
  );
}
