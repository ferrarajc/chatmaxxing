import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function WireTransferPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Wire Transfers &amp; Bank Linking</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Move money into or out of your Bob's Mutual Funds accounts quickly and securely via ACH or wire transfer.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Linking a Bank Account</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Log in and go to My Account &gt; Linked Bank Accounts &gt; Add Account</li>
          <li>Enter your bank routing and account number, or use instant verification via Plaid</li>
          <li>Two small test deposits will appear in 1–2 business days; confirm the amounts to verify the account</li>
          <li>Once verified, your bank account is ready for ACH transfers and SIP funding</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Transfer Methods Compared</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: theme.color.bg }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Method</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Timeline</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Fee</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Limit</th>
            </tr>
          </thead>
          <tbody>
            {[
              { method: 'ACH Transfer', timeline: '2–3 business days', fee: 'Free', limit: '$100,000/day' },
              { method: 'Wire Transfer (incoming)', timeline: 'Same day (if before 4 PM ET)', fee: 'Free', limit: 'No limit' },
              { method: 'Wire Transfer (outgoing)', timeline: 'Same day (if before 2 PM ET)', fee: '$25', limit: 'No limit' },
            ].map((row, i) => (
              <tr key={row.method} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.method}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.timeline}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.fee}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.limit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Incoming Wire Instructions</h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          To send a wire to Bob's Mutual Funds, provide your bank with the following:
        </p>
        <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li><strong>Receiving Bank:</strong> First National Bank of Funds (FNBF)</li>
          <li><strong>ABA Routing Number:</strong> 031000503</li>
          <li><strong>Account Number:</strong> Your Bob's Mutual Funds account number</li>
          <li><strong>For Credit To:</strong> Your full legal name as registered on your account</li>
        </ul>
        <div style={{ background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          Always double-check wire instructions with our support team before sending large wire transfers. We will never change wire instructions via email.
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/account" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Go to Account Settings →
        </NavLink>
      </div>
    </div>
  );
}
