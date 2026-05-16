import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function DripPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Dividend Reinvestment (DRIP)</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Automatically reinvest your dividends and capital gain distributions to buy more shares — no extra work required. Compounding at its best.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>How DRIP Works</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          When a BobsFunds fund declares a dividend or capital gain distribution, instead of receiving cash, you automatically receive additional shares at the current NAV. Over time, this compounding effect can meaningfully boost your returns.
        </p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <strong>Example:</strong> You hold 500 shares of BF500. The fund declares a $0.45/share dividend. DRIP buys you an additional 1.03 shares (at $218.40 NAV) rather than sending you $225 in cash.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Enabling DRIP</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>DRIP is enabled by default on all new accounts</li>
          <li>To verify or change your setting: My Account &gt; Dividend Preferences</li>
          <li>You can set DRIP preferences per fund (reinvest in same fund) or across funds</li>
          <li>Changes take effect for the next distribution after the next distribution record date</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Tax Considerations</h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Even when dividends are automatically reinvested, they are still taxable in the year received (for taxable accounts). Each reinvested dividend increases your cost basis. Bob's Mutual Funds tracks all DRIP purchases for accurate cost basis reporting on your 1099-B.
        </p>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          In tax-advantaged accounts (IRA, Roth IRA), dividends reinvested via DRIP are not taxable events. This is one of the many benefits of holding funds inside retirement accounts.
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/account/auto-invest" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Manage Dividend Reinvestment →
        </NavLink>
      </div>
    </div>
  );
}
