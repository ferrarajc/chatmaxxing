import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

interface AccessLevel {
  name: string;
  tag: string;
  can: string[];
  cant: string[];
  note?: string;
}

const ACCESS_LEVELS: AccessLevel[] = [
  {
    name: 'View-only access',
    tag: 'Look, but don’t touch',
    can: [
      'View balances, holdings, and performance',
      'See full transaction history',
    ],
    cant: [
      'Buy or sell investments',
      'Move money or take distributions',
      'Change any account settings',
    ],
  },
  {
    name: 'Limited access',
    tag: 'Help manage — money stays with you',
    can: [
      'Everything View-only can do',
      'Buy investments',
      'Move assets between your own Bob’s accounts',
      'Request distributions — paid only to you, at your address or bank on record',
    ],
    cant: [
      'Send money to anyone other than you',
      'Write checks on the account',
      'Change account ownership or beneficiaries',
      'Open or close accounts',
    ],
  },
  {
    name: 'Full access',
    tag: 'Complete authority',
    can: [
      'Buy and sell investments',
      'Transfer or withdraw assets, including to outside accounts',
      'Update personal and banking information',
      'Close the account — no prior approval needed',
    ],
    cant: [],
    note: 'No restrictions — this person can act on the account just like you.',
  },
];

const liStyle: React.CSSProperties = { display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' };
const ulStyle: React.CSSProperties = { margin: 0, padding: 0, listStyle: 'none', fontSize: 13, lineHeight: 1.5, color: theme.color.text };
const colHeader: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 };

function LevelCard({ level }: { level: AccessLevel }) {
  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, fontFamily: theme.font.serif }}>{level.name}</h3>
        <span style={{ fontSize: 12, color: theme.color.textMuted }}>{level.tag}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 28px' }}>
        <div>
          <div style={{ ...colHeader, color: '#16a34a' }}>Can</div>
          <ul style={ulStyle}>
            {level.can.map((c, i) => (
              <li key={i} style={liStyle}><span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span><span>{c}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <div style={{ ...colHeader, color: '#b91c1c' }}>Can’t</div>
          {level.cant.length > 0 ? (
            <ul style={ulStyle}>
              {level.cant.map((c, i) => (
                <li key={i} style={liStyle}><span style={{ color: '#b91c1c', fontWeight: 700 }}>✕</span><span>{c}</span></li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: theme.color.textMuted, fontStyle: 'italic', lineHeight: 1.5 }}>{level.note}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function AccountAccessPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Account Access</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Choose who can access your account and how much they can do — and get back in quickly if you’re locked out.
      </p>

      <div style={{ marginBottom: 36 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, fontFamily: theme.font.serif }}>Authorized Account Access</h2>
        <p style={{ margin: '0 0 18px', fontSize: 14, color: theme.color.textMuted, lineHeight: 1.6 }}>
          You can let someone else — a spouse, family member, or advisor — access your account, and you choose exactly how much they can do. There are three levels:
        </p>
        {ACCESS_LEVELS.map(level => <LevelCard key={level.name} level={level} />)}
        <p style={{ margin: '4px 0 0', fontSize: 13, color: theme.color.textMuted, lineHeight: 1.6 }}>
          To add an authorized user, start a chat with us — we’ll verify the details and set it up. You can change or remove access at any time.
        </p>
      </div>

      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 800, fontFamily: theme.font.serif }}>Login &amp; Password Help</h2>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Reset Your Password</h2>
        <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Go to the login page and click <strong>Forgot Password</strong></li>
          <li>Enter your email address on file</li>
          <li>Check your email for a reset link (valid for 30 minutes)</li>
          <li>Create a new password: 8+ characters, one uppercase letter, one number, one symbol</li>
        </ul>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          If you do not receive the reset email within 5 minutes, check your spam folder. Emails come from noreply@bobsmutualfunds.com.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Two-Factor Authentication (2FA)</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          We require 2FA for all accounts. If you have lost access to your 2FA device, call 1-800-BOB-FUND with your SSN (last 4 digits), account number, and security question answers. 2FA resets take up to 1 business day.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Account Locked After Too Many Attempts</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          After 5 failed login attempts, your account locks for 30 minutes. After the wait, use the password reset flow or contact support for immediate assistance.
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/account" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Go to Account Settings →
        </NavLink>
      </div>
    </div>
  );
}
