import React from 'react';
import { theme } from '../../theme';

interface Props {
  onClick: () => void;
  /** Unread message count received while minimized; 0/undefined hides the badge. */
  unread?: number;
}

/** Docked header bar shown while the chat is minimized — the session stays
 *  fully alive underneath; clicking anywhere on the bar restores the panel. */
export function ChatMinimizedBar({ onClick, unread }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={unread ? `Restore chat (${unread} unread)` : 'Restore chat'}
      style={{
        position: 'fixed', bottom: 0, right: 20, width: 280, zIndex: 9000,
        display: 'flex', alignItems: 'center', gap: 10,
        background: theme.color.primary, color: theme.color.textOnPrimary,
        border: 'none', borderRadius: `${theme.radius.xl}px ${theme.radius.xl}px 0 0`,
        padding: '12px 16px', cursor: 'pointer',
        boxShadow: theme.shadow.lg, fontFamily: theme.font.sans,
        transition: 'background .15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = theme.color.primaryHover)}
      onMouseLeave={e => (e.currentTarget.style.background = theme.color.primary)}
    >
      <span style={{
        fontWeight: 600, fontSize: 14.5, fontFamily: theme.font.serif,
        letterSpacing: '-0.01em', flex: 1, textAlign: 'left',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        Bob's Mutual Funds
      </span>
      {unread ? (
        <span style={{
          minWidth: 20, height: 20, borderRadius: 10, padding: '0 6px',
          background: theme.color.danger, color: '#fff',
          fontSize: 11.5, fontWeight: 700, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxSizing: 'border-box', flexShrink: 0,
        }}>
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
      {/* Chevron-up: restore affordance */}
      <svg
        width="16" height="16" viewBox="0 0 16 16" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true" style={{ opacity: 0.75, flexShrink: 0 }}
      >
        <polyline points="3,10 8,5 13,10" />
      </svg>
    </button>
  );
}
