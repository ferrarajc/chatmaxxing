import React from 'react';
import { theme } from '../../theme';

// Standalone "Talk to Bob" launcher, stacked just above the chat bubble FAB. Only rendered
// when the experimental feature flag is on.
export function VoiceLaunchFAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Talk to Bob (experimental)"
      style={{
        position: 'fixed', right: 24, bottom: 92, zIndex: 8000,
        display: 'flex', alignItems: 'center', gap: 8,
        background: theme.color.accent, color: '#fff', border: 'none',
        borderRadius: theme.radius.pill, padding: '12px 18px',
        fontSize: 14, fontWeight: 700, fontFamily: theme.font.sans,
        cursor: 'pointer', boxShadow: theme.shadow.fab, letterSpacing: '0.01em',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#8a4d24')}
      onMouseLeave={e => (e.currentTarget.style.background = theme.color.accent)}
    >
      <span style={{ fontSize: 16 }} aria-hidden>🎙</span> Talk to Bob
    </button>
  );
}
