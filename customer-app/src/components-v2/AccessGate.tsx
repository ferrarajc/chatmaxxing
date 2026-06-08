import React, { useState } from 'react';
import { theme } from '../theme';
import { post } from '../api/client';

const STORAGE_KEY = 'bobs_access';
const EXPECTED = import.meta.env.VITE_DEMO_CODE ?? '';

export function useAccessGranted(): boolean {
  if (!EXPECTED) return true;
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function AccessGate({ children }: { children: React.ReactNode }) {
  const [granted, setGranted] = useState(() => {
    if (!EXPECTED) return true;
    return localStorage.getItem(STORAGE_KEY) === '1';
  });
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);

  if (granted) return <>{children}</>;

  const attempt = () => {
    if (input.trim().toUpperCase() === EXPECTED.toUpperCase()) {
      localStorage.setItem(STORAGE_KEY, '1');
      setGranted(true);
      // Page the site owner (via Pager Doodie) that someone entered the access
      // code, so they can hop in as a live agent. Fire-and-forget; PROD-only so
      // local dev never pages. The gate's own `bobs_access` persistence means
      // this only runs on a fresh/cleared browser, not on normal revisits.
      if (import.meta.env.PROD) {
        post('/client-log', { context: 'access-code-entered' }).catch(() => {});
      }
    } else {
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: theme.color.primaryDeep,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: theme.font.sans,
    }}>
      <div style={{
        background: theme.color.surface, borderRadius: theme.radius.xl, padding: '40px 48px',
        width: 360, boxShadow: theme.shadow.xl,
        textAlign: 'center',
        animation: shake ? 'bobs-shake 0.4s ease' : undefined,
      }}>
        <style>{`
          @keyframes bobs-shake {
            0%,100% { transform: translateX(0); }
            20%      { transform: translateX(-8px); }
            40%      { transform: translateX(8px); }
            60%      { transform: translateX(-6px); }
            80%      { transform: translateX(6px); }
          }
        `}</style>

        <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
        <div style={{
          fontFamily: theme.font.serif, fontWeight: 600, fontSize: 22,
          color: theme.color.text, marginBottom: 6, letterSpacing: '-0.01em',
        }}>
          Bob's Mutual Funds
        </div>
        <div style={{ fontSize: 13, color: theme.color.textMuted, marginBottom: 24 }}>
          This is a private demo. Enter the access code to continue.
        </div>

        <input
          type="password"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          placeholder="Access code"
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            border: `1.5px solid ${theme.color.border}`, borderRadius: theme.radius.md,
            padding: '10px 14px', fontSize: 15, outline: 'none',
            marginBottom: 12, fontFamily: theme.font.sans,
            letterSpacing: '0.1em', color: theme.color.text, background: theme.color.surface,
          }}
        />

        <button
          onClick={attempt}
          style={{
            width: '100%', padding: '11px 0', borderRadius: theme.radius.md,
            background: theme.color.primary, color: theme.color.textOnPrimary, border: 'none',
            fontWeight: 600, fontSize: 15, cursor: 'pointer',
            fontFamily: theme.font.sans, letterSpacing: '0.01em',
          }}
        >
          Enter
        </button>
      </div>
    </div>
  );
}
