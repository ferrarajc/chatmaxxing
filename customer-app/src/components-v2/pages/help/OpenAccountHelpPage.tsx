import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function OpenAccountHelpPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Opening a New Account</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        You can open a new account online in about 10 minutes. No minimum investment required for most account types.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Account Types Available</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: theme.color.bg }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Account Type</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Best For</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Minimum to Open</th>
            </tr>
          </thead>
          <tbody>
            {[
              { type: 'Roth IRA', best: 'Tax-free retirement growth (income limits apply)', min: '$1' },
              { type: 'Traditional IRA', best: 'Tax-deferred retirement savings', min: '$1' },
              { type: 'SEP-IRA', best: 'Self-employed / small business owners', min: '$1' },
              { type: 'Individual Taxable', best: 'Flexible investing beyond retirement accounts', min: '$1' },
              { type: 'Joint Taxable', best: 'Two account holders with equal ownership', min: '$1' },
              { type: 'Custodial (UTMA)', best: 'Investing for a minor child', min: '$1' },
            ].map((row, i) => (
              <tr key={row.type} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, fontWeight: 500 }}>{row.type}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.best}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.min}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>What You Need to Apply</h2>
        <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Social Security Number (SSN) or Individual Taxpayer Identification Number (ITIN)</li>
          <li>Government-issued photo ID (driver's license, passport)</li>
          <li>Your bank account information to fund the new account</li>
          <li>Beneficiary information (name, date of birth, SSN optional but recommended)</li>
        </ul>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          Most accounts are opened instantly after identity verification. A small number may require additional documentation and take 1–3 business days.
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/open-account" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Start Your Application →
        </NavLink>
      </div>
    </div>
  );
}
