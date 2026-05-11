import React from 'react';
import { theme } from '../../theme';

interface Props { onClick: () => void; }

export function ChatBubbleFAB({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label="Open chat"
      style={{
        position: 'fixed', bottom: 28, right: 28,
        width: 60, height: 60, borderRadius: '50%',
        background: theme.color.primary, color: theme.color.textOnPrimary, border: 'none',
        boxShadow: theme.shadow.fab,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9000, transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.06)';
        e.currentTarget.style.boxShadow = '0 10px 32px rgba(15, 35, 64, 0.36)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = theme.shadow.fab;
      }}
    >
      {/* Outline speech-bubble SVG icon */}
      <svg
        width="26" height="26" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    </button>
  );
}
