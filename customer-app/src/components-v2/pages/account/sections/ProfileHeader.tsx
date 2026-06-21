import React from 'react';
import { useClientStore } from '../../../../store/clientStore';
import { theme } from '../../../../theme';
import { card, Chip } from './ui';

export function ProfileHeader() {
  const p = useClientStore(s => s.activePersona);

  const initials = p.name.split(' ').map(n => n[0]).join('').slice(0, 2);
  const memberSinceYear = p.personal?.memberSince ? p.personal.memberSince.slice(0, 4) : null;
  const verifiedPhone = (p.phones ?? []).some(ph => ph.verified);

  // Profile-completeness checklist.
  const checks = [
    p.emailVerified,
    verifiedPhone,
    !!(p.personal?.maritalStatus && p.personal?.employmentStatus),
    p.security?.twoFactorEnabled,
    !!p.trustedContact,
    !!p.investorProfile,
    (p.bankAccounts ?? []).length > 0,
    (p.beneficiaries ?? []).length > 0,
  ];
  const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return (
    <div style={{ ...card, padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: theme.color.accent, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700,
          fontFamily: theme.font.serif, flexShrink: 0,
        }}>{initials}</div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: theme.color.text, fontFamily: theme.font.serif, letterSpacing: '-0.02em' }}>{p.name}</h1>
          <div style={{ fontSize: 13, color: theme.color.textMuted, marginTop: 3, fontFamily: theme.font.mono }}>
            {p.clientId}{memberSinceYear ? ` · Member since ${memberSinceYear}` : ''}
          </div>
        </div>

        <div style={{ minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: theme.color.textMuted, marginBottom: 5 }}>
            <span>Profile completeness</span>
            <span style={{ fontWeight: 700, color: theme.color.text }}>{pct}%</span>
          </div>
          <div style={{ background: theme.color.border, borderRadius: theme.radius.pill, height: 8 }}>
            <div style={{ width: `${pct}%`, background: pct === 100 ? theme.color.success : theme.color.primary, borderRadius: theme.radius.pill, height: '100%', transition: 'width .3s' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        {p.emailVerified ? <Chip tone="success">✓ Email verified</Chip> : <Chip tone="warning">⏳ Email unverified</Chip>}
        {verifiedPhone ? <Chip tone="success">✓ Phone verified</Chip> : <Chip tone="warning">⏳ Phone unverified</Chip>}
        {p.security?.twoFactorEnabled ? <Chip tone="success">✓ Two-factor on</Chip> : <Chip tone="neutral">Two-factor off</Chip>}
      </div>
    </div>
  );
}
