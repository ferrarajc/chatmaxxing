import React from 'react';
import { ChatMessage as Msg } from '../../types';

interface Props { message: Msg; }

export function ChatMessage({ message }: Props) {
  const isCustomer = message.role === 'CUSTOMER';
  const isSystem = message.role === 'SYSTEM';

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', fontSize: 12, color: '#888', padding: '2px 0' }}>
        {message.content}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: isCustomer ? 'flex-end' : 'flex-start',
      gap: 6,
      alignItems: 'flex-end',
    }}>
      {!isCustomer && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: message.role === 'AGENT' ? '#10b981' : '#1a56db',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: '#fff', flexShrink: 0,
        }}>
          {message.role === 'AGENT' ? 'A' : '🤖'}
        </div>
      )}
      <div style={{
        maxWidth: '75%',
        background: isCustomer ? '#1a56db' : '#f3f4f6',
        color: isCustomer ? '#fff' : '#111',
        borderRadius: isCustomer ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        padding: '8px 12px',
        fontSize: 14, lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
      }}>
        {message.content}
      </div>
    </div>
  );
}
