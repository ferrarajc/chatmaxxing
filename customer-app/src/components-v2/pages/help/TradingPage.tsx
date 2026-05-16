import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function TradingPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Trading Hours &amp; Order Types</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Understand when and how to buy or sell BobsFunds mutual fund shares.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Trading Hours</h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          BobsFunds mutual funds trade once per day at their <strong>Net Asset Value (NAV)</strong>, calculated after the close of the NYSE at <strong>4:00 PM Eastern Time</strong>.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Orders received before 4:00 PM ET receive the same-day NAV</li>
          <li>Orders received after 4:00 PM ET receive the next business day NAV</li>
          <li>Funds do not trade on NYSE holidays or weekends</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Order Types</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: theme.color.bg }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Order Type</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>How It Works</th>
            </tr>
          </thead>
          <tbody>
            {[
              { type: 'Market (Dollar Amount)', how: 'Buy a specific dollar amount; shares calculated at NAV' },
              { type: 'Market (Share Amount)', how: 'Buy a specific number of shares at NAV' },
              { type: 'Exchange', how: 'Swap from one BobsFunds fund to another on the same day' },
              { type: 'Redemption', how: 'Sell shares; proceeds sent via ACH or wire' },
            ].map((row, i) => (
              <tr key={row.type} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, fontWeight: 500 }}>{row.type}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Settlement</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Mutual fund trades settle on T+1 (next business day). Redemption proceeds via ACH are typically available in 2–3 business days. Wire transfers are same-day if requested before 2:00 PM ET.
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/portfolio" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Go to Your Portfolio →
        </NavLink>
      </div>
    </div>
  );
}
