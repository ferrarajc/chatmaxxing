import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function IraLimitsHelpPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>IRA Contribution Limits 2025</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Annual contribution limits set by the IRS for Traditional and Roth IRAs. Maximize your tax-advantaged savings every year.
      </p>

      <div style={{ background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: theme.color.text, marginBottom: 20 }}>
        ⚠ Tax laws change annually. Consult a tax professional for advice specific to your situation. Information below reflects 2025 IRS guidelines.
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>2025 Contribution Limits at a Glance</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 16 }}>
          <thead>
            <tr style={{ background: theme.color.bg }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Account Type</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Under 50</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Age 50+ (Catch-Up)</th>
            </tr>
          </thead>
          <tbody>
            {[
              { type: 'Traditional IRA', under50: '$7,000', over50: '$8,000' },
              { type: 'Roth IRA', under50: '$7,000', over50: '$8,000' },
              { type: 'Combined IRA Limit', under50: '$7,000 total', over50: '$8,000 total' },
              { type: 'SEP-IRA', under50: '25% of compensation, up to $70,000', over50: 'Same' },
            ].map((row, i) => (
              <tr key={row.type} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.type}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.under50}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.over50}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          The $7,000/$8,000 limit applies to the total of all your Traditional and Roth IRA contributions combined — not per account.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Roth IRA Income Limits</h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Your ability to contribute directly to a Roth IRA phases out at higher income levels.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 12 }}>
          <thead>
            <tr style={{ background: theme.color.bg }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Filing Status</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Full Contribution</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Partial</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>No Direct</th>
            </tr>
          </thead>
          <tbody>
            {[
              { status: 'Single / Head of Household', full: 'Under $150,000', partial: '$150,000–$165,000', none: 'Over $165,000' },
              { status: 'Married Filing Jointly', full: 'Under $236,000', partial: '$236,000–$246,000', none: 'Over $246,000' },
              { status: 'Married Filing Separately', full: '$0', partial: '$0–$10,000', none: 'Over $10,000' },
            ].map((row, i) => (
              <tr key={row.status} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.status}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.full}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.partial}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.none}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          If your income exceeds the Roth limit, ask us about a <strong>Backdoor Roth IRA</strong> strategy.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Traditional IRA Deductibility</h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Anyone with earned income can contribute to a Traditional IRA. However, the deductibility depends on whether you (or your spouse) participate in a workplace retirement plan:
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>No workplace plan: fully deductible regardless of income</li>
          <li>Covered by workplace plan, single filer: full deduction up to $79,000 MAGI; phases out up to $89,000</li>
          <li>Covered by workplace plan, married filing jointly: full deduction up to $126,000; phases out up to $146,000</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Contribution Deadlines</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          You may make IRA contributions for a given tax year up to the <strong>tax filing deadline (typically April 15)</strong> of the following year. No extensions are allowed for IRA contributions.
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/open-account" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Open an IRA Account →
        </NavLink>
      </div>
    </div>
  );
}
