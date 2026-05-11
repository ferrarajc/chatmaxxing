import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatMessage as Msg } from '../../types';
import { theme } from '../../theme';

interface Props { message: Msg; }

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

function isInternalPath(url: string): string | null {
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.origin !== window.location.origin) return null;
    let path = parsed.pathname;
    if (BASE && path.startsWith(BASE)) path = path.slice(BASE.length) || '/';
    return path;
  } catch {
    return null;
  }
}

function renderWithLinks(content: string, navigate: (path: string) => void): React.ReactNode[] {
  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const urlRegex = /https?:\/\/[^\s)]+/g;

  const result: React.ReactNode[] = [];
  let lastIndex = 0;

  const allMatches: Array<{ index: number; length: number; node: React.ReactNode }> = [];

  let m: RegExpExecArray | null;

  mdLinkRegex.lastIndex = 0;
  while ((m = mdLinkRegex.exec(content)) !== null) {
    const label = m[1];
    const url = m[2];
    const internalPath = isInternalPath(url);
    allMatches.push({
      index: m.index,
      length: m[0].length,
      node: internalPath ? (
        <button
          key={m.index}
          onClick={() => navigate(internalPath)}
          style={{
            display: 'inline-block', margin: '2px 0',
            padding: '5px 12px', borderRadius: theme.radius.pill,
            background: theme.color.primarySoft, color: theme.color.primary,
            border: `1px solid ${theme.color.primarySoftBorder}`,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: theme.font.sans,
          }}
        >{label}</button>
      ) : (
        <a key={m.index} href={url} target="_blank" rel="noopener noreferrer"
          style={{ color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' }}
        >{label}</a>
      ),
    });
  }

  urlRegex.lastIndex = 0;
  while ((m = urlRegex.exec(content)) !== null) {
    const alreadyCovered = allMatches.some(am => m!.index >= am.index && m!.index < am.index + am.length);
    if (alreadyCovered) continue;
    const url = m[0];
    const internalPath = isInternalPath(url);
    allMatches.push({
      index: m.index,
      length: url.length,
      node: internalPath ? (
        <button
          key={m.index}
          onClick={() => navigate(internalPath)}
          style={{
            display: 'inline-block', margin: '2px 0',
            padding: '5px 12px', borderRadius: theme.radius.pill,
            background: theme.color.primarySoft, color: theme.color.primary,
            border: `1px solid ${theme.color.primarySoftBorder}`,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: theme.font.sans,
          }}
        >{url}</button>
      ) : (
        <a key={m.index} href={url} target="_blank" rel="noopener noreferrer"
          style={{ color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' }}
        >{url}</a>
      ),
    });
  }

  allMatches.sort((a, b) => a.index - b.index);

  for (const match of allMatches) {
    if (match.index > lastIndex) result.push(content.slice(lastIndex, match.index));
    result.push(match.node);
    lastIndex = match.index + match.length;
  }
  if (lastIndex < content.length) result.push(content.slice(lastIndex));

  return result.length > 0 ? result : [content];
}

export function ChatMessage({ message }: Props) {
  const navigate = useNavigate();
  const isCustomer = message.role === 'CUSTOMER';
  const isSystem = message.role === 'SYSTEM';

  if (isSystem) {
    return (
      <div style={{
        textAlign: 'center', fontSize: 12, color: theme.color.textSubtle,
        padding: '4px 0', fontStyle: 'italic',
      }}>
        {message.content}
      </div>
    );
  }

  const isAgent = message.role === 'AGENT';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isCustomer ? 'flex-end' : 'flex-start',
      gap: 8,
      alignItems: 'flex-end',
    }}>
      {!isCustomer && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: isAgent ? theme.color.accent : theme.color.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: theme.color.textOnPrimary, flexShrink: 0,
          fontWeight: 600, letterSpacing: '0.04em',
        }}>
          {isAgent ? 'A' : 'B'}
        </div>
      )}
      <div style={{
        maxWidth: '75%',
        background: isCustomer ? theme.color.customerBubble : theme.color.botBubble,
        color: isCustomer ? theme.color.textOnPrimary : theme.color.text,
        borderRadius: isCustomer ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        padding: '9px 13px',
        fontSize: 14, lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        textAlign: 'left',
        border: isCustomer ? 'none' : `1px solid ${theme.color.border}`,
      }}>
        {renderWithLinks(message.content, navigate)}
      </div>
    </div>
  );
}
