import React, { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';
import { useFunds } from '../../../hooks/useFunds';
import { FundGroup } from '../../../data/funds';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

const GROUP_ORDER: FundGroup[] = ['US Equity', 'Sector Equity', 'International', 'Fixed Income'];

export function FeesPage() {
  const { funds } = useFunds();

  // Sorted by asset-class family, then by name within each family — so the long table reads
  // in a sensible order as the lineup grows.
  const sorted = useMemo(() => {
    const rank = (g: FundGroup) => GROUP_ORDER.indexOf(g);
    return [...funds].sort((a, b) => rank(a.group) - rank(b.group) || a.name.localeCompare(b.name));
  }, [funds]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Fee Schedule &amp; Expense Ratios</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Transparent pricing on all Bob's Mutual Funds products. We believe low costs are one of the biggest drivers of long-term returns.
      </p>

      {/* General account-fee info first, so it's never buried as the fund lineup grows. */}
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
        <div style={{ marginTop: 16, background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          Expense ratios are charged annually as a percentage of your investment and are reflected in the fund's daily NAV — no separate fee is deducted from your account.
        </div>
      </div>

      {/* The long, growing fund table comes last. */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Fund Expense Ratios</h2>
          <span style={{ fontSize: 12, color: theme.color.textMuted }}>{sorted.length} funds</span>
        </div>
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: theme.color.bg }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700, position: 'sticky', top: 0, background: theme.color.bg }}>Fund</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700, position: 'sticky', top: 0, background: theme.color.bg }}>Ticker</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700, position: 'sticky', top: 0, background: theme.color.bg }}>Annual Expense Ratio</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={row.ticker} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.name}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, fontWeight: 600 }}>{row.ticker}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.expenseRatio.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/research" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Explore Our Funds →
        </NavLink>
      </div>
    </div>
  );
}
