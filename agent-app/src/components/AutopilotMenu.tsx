import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  AutomationItem,
  GLOBAL_AUTOMATIONS,
  TASK_AUTOMATIONS,
  ALL_AUTOMATIONS,
  matchAutomations,
} from '../data/automations';

const MENU_WIDTH = 260;
const MARGIN = 6;

interface Props {
  onSelect: (item: AutomationItem) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

// ── Icons ──────────────────────────────────────────────────────────────────
// Hand-written in the house lucide idiom (see ChatColumn/AISupport) — the app
// carries no icon dependency. 🌐 = global automation, 📄 = task automation.
const iconProps = {
  width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
};

function GlobeIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="15" y2="13" />
      <line x1="8" y1="17" x2="15" y2="17" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg {...iconProps} width={12} height={12}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────
function AutomationRow({ item, active, onPick, onHover }: {
  item: AutomationItem;
  active: boolean;
  onPick: () => void;
  onHover: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Keep the keyboard-selected row in view as ↑/↓ walk past the scroll edge.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div
      ref={ref}
      role="menuitem"
      aria-selected={active}
      onClick={onPick}
      // Keep focus in the filter box so ↑/↓/Enter/Esc keep working after a hover-click.
      onMouseDown={e => e.preventDefault()}
      onMouseEnter={onHover}
      title={item.kind === 'task' ? item.description : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', cursor: 'pointer',
        background: active ? '#f1f5f9' : 'transparent',
      }}
    >
      <span style={{
        display: 'flex', flexShrink: 0,
        color: item.kind === 'global' ? '#2563eb' : '#64748b',
      }}>
        {item.kind === 'global' ? <GlobeIcon /> : <DocumentIcon />}
      </span>
      <span style={{
        fontSize: 12, fontWeight: 600, color: '#1e293b',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{item.label}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '6px 12px 3px', fontSize: 9.5, fontWeight: 700,
      color: '#94a3b8', letterSpacing: '.5px', textTransform: 'uppercase',
    }}>{children}</div>
  );
}

export function AutopilotMenu({ onSelect, onClose, anchorRef }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<
    { left: number; top?: number; bottom?: number; maxHeight?: number } | null
  >(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filtering = query.trim().length > 0;
  // Empty query keeps the two groups (globals pinned above the scroll area);
  // a query collapses everything into one ranked list.
  const results = useMemo(
    () => (filtering ? matchAutomations(query, ALL_AUTOMATIONS) : []),
    [query, filtering],
  );
  // Flat order the keyboard walks — must match render order exactly.
  const visible = filtering ? results : [...GLOBAL_AUTOMATIONS, ...TASK_AUTOMATIONS];

  // Position: flip above/below by available space, clamp to the viewport, and
  // cap the height so a 24-row list scrolls instead of running off-screen.
  // (Same approach as ChangeToMenu.)
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const rect = anchor.getBoundingClientRect();
    const menuH = menu.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom - MARGIN * 2;
    const spaceAbove = rect.top - MARGIN * 2;
    const left = Math.max(
      8,
      Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8),
    );
    if (menuH <= spaceAbove) {
      setPos({ left, bottom: window.innerHeight - rect.top + MARGIN });
    } else if (menuH <= spaceBelow) {
      setPos({ left, top: rect.bottom + MARGIN });
    } else if (spaceAbove >= spaceBelow) {
      setPos({ left, bottom: window.innerHeight - rect.top + MARGIN, maxHeight: spaceAbove });
    } else {
      setPos({ left, top: rect.bottom + MARGIN, maxHeight: spaceBelow });
    }
  }, [anchorRef]);

  // Focus the filter box as soon as the menu opens — typing is the fast path.
  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, anchorRef]);

  // Escape lives at document level so it still closes the menu if focus has
  // drifted out of the filter box. First Esc clears a query; a second closes.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (filtering) { setQuery(''); setActiveIndex(0); }
      else onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, filtering]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (visible.length === 0) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex(i => (i + delta + visible.length) % visible.length);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = visible[activeIndex];
      if (item) onSelect(item);
    }
  };

  const rowFor = (item: AutomationItem) => {
    const idx = visible.indexOf(item);
    return (
      <AutomationRow
        key={item.key}
        item={item}
        active={idx === activeIndex}
        onPick={() => onSelect(item)}
        onHover={() => setActiveIndex(idx)}
      />
    );
  };

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      role="menu"
      onClick={e => e.stopPropagation()}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        left: pos?.left ?? 0,
        top: pos?.top,
        bottom: pos?.bottom,
        maxHeight: pos?.maxHeight,
        // Hidden for the first paint while the height is measured.
        visibility: pos ? 'visible' : 'hidden',
        display: 'flex', flexDirection: 'column',
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,.14)',
        width: MENU_WIDTH, zIndex: 9999, overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px 7px', borderBottom: '1px solid #f3f4f6', flexShrink: 0,
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

      {/* Filter */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        margin: '7px 10px', padding: '5px 8px',
        border: '1px solid #d1d5db', borderRadius: 6, color: '#9ca3af',
      }}>
        <SearchIcon />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
          placeholder="Type to find…"
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none',
            fontSize: 12, fontFamily: 'inherit', color: '#1e293b', background: 'transparent',
          }}
        />
      </div>

      {/* One scroll area for the whole list. The globals sit at the top so they are
          the first thing seen on open; scrolling them away is fine. Only the header
          and the filter box stay pinned. */}
      <div style={{ overflowY: 'auto', minHeight: 0, paddingBottom: 4 }}>
        {filtering ? (
          visible.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#9ca3af' }}>
              No automations match “{query.trim()}”.
            </div>
          ) : visible.map(rowFor)
        ) : (
          <>
            <SectionLabel>Global</SectionLabel>
            {GLOBAL_AUTOMATIONS.map(rowFor)}
            <div style={{ borderTop: '1px solid #f3f4f6', margin: '4px 0 0' }} />
            <SectionLabel>Tasks</SectionLabel>
            {TASK_AUTOMATIONS.map(rowFor)}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
