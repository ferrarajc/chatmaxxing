import React, { useRef, useState } from 'react';
import { useConnectStreams } from '../hooks/useConnectStreams';
import { useAgentStore } from '../store/agentStore';
import { TopBar } from './TopBar';
import { ChatColumn } from './ChatColumn';
import { FocusingDesktop } from './FocusingDesktop';

export type UiMode = 'chatmaxxing' | 'triple-chat' | 'double-chat' | 'focusing';

const ALL_MODES: UiMode[] = ['chatmaxxing', 'triple-chat', 'double-chat', 'focusing'];

function getInitialMode(): UiMode {
  try {
    const saved = localStorage.getItem('bobs:uiMode');
    if (ALL_MODES.includes(saved as UiMode)) return saved as UiMode;
  } catch { /* ignore */ }
  return 'chatmaxxing';
}

export function AgentDesktop() {
  const ccpRef = useRef<HTMLDivElement>(null);
  const slots = useAgentStore(s => s.slots);
  const [ccpOpen, setCcpOpen] = useState(false);
  const [uiMode, setUiMode] = useState<UiMode>(getInitialMode);

  useConnectStreams(ccpRef);

  const handleModeChange = (mode: UiMode) => {
    setUiMode(mode);
    try { localStorage.setItem('bobs:uiMode', mode); } catch { /* ignore */ }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <TopBar
        ccpOpen={ccpOpen}
        onToggleCcp={() => setCcpOpen(o => !o)}
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
