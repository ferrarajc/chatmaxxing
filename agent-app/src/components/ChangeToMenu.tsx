import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

interface Props {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  /** Alternative directions; null = not generated yet. */
  options: string[] | null;
  /** True while the options are being generated. */
  loading: boolean;
  onSelect: (option: string) => void;
  onClose: () => void;
}

const MENU_WIDTH = 240;
const MARGIN = 6;

// Dropdown of "Change to" alternative directions, adapted from AutopilotMenu (portal to
// body, anchored, click-outside/Esc close). Opens downward when the full list fits below
// the button, otherwise upward; if neither fits it opens in the roomier direction and
// scrolls. Right-aligned to the anchor.
export function ChangeToMenu({ anchorRef, options, loading, onSelect, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; maxHeight?: number } | null>(null);

  // Measure the rendered menu (pos starts null ⇒ hidden) then place it space-aware.
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
      setPos({ left, top: rect.bottom + MARGIN });                          // open down (full list fits)
    } else if (menuH <= spaceAbove) {
      setPos({ left, bottom: window.innerHeight - rect.top + MARGIN });     // open up (fits above)
    } else if (spaceBelow >= spaceAbove) {
      setPos({ left, top: rect.bottom + MARGIN, maxHeight: spaceBelow });   // roomier below → scroll
    } else {
      setPos({ left, bottom: window.innerHeight - rect.top + MARGIN, maxHeight: spaceAbove }); // scroll up
    }
  }, [anchorRef, options, loading]);

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

  const notReady = options == null || loading;

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: pos?.left ?? -9999,
        top: pos?.top,
        bottom: pos?.bottom,
        visibility: pos ? 'visible' : 'hidden',       // hidden during the measure pass
        width: MENU_WIDTH,
        maxHeight: pos?.maxHeight,
        overflow: pos?.maxHeight ? 'auto' : 'hidden',  // scroll only when capped; else clip corners
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,.16)',
        zIndex: 9999,
      }}
    >
      <div style={{
        padding: '8px 12px 7px', borderBottom: '1px solid #f3f4f6',
        fontWeight: 700, fontSize: 11, color: '#0f172a',
        letterSpacing: '.4px', textTransform: 'uppercase',
        position: 'sticky', top: 0, background: '#fff',
      }}>
        Change to…
      </div>
      {notReady ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, color: '#6b7280', fontSize: 13 }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%',
            border: '2px solid #e5e7eb', borderTopColor: '#1d4ed8',
            display: 'inline-block', animation: 'spin .7s linear infinite',
          }} />
          Finding alternatives…
        </div>
      ) : options.length === 0 ? (
        <div style={{ padding: 12, color: '#9ca3af', fontSize: 13 }}>No alternatives available.</div>
      ) : (
        options.map((opt, i) => (
          <div
            key={i}
            onClick={() => onSelect(opt)}
            style={{
              padding: '9px 12px', cursor: 'pointer', fontSize: 13, color: '#1e293b',
              lineHeight: 1.35, borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f5f9ff')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {opt}
          </div>
        ))
      )}
    </div>,
    document.body,
  );
}
