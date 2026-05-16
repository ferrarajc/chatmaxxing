import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatMessage as Msg } from '../../types';

interface Props { message: Msg; }

function renderWithLinks(content: string, navigate: (path: string) => void): React.ReactNode[] {
  // Matches [text](url) markdown links OR bare https:// URLs
  const tokenRegex = /\[([^\]]+)\]\(([^)]+)\)|https?:\/\/[^\s]+/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(content)) !== null) {
    if (match.index > lastIndex) result.push(content.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      // Markdown link [text](url)
      const text = match[1];
      const url = match[2];
      const isRelative = url.startsWith('/');
      result.push(
        <a
          key={match.index}
          href={isRelative ? undefined : url}
          target={isRelative ? undefined : '_blank'}
          rel={isRelative ? undefined : 'noopener noreferrer'}
          onClick={isRelative ? (e) => { e.preventDefault(); navigate(url); } : undefined}
          style={{
            color: '#1a56db', fontWeight: 600,
            textDecoration: 'underline', cursor: 'pointer',
          }}
        >
          {text}
        </a>,
      );
    } else {
      // Bare URL
      const url = match[0];
      result.push(
        <a key={match.index} href={url} target="_blank" rel="noopener noreferrer"
          style={{ color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' }}>
          {url}
        </a>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) result.push(content.slice(lastIndex));
  return result.length > 0 ? result : [content];
}

function ConfirmationCard({ content }: { content: string }) {
  const lines = content.split('\n');
  const refLine = lines.find(l => l.startsWith('Ref:')) ?? '';
  const description = lines.filter(l => l !== 'Confirmation' && l !== refLine && l.trim()).join(' ');
  return (
    <div style={{
      background: '#f0fdf4', border: '1px solid #86efac',
      borderRadius: 12, padding: '10px 14px', maxWidth: '80%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{ color: '#16a34a', fontSize: 15, fontWeight: 700 }}>✓</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#15803d' }}>Confirmation</span>
      </div>
      {refLine && (
        <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace', marginBottom: 3, textAlign: 'left' }}>
          {refLine}
        </div>
      )}
      <div style={{ borderTop: '1px solid #bbf7d0', paddingTop: 8, fontSize: 14, color: '#374151', lineHeight: 1.4, textAlign: 'left' }}>
        {description}
      </div>
    </div>
  );
}

export function ChatMessage({ message }: Props) {
  const navigate = useNavigate();
  const isCustomer = message.role === 'CUSTOMER';
  const isSystem = message.role === 'SYSTEM';

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', fontSize: 12, color: '#888', padding: '2px 0' }}>
        {message.content}
      </div>
    );
  }

  if (message.role === 'AGENT' && message.content.startsWith('Confirmation\n')) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 6, alignItems: 'flex-end' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: '#10b981',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: '#fff', flexShrink: 0,
        }}>A</div>
        <ConfirmationCard content={message.content} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: isCustomer ? 'flex-end' : 'flex-start', gap: 6, alignItems: 'flex-end' }}>
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
        {renderWithLinks(message.content, navigate)}
        {message.link && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            <button
              onClick={() => navigate(message.link!.url)}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: '#1a56db', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4,
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 12 }}>→</span> {message.link.text}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
