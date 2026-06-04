import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

const h2: React.CSSProperties = { margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif };
const ul: React.CSSProperties = { margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text };

export function WithdrawalsPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Withdrawals &amp; Distributions</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        How to take money out of your Bob's Mutual Funds accounts — from selling shares to getting the cash to your bank, plus what to know about retirement distributions.
      </p>

      <div style={card}>
        <h2 style={h2}>Taking Money Out, Step by Step</h2>
        <ul style={ul}>
          <li><strong>Make the cash available.</strong> If your money is invested, sell the holdings you need from your Portfolio page. Proceeds settle in about 1 business day.</li>
          <li><strong>Choose how to move it.</strong> Send the available cash to your linked bank by ACH (free) or by wire (same-day, $25).</li>
          <li><strong>Confirm and submit.</strong> Review the amount and destination, then submit. You can track the status from your Account page.</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={h2}>ACH vs. Wire</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: theme.color.bg }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Method</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Timeline</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Fee</th>
            </tr>
          </thead>
          <tbody>
            {[
              { method: 'ACH transfer', timeline: '1–3 business days', fee: 'Free' },
              { method: 'Wire transfer (outgoing)', timeline: 'Same day (before 2 PM ET)', fee: '$25' },
            ].map((row, i) => (
              <tr key={row.method} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.method}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.timeline}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.fee}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: '14px 0 0', fontSize: 13, color: theme.color.textMuted }}>
          Need wire routing details? See the <NavLink to="/help/wire-transfer" style={{ color: theme.color.primary, fontWeight: 600 }}>wire transfer guide</NavLink>.
        </p>
      </div>

      <div style={card}>
        <h2 style={h2}>Withdrawing From a Retirement Account</h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          A withdrawal from an IRA is a <strong>distribution</strong>, and the tax treatment depends on the account:
        </p>
        <ul style={{ ...ul, marginBottom: 16 }}>
          <li><strong>Traditional IRA:</strong> distributions are generally taxed as ordinary income; a 10% penalty may apply before age 59½.</li>
          <li><strong>Roth IRA:</strong> qualified withdrawals are tax-free; your contributions can be withdrawn anytime without tax or penalty.</li>
          <li><strong>Age 73+:</strong> you may have a required minimum distribution (RMD) to take each year.</li>
        </ul>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          Because retirement withdrawals affect your taxes, consider planning the timing with a tax professional. You can review your RMD status on the <NavLink to="/account/rmd" style={{ color: theme.color.primary, fontWeight: 600 }}>RMD page</NavLink>.
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
