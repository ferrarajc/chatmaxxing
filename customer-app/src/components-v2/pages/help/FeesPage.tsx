import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function FeesPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Fee Schedule &amp; Expense Ratios</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Transparent pricing on all Bob's Mutual Funds products. We believe low costs are one of the biggest drivers of long-term returns.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Fund Expense Ratios</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 16 }}>
          <thead>
            <tr style={{ background: theme.color.bg }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Fund</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Ticker</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Annual Expense Ratio</th>
            </tr>
          </thead>
          <tbody>
            {[
              { fund: 'BobsFunds 500 Index', ticker: 'BF500', ratio: '0.03%' },
              { fund: 'BobsFunds Growth', ticker: 'BFGR', ratio: '0.25%' },
              { fund: 'BobsFunds Bond Income', ticker: 'BFBI', ratio: '0.10%' },
              { fund: 'BobsFunds International', ticker: 'BFIN', ratio: '0.20%' },
              { fund: 'BobsFunds ESG Leaders', ticker: 'BFESG', ratio: '0.18%' },
              { fund: 'BobsFunds Short-Term Treasury', ticker: 'BFST', ratio: '0.08%' },
            ].map((row, i) => (
              <tr key={row.ticker} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.fund}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, fontWeight: 600 }}>{row.ticker}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.ratio}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          Expense ratios are charged annually as a percentage of your investment and are reflected in the fund's daily NAV — no separate fee is deducted from your account.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Account Fees</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li><strong>Account maintenance fee:</strong> None</li>
          <li><strong>IRA annual fee:</strong> None</li>
          <li><strong>Trading fee:</strong> $0 for all BobsFunds mutual funds</li>
          <li><strong>Wire transfer (outgoing):</strong> $25 per wire</li>
          <li><strong>Overnight check delivery:</strong> $25</li>
          <li><strong>Paper statement fee:</strong> $2/month (free with paperless enrollment)</li>
        </ul>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/research" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Explore Our Funds →
        </NavLink>
      </div>
    </div>
  );
}
