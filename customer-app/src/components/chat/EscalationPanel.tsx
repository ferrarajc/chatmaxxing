import React from 'react';
import { useChatStore } from '../../store/chatStore';

interface Props {
  onConnectByChat: () => void;
  onRequestCallback: () => void;
}

export function EscalationPanel({ onConnectByChat, onRequestCallback }: Props) {
  const waitTime = useChatStore(s => s.escalationWaitTime);

  return (
    <div style={{
      borderTop: '1px solid #e5e7eb', padding: '14px 16px',
      background: '#f9fafb', flexShrink: 0,
    }}>
      <p style={{ margin: '0 0 10px', fontSize: 14, color: '#374151', fontWeight: 500 }}>
        How would you like to connect?
      </p>
      <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
        <button
          onClick={onConnectByChat}
          style={{
            padding: '10px 16px', borderRadius: 8, border: 'none',
            background: '#1a56db', color: '#fff', fontSize: 14,
            cursor: 'pointer', fontWeight: 600, textAlign: 'left',
          }}
        >
          💬 Chat with an agent
          {waitTime !== null && (
            <span style={{ fontWeight: 400, opacity: 0.85, marginLeft: 8 }}>
              ~{waitTime} min wait
            </span>
          )}
        </button>
        <button
          onClick={onRequestCallback}
          style={{
            padding: '10px 16px', borderRadius: 8,
            border: '1.5px solid #1a56db', background: '#fff',
            color: '#1a56db', fontSize: 14, cursor: 'pointer',
            fontWeight: 600, textAlign: 'left',
          }}
        >
          📞 Request a callback
        </button>
      </div>
    </div>
  );
}
