import React from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../../../theme';
import { card } from './ui';

const TILES = [
  { to: '/account/beneficiaries', icon: '👪', title: 'Beneficiaries', desc: 'Designate who inherits your retirement accounts.' },
  { to: '/account/auto-invest',   icon: '🔁', title: 'Automatic investments', desc: 'Manage recurring contributions and schedules.' },
  { to: '/account/rmd',           icon: '📆', title: 'Required distributions', desc: 'Review RMD status and delivery preferences.' },
  { to: '/account/tax-documents', icon: '🧾', title: 'Tax documents', desc: 'Download 1099s, 5498s, and other tax forms.' },
  { to: '/transactions',          icon: '📜', title: 'Transaction history', desc: 'Search and filter your full activity history.' },
  { to: '/open-account',          icon: '➕', title: 'Open an account', desc: 'Add a new IRA, SEP-IRA, or taxable account.' },
];

export function AccountServicesGrid() {
  return (
    <div style={{ ...card, padding: 24 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600, color: theme.color.text, fontFamily: theme.font.serif, letterSpacing: '-0.01em' }}>
        Account services & documents
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, gridAutoRows: '1fr' }}>
        {TILES.map(t => (
          <Link
            key={t.to}
            to={t.to}
            style={{
              display: 'flex', flexDirection: 'column', textDecoration: 'none',
              border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: '16px 18px',
              background: theme.color.surface, transition: 'box-shadow .15s, border-color .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = theme.shadow.md; e.currentTarget.style.borderColor = theme.color.borderStrong; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = theme.color.border; }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>{t.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: theme.color.text, marginBottom: 3 }}>{t.title}</div>
            <div style={{ fontSize: 12.5, color: theme.color.textMuted, lineHeight: 1.45 }}>{t.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
