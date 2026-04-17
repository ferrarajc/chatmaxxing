import React, { useState, KeyboardEvent } from 'react';

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

  return (
    <div style={{
      borderTop: '1px solid #e5e7eb', padding: '10px 12px',
      display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0, background: '#fff',
    }}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={onKey}
        disabled={disabled}
        placeholder="Type a message…"
        rows={1}
        style={{
          flex: 1, resize: 'none', border: '1.5px solid #d1d5db', borderRadius: 10,
          padding: '8px 12px', fontSize: 14, outline: 'none',
          fontFamily: 'inherit', lineHeight: 1.4,
          opacity: disabled ? 0.5 : 1,
        }}
      />
      <button
        onClick={submit}
        disabled={!text.trim() || disabled}
        style={{
          width: 36, height: 36, borderRadius: '50%', border: 'none',
          background: text.trim() && !disabled ? '#1a56db' : '#d1d5db',
          color: '#fff', cursor: text.trim() && !disabled ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          transition: 'background .15s', flexShrink: 0,
        }}
        aria-label="Send"
      >➤</button>
    </div>
  );
}
