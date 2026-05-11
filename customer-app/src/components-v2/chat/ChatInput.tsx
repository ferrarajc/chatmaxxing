import React, { useState, KeyboardEvent } from 'react';
import { theme } from '../../theme';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = !!text.trim() && !disabled;

  return (
    <div style={{
      borderTop: `1px solid ${theme.color.border}`, padding: '12px 14px',
      display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0,
      background: theme.color.surface,
    }}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={onKey}
        disabled={disabled}
        placeholder="Type a message…"
        rows={1}
        style={{
          flex: 1, resize: 'none',
          border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md,
          padding: '9px 12px', fontSize: 14, outline: 'none',
          fontFamily: theme.font.sans, lineHeight: 1.45,
          color: theme.color.text, background: theme.color.surface,
          opacity: disabled ? 0.5 : 1,
          transition: 'border-color .15s',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = theme.color.primary)}
        onBlur={e => (e.currentTarget.style.borderColor = theme.color.border)}
      />
      <button
        onClick={submit}
        disabled={!canSend}
        style={{
          width: 38, height: 38, borderRadius: '50%', border: 'none',
          background: canSend ? theme.color.primary : theme.color.surfaceMuted,
          color: canSend ? theme.color.textOnPrimary : theme.color.textSubtle,
          cursor: canSend ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background .15s', flexShrink: 0,
        }}
        aria-label="Send"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      </button>
    </div>
  );
}
