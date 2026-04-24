import React from 'react';
import { ChatMessage as Msg } from '../../types';

interface Props { message: Msg; }

/** Splits content on URLs and renders them as clickable <a> tags. */
function renderWithLinks(content: string): React.ReactNode[] {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      result.push(content.slice(lastIndex, match.index));
    }
    const url = match[0];
    result.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' }}
      >
        {url}
      </a>,
    );
    lastIndex = match.index + url.length;
  }
  if (lastIndex < content.length) {
    result.push(content.slice(lastIndex));
  }
  return result.length > 0 ? result : [content];
}

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
        textAlign: 'left',
      }}>
        {renderWithLinks(message.content)}
      </div>
    </div>
  );
}
