import React, { useState } from 'react';

const STORAGE_KEY = 'bobs_access';
const EXPECTED = import.meta.env.VITE_DEMO_CODE ?? '';

export function useAccessGranted(): boolean {
  // If no code is configured, access is always open (dev / local)
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
    } else {
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 48px',
        width: 360, boxShadow: '0 25px 60px rgba(0,0,0,.4)',
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
        <div style={{ fontWeight: 700, fontSize: 20, color: '#0f172a', marginBottom: 6 }}>
          Bob's Mutual Funds
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
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
            border: '1.5px solid #d1d5db', borderRadius: 8,
            padding: '10px 14px', fontSize: 15, outline: 'none',
            marginBottom: 12, fontFamily: 'inherit',
            letterSpacing: '0.1em',
          }}
        />

        <button
          onClick={attempt}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8,
            background: '#1a56db', color: '#fff', border: 'none',
            fontWeight: 600, fontSize: 15, cursor: 'pointer',
          }}
        >
          Enter
        </button>
      </div>
    </div>
  );
}
