import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function StatementsPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Account Statements &amp; Reports</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Access your account history, performance reports, and official statements anytime from your online account.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Statement Types &amp; Schedule</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: theme.color.bg }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Statement</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Frequency</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Delivery</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Account Statement', freq: 'Quarterly (and monthly when there is activity)', delivery: 'Email + online' },
              { name: 'Annual Statement', freq: 'Yearly (January)', delivery: 'Email + online' },
              { name: 'Trade Confirmations', freq: 'After each trade', delivery: 'Email + online' },
              { name: 'Performance Report', freq: 'Quarterly', delivery: 'Online only' },
            ].map((row, i) => (
              <tr key={row.name} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, fontWeight: 500 }}>{row.name}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.freq}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.delivery}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Accessing Your Statements</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Log in and go to My Account &gt; Statements &amp; Documents</li>
          <li>Filter by account, year, or document type</li>
          <li>Download statements as PDF</li>
          <li>Statements are retained online for 7 years</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Paperless Enrollment</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Enroll in paperless statements under My Account &gt; Preferences. Paperless clients receive email notification when new statements are ready — usually 5–7 days faster than mail. Paper statement fee of $2/month is waived for paperless accounts.
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/portfolio" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          View Your Portfolio →
        </NavLink>
      </div>
    </div>
  );
}
