import React from 'react';

interface Props { onClick: () => void; }

export function ChatBubbleFAB({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label="Open chat"
      style={{
        position: 'fixed', bottom: 28, right: 28,
        width: 60, height: 60, borderRadius: '50%',
        background: '#1a56db', color: '#fff', border: 'none',
        boxShadow: '0 4px 20px rgba(26,86,219,0.4)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, zIndex: 9000, transition: 'transform .15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      💬
    </button>
  );
}
