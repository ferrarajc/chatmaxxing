import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { AutopilotScope } from '../types';

const SCOPES: { id: AutopilotScope; label: string; desc: string }[] = [
  { id: 'get-intent',  label: 'Get intent',  desc: "Clarify the customer's need" },
  { id: 'researching', label: 'Researching', desc: 'Send periodic check-ins while you work' },
  { id: 'callback',   label: 'Callback',    desc: 'Collect info & schedule a call' },
  { id: 'idle-check', label: 'Idle check',  desc: 'Check if customer is still there' },
  { id: 'full-auto',  label: 'Full auto',   desc: 'AI handles the full conversation' },
];

interface Props {
  onSelect: (scope: AutopilotScope) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export function AutopilotMenu({ onSelect, onClose, anchorRef }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ bottom: number; right: number } | null>(null);

  // Compute fixed position from anchor button — open upward
  useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      bottom: window.innerHeight - rect.top + 6,
      right: window.innerWidth - rect.right,
    });
  }, [anchorRef]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, anchorRef]);

  if (!pos) return null;

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        bottom: pos.bottom,
        right: pos.right,
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,.14)',
        width: 160, zIndex: 9999,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px 7px', borderBottom: '1px solid #f3f4f6',
      }}>
        <span style={{
          fontWeight: 700, fontSize: 11, color: '#0f172a',
          letterSpacing: '.4px', textTransform: 'uppercase',
        }}>
          Autopilot
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9ca3af', fontSize: 13, lineHeight: 1, padding: '0 2px',
          }}
        >✕</button>
      </div>
      {SCOPES.map((s, i) => (
        <div
          key={s.id}
          onClick={() => onSelect(s.id)}
          style={{
            padding: '7px 12px', cursor: 'pointer',
            borderBottom: i < SCOPES.length - 1 ? '1px solid #f3f4f6' : 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{s.label}</div>
        </div>
      ))}
    </div>,
    document.body,
  );
}
