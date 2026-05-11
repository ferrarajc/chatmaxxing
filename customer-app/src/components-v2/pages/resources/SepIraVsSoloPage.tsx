import React from 'react';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function SepIraVsSoloPage() {
  const rows = [
    { feature: '2025 max contribution', sep: '$70,000', solo: '$70,000 (same cap)' },
    { feature: 'Contribution at low income', sep: 'Lower (employer-only)', solo: 'Higher (includes $23,500 employee deferral)' },
    { feature: 'Roth option', sep: 'No', solo: 'Yes (Roth deferrals available)' },
    { feature: 'Annual IRS filing', sep: 'None required', solo: 'Form 5500-EZ once assets > $250k' },
    { feature: 'Can cover employees', sep: 'Yes (must match %)', solo: 'No (owner + spouse only)' },
    { feature: 'Loan provision', sep: 'No', solo: 'Yes (plan-level option)' },
    { feature: 'Establishment deadline', sep: 'Tax filing deadline', solo: 'December 31 of tax year' },
    { feature: 'Administrative complexity', sep: 'Very low', solo: 'Moderate' },
  ];

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>SEP-IRA vs. Solo 401(k)</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Both plans are excellent for self-employed individuals. Here's how to decide which fits your situation.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Side-by-Side Comparison</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.color.border}` }}>
              <th style={{ textAlign: 'left', padding: '6px 8px 10px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12, width: '34%' }}>Feature</th>
              <th style={{ textAlign: 'left', padding: '6px 8px 10px', color: theme.color.warning, fontWeight: 600, fontSize: 12, width: '33%' }}>SEP-IRA</th>
              <th style={{ textAlign: 'left', padding: '6px 8px 10px', color: theme.color.primary, fontWeight: 600, fontSize: 12, width: '33%' }}>Solo 401(k)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.feature} style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                <td style={{ padding: '10px 8px', fontWeight: 500 }}>{r.feature}</td>
                <td style={{ padding: '10px 8px', color: theme.color.text }}>{r.sep}</td>
                <td style={{ padding: '10px 8px', color: theme.color.text }}>{r.solo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ ...card, marginBottom: 0, background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}` }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: theme.color.warning, fontFamily: theme.font.serif }}>Choose SEP-IRA if…</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: theme.color.text, lineHeight: 1.8 }}>
            <li>You have eligible employees (or may hire them soon)</li>
            <li>You prefer minimal paperwork and administration</li>
            <li>Your income is high enough that 25% of compensation already hits $70k</li>
            <li>You want to establish the plan after year-end (up to tax deadline)</li>
          </ul>
        </div>
        <div style={{ ...card, marginBottom: 0, background: theme.color.primarySoft, border: `1px solid ${theme.color.primarySoftBorder}` }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: theme.color.primary, fontFamily: theme.font.serif }}>Choose Solo 401(k) if…</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: theme.color.text, lineHeight: 1.8 }}>
            <li>You are self-employed with no employees (other than a spouse)</li>
            <li>You want a Roth contribution option</li>
            <li>Your income is lower and you want to maximize via employee deferrals</li>
            <li>You want the option to take a plan loan</li>
          </ul>
        </div>
      </div>

      <div style={{ ...card, marginTop: 20 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Contribution Comparison at Various Income Levels</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.color.border}` }}>
              {['Net Self-Employment Income', 'SEP-IRA Max', 'Solo 401(k) Max (under 50)'].map(h => (
                <th key={h} style={{ textAlign: 'right', padding: '6px 8px 10px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { income: '$30,000', sep: '$5,576', solo: '$23,500 + $5,576 = $29,076' },
              { income: '$60,000', sep: '$11,152', solo: '$23,500 + $11,152 = $34,652' },
              { income: '$100,000', sep: '$18,587', solo: '$23,500 + $18,587 = $42,087' },
              { income: '$200,000', sep: '$37,174', solo: '$23,500 + $37,174 = $60,674' },
              { income: '$280,000+', sep: '$70,000', solo: '$70,000 (cap)' },
            ].map(r => (
              <tr key={r.income} style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                <td style={{ padding: '10px 8px', fontWeight: 500, textAlign: 'right' }}>{r.income}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{r.sep}</td>
                <td style={{ padding: '10px 8px', color: theme.color.primary, textAlign: 'right' }}>{r.solo}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: theme.color.textMuted }}>Solo 401(k) employee deferral is $23,500 for 2025 (+$7,500 if 50+). Employer contribution = same formula as SEP-IRA.</p>
      </div>
    </div>
  );
}
