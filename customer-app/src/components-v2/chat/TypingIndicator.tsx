import React, { useState, useEffect } from 'react';
import { theme } from '../../theme';

const WAITING_MESSAGES = [
  'Thinking...',
  'Checking your account...',
  'Looking up your holdings...',
  'Reviewing your transactions...',
  'Checking your investments...',
  'One moment...',
];

export function TypingIndicator({ isWaiting = false }: { isWaiting?: boolean }) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (!isWaiting) return;
    const t = setInterval(() => setMsgIndex(i => (i + 1) % WAITING_MESSAGES.length), 2500);
    return () => clearInterval(t);
  }, [isWaiting]);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: theme.color.primary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: theme.color.textOnPrimary, fontWeight: 600,
        letterSpacing: '0.04em',
      }}>B</div>
      <div style={{
        background: theme.color.botBubble, borderRadius: '14px 14px 14px 4px',
        padding: '11px 14px', display: 'flex', gap: 4, alignItems: 'center',
        border: `1px solid ${theme.color.border}`,
        minWidth: isWaiting ? 160 : 'auto',
      }}>
        {isWaiting ? (
          <span style={{
            fontSize: 13, color: theme.color.textSubtle, fontStyle: 'italic',
            transition: 'opacity 0.3s',
          }}>
            {WAITING_MESSAGES[msgIndex]}
          </span>
        ) : (
          [0, 1, 2].map(i => (
            <span key={i} style={{
              width: 6, height: 6, borderRadius: '50%', background: theme.color.textSubtle,
              display: 'inline-block',
              animation: `bobs-bounce 1.2s ${i * 0.2}s infinite`,
            }} />
          ))
        )}
      </div>
      <style>{`@keyframes bobs-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }`}</style>
    </div>
  );
}
