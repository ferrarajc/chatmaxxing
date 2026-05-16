import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function SipPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Systematic Investment Plans</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Automate your investing with recurring contributions. Dollar-cost averaging through a SIP helps smooth out market volatility and builds long-term wealth.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>How a SIP Works</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          A Systematic Investment Plan automatically invests a fixed dollar amount into one or more BobsFunds funds on your chosen schedule. Whether markets are up or down, your money goes to work consistently.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Setting Up a SIP</h2>
        <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Log in and go to My Account &gt; Automatic Investments &gt; Set Up New Plan</li>
          <li>Choose your fund(s) and dollar amount (minimum $50 per fund)</li>
          <li>Select frequency: weekly, bi-weekly, monthly, or quarterly</li>
          <li>Choose a linked bank account for funding</li>
          <li>Set a start date (and optional end date)</li>
        </ul>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          Changes and cancellations must be made at least 3 business days before the next scheduled investment date.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Limits and Minimums</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Minimum per investment: $50 per fund</li>
          <li>Maximum: No limit for taxable accounts</li>
          <li>IRA SIPs are subject to annual IRA contribution limits</li>
          <li>You can have multiple SIPs across different funds simultaneously</li>
        </ul>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/account/auto-invest" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Set Up Auto-Invest →
        </NavLink>
      </div>
    </div>
  );
}
