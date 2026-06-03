import React from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function IraContributionLimitsPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>IRA Contribution Limits 2025</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Complete guide to Roth IRA and Traditional IRA contribution rules for the 2025 tax year.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, fontFamily: theme.font.serif }}>2025 Annual Limits at a Glance</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.color.border}` }}>
              <th style={{ textAlign: 'left', padding: '6px 8px 10px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Account Type</th>
              <th style={{ textAlign: 'right', padding: '6px 8px 10px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Under 50</th>
              <th style={{ textAlign: 'right', padding: '6px 8px 10px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Age 50+</th>
              <th style={{ textAlign: 'left', padding: '6px 8px 10px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Income Limit</th>
            </tr>
          </thead>
          <tbody>
            {[
              { type: 'Roth IRA', under50: '$7,000', over50: '$8,000', income: 'Phase-out: $146k–$161k (single) / $230k–$240k (joint)' },
              { type: 'Traditional IRA', under50: '$7,000', over50: '$8,000', income: 'No income limit to contribute (deductibility may be limited)' },
              { type: 'Combined IRA limit', under50: '$7,000', over50: '$8,000', income: 'Total across ALL IRAs — Roth + Traditional combined' },
            ].map(r => (
              <tr key={r.type} style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                <td style={{ padding: '10px 8px', fontWeight: 600 }}>{r.type}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{r.under50}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{r.over50}</td>
                <td style={{ padding: '10px 8px', color: theme.color.textMuted, fontSize: 13 }}>{r.income}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Combined Limit Rule</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          The $7,000 (or $8,000) limit applies across all your IRAs combined. You cannot contribute $7,000 to a Roth IRA and another $7,000 to a Traditional IRA in the same year.
        </p>
        <p style={{ margin: 0, fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          Example: if you're under 50, you could put $4,000 in a Roth IRA and $3,000 in a Traditional IRA — but the total must not exceed $7,000.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Roth IRA Income Limits 2025</h2>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${theme.color.border}` }}>
                {['Filing Status', 'Full Contribution', 'Phase-out Range', 'No Contribution'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px 10px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { status: 'Single / Head of Household', full: 'Under $146,000', range: '$146,000–$161,000', none: 'Over $161,000' },
                { status: 'Married Filing Jointly', full: 'Under $230,000', range: '$230,000–$240,000', none: 'Over $240,000' },
                { status: 'Married Filing Separately', full: '$0', range: '$0–$10,000', none: 'Over $10,000' },
              ].map(r => (
                <tr key={r.status} style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                  <td style={{ padding: '10px 8px', fontWeight: 500 }}>{r.status}</td>
                  <td style={{ padding: '10px 8px', color: theme.color.success }}>{r.full}</td>
                  <td style={{ padding: '10px 8px', color: theme.color.warning }}>{r.range}</td>
                  <td style={{ padding: '10px 8px', color: theme.color.danger }}>{r.none}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Excess Contribution Penalty</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          Contributing more than the annual limit results in a <strong>6% IRS excise tax per year</strong> on the excess amount, for every year it remains in the account.
        </p>
        <p style={{ margin: 0, fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          To correct an excess: withdraw the excess plus any attributable earnings before your tax filing deadline (including extensions). Contact Bob's Mutual Funds to process a corrective withdrawal.
        </p>
      </div>

      <div style={{ background: theme.color.primarySoft, border: `1px solid ${theme.color.primarySoftBorder}`, borderRadius: 10, padding: '14px 16px', fontSize: 13, color: theme.color.text, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span>Know the limits — now see whether you're on track to retire comfortably.</span>
        <Link to="/resources/retirement-calculator" style={{ flexShrink: 0, background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Retirement Calculator →
        </Link>
      </div>

      <div style={{ background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: theme.color.warning }}>
        Limits shown are for 2025. IRS adjusts these limits periodically for inflation. Earned income must equal or exceed your contribution amount — you cannot contribute to an IRA without earned income.
      </div>
    </div>
  );
}
