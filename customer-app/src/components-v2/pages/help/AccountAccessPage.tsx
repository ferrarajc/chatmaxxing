import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function AccountAccessPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Password Reset &amp; Account Access</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Locked out or having login trouble? Here is how to quickly restore access to your account.
      </p>

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
