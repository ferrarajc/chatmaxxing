import React from 'react';
import { useChatStore } from '../../store/chatStore';
import { theme } from '../../theme';

interface Props {
  onConnectByChat: () => void;
  onRequestCallback: () => void;
}

export function EscalationPanel({ onConnectByChat, onRequestCallback }: Props) {
  const waitTime = useChatStore(s => s.escalationWaitTime);

  return (
    <div style={{
      borderTop: `1px solid ${theme.color.border}`, padding: '14px 16px',
      background: theme.color.surfaceWell, flexShrink: 0,
    }}>
      <p style={{
        margin: '0 0 12px', fontSize: 13, color: theme.color.textMuted, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        How would you like to connect?
      </p>
      <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
        <button
          onClick={onConnectByChat}
          style={{
            padding: '11px 16px', borderRadius: theme.radius.md, border: 'none',
            background: theme.color.primary, color: theme.color.textOnPrimary, fontSize: 14,
            cursor: 'pointer', fontWeight: 600, textAlign: 'left',
            fontFamily: theme.font.sans, letterSpacing: '0.01em',
          }}
        >
          Chat with an agent
          {waitTime !== null && (
            <span style={{ fontWeight: 400, opacity: 0.85, marginLeft: 8 }}>
              ~{waitTime} min wait
            </span>
          )}
        </button>
        <button
          onClick={onRequestCallback}
          style={{
            padding: '11px 16px', borderRadius: theme.radius.md,
            border: `1px solid ${theme.color.primary}`, background: theme.color.surface,
            color: theme.color.primary, fontSize: 14, cursor: 'pointer',
            fontWeight: 600, textAlign: 'left',
            fontFamily: theme.font.sans, letterSpacing: '0.01em',
          }}
        >
          Request a callback
        </button>
      </div>
    </div>
  );
}
