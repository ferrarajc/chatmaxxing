import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

interface Props {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  /** Fires with the chosen style (a preset label or the custom text). */
  onSelect: (style: string) => void;
  onClose: () => void;
}

const PRESETS = ['More concise', 'More detailed', 'More casual', 'More formal'];
const MENU_WIDTH = 240;
const MARGIN = 6;

// Dropdown of "Magic" restyle presets + a custom style field. Same portal + space-aware
// open-up/down behavior as ChangeToMenu. Selecting a preset (or typing a custom style + Go)
// restyles the CURRENT suggested reply without changing its meaning.
export function MagicMenu({ anchorRef, onSelect, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; maxHeight?: number } | null>(null);
  const [custom, setCustom] = useState('');

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const rect = anchor.getBoundingClientRect();
    const menuH = menu.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom - MARGIN;
    const spaceAbove = rect.top - MARGIN;
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    if (menuH <= spaceBelow) {
      setPos({ left, top: rect.bottom + MARGIN });
    } else if (menuH <= spaceAbove) {
      setPos({ left, bottom: window.innerHeight - rect.top + MARGIN });
    } else if (spaceBelow >= spaceAbove) {
      setPos({ left, top: rect.bottom + MARGIN, maxHeight: spaceBelow });
    } else {
      setPos({ left, bottom: window.innerHeight - rect.top + MARGIN, maxHeight: spaceAbove });
    }
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

  const submitCustom = () => {
    const v = custom.trim();
    if (v) onSelect(v);
  };

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: pos?.left ?? -9999,
        top: pos?.top,
        bottom: pos?.bottom,
        visibility: pos ? 'visible' : 'hidden',
        width: MENU_WIDTH,
        maxHeight: pos?.maxHeight,
        overflow: pos?.maxHeight ? 'auto' : 'hidden',
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,.16)',
        zIndex: 9999,
      }}
    >
      {PRESETS.map((p, i) => (
        <div
          key={p}
          onClick={() => onSelect(p)}
          style={{
            padding: '9px 12px', cursor: 'pointer', fontSize: 13, color: '#1e293b',
            borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#faf5ff')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {p}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderTop: '1px solid #f3f4f6' }}>
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitCustom(); } }}
          placeholder="Custom style…"
          style={{
            flex: 1, minWidth: 0, fontSize: 13, padding: '5px 8px',
            border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={submitCustom}
          disabled={!custom.trim()}
          style={{
            fontSize: 13, padding: '5px 12px', borderRadius: 6, border: 'none', fontWeight: 600,
            background: custom.trim() ? '#7c3aed' : '#e5e7eb', color: '#fff',
            cursor: custom.trim() ? 'pointer' : 'default',
          }}
        >Go</button>
      </div>
    </div>,
    document.body,
  );
}
