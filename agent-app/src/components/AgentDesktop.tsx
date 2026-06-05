import React, { useEffect, useRef, useState } from 'react';
import { useConnectStreams } from '../hooks/useConnectStreams';
import { useAgentStore } from '../store/agentStore';
import { TopBar } from './TopBar';

const CCP_URL = import.meta.env.VITE_CCP_URL as string;

function LoginOverlay() {
  const handleSignIn = () => {
    window.open(CCP_URL, 'ConnectLogin', 'width=430,height=600,left=200,top=100');
  };
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(15,45,94,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 48px',
        textAlign: 'center', maxWidth: 360,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#6b7280', letterSpacing: '.5px', marginBottom: 12 }}>
          BOB'S MUTUAL FUNDS
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, color: '#0f172a' }}>Agent Desktop</h2>
        <p style={{ color: '#64748b', margin: '0 0 28px', fontSize: 14 }}>
          Sign in to Amazon Connect to start taking chats.
        </p>
        <button onClick={handleSignIn} style={{
          width: '100%', padding: '12px 0', borderRadius: 8,
          background: '#1a56db', color: '#fff', border: 'none',
          fontSize: 15, fontWeight: 600, cursor: 'pointer',
        }}>
          Sign In
        </button>
        <p style={{ marginTop: 16, fontSize: 11, color: '#9ca3af' }}>
          After signing in, the popup will close and this page will update automatically.
        </p>
      </div>
    </div>
  );
}
import { ChatColumn } from './ChatColumn';
import { FocusingDesktop } from './FocusingDesktop';

export type UiMode = 'chatmaxxing' | 'triple-chat' | 'double-chat' | 'focusing';

const ALL_MODES: UiMode[] = ['chatmaxxing', 'triple-chat', 'double-chat', 'focusing'];

function getInitialMode(): UiMode {
  try {
    const saved = localStorage.getItem('bobs:uiMode');
    if (ALL_MODES.includes(saved as UiMode)) return saved as UiMode;
  } catch { /* ignore */ }
  return 'double-chat';
}

export function AgentDesktop() {
  const ccpRef = useRef<HTMLDivElement>(null);
  const ccpPanelRef = useRef<HTMLDivElement>(null);
  const ccpButtonRef = useRef<HTMLButtonElement>(null);
  const slots = useAgentStore(s => s.slots);
  const agentConnected = useAgentStore(s => s.agentConnected);
  const [ccpOpen, setCcpOpen] = useState(false);
  const [uiMode, setUiMode] = useState<UiMode>(getInitialMode);

  useConnectStreams(ccpRef);

  useEffect(() => {
    if (!ccpOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ccpPanelRef.current?.contains(t) || ccpButtonRef.current?.contains(t)) return;
      setCcpOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [ccpOpen]);

  const handleModeChange = (mode: UiMode) => {
    setUiMode(mode);
    try { localStorage.setItem('bobs:uiMode', mode); } catch { /* ignore */ }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <TopBar
        ccpOpen={ccpOpen}
        onToggleCcp={() => setCcpOpen(o => !o)}
        ccpButtonRef={ccpButtonRef}
        uiMode={uiMode}
        onModeChange={handleModeChange}
      />

      {/* ── Chatmaxxing mode: existing 4-column grid, completely unchanged ── */}
      {uiMode === 'chatmaxxing' && (
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
      )}

      {/* ── Triple-chat mode: 3-column grid, first 3 slots ────────────────── */}
      {uiMode === 'triple-chat' && (
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          padding: 12,
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {slots.slice(0, 3).map((slot, i) => (
            <ChatColumn key={i} slotIndex={i} slot={slot} />
          ))}
        </div>
      )}

      {/* ── Double-chat mode: 2-column grid, first 2 slots ──────────────── */}
      {uiMode === 'double-chat' && (
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          padding: 12,
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {slots.slice(0, 2).map((slot, i) => (
            <ChatColumn key={i} slotIndex={i} slot={slot} />
          ))}
        </div>
      )}

      {/* ── Focusing mode: visual layer + hidden ChatColumns for effects ──── */}
      {uiMode === 'focusing' && (
        <>
          {/* Hidden ChatColumns — keep autopilot effects, ACW generation, and
              NBR fetch logic running. Visually suppressed; the FocusingDesktop
              provides all interaction surfaces. */}
          <div style={{
            position: 'fixed', width: 0, height: 0,
            overflow: 'hidden', opacity: 0, pointerEvents: 'none',
            zIndex: -1,
          }}>
            {slots.map((slot, i) => (
              <ChatColumn key={i} slotIndex={i} slot={slot} />
            ))}
          </div>

          <FocusingDesktop />
        </>
      )}

      {/* ── CCP dropdown — always in DOM so Streams iframe keeps running ─── */}
      <div ref={ccpPanelRef} style={{
        position: 'fixed', top: 56, right: 20, zIndex: 2000,
        width: 320, borderRadius: '0 0 12px 12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        display: ccpOpen ? 'block' : 'none',
      }}>
        <div ref={ccpRef} style={{ width: 320, height: 500, background: '#fff' }} />
      </div>

      {!agentConnected && <LoginOverlay />}
    </div>
  );
}
