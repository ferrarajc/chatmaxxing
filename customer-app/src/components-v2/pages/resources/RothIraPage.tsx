import React from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function RothIraPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Roth IRA Strategies</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        How to get the most out of your Roth IRA — from contribution strategies to withdrawal rules to Roth conversions.
      </p>

      <div style={{ ...card, background: theme.color.primarySoft, border: `1px solid ${theme.color.primarySoftBorder}` }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: theme.color.primary, fontFamily: theme.font.serif }}>Why Roth IRA? The Core Advantage</h2>
        <p style={{ margin: 0, fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          Contributions are after-tax, so <strong>all qualified withdrawals in retirement are 100% tax-free</strong> — including decades of growth. There are no RMDs during your lifetime. The earlier you start, the more powerful the tax-free compounding becomes.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Contribution Rules</h2>
        {[
          { title: '2025 Annual Limit', body: '$7,000/year (under 50) or $8,000/year (50+). Combined limit across all IRAs.' },
          { title: 'Income Limits', body: 'Single filers: phase-out $146k–$161k. Married filing jointly: $230k–$240k. Above limits, cannot contribute directly.' },
          { title: 'Earned Income Required', body: 'You must have earned income (wages, self-employment, alimony) at least equal to your contribution amount.' },
          { title: 'Deadline', body: 'Contributions for 2025 are accepted until April 15, 2026 (tax filing deadline, no extension).' },
        ].map(item => (
          <div key={item.title} style={{ borderBottom: `1px solid ${theme.color.border}`, paddingBottom: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{item.title}</div>
            <div style={{ fontSize: 14, color: theme.color.textMuted, lineHeight: 1.5 }}>{item.body}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Withdrawal Rules</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { label: 'Contributions (anytime)', color: theme.color.successSoft, text: theme.color.success, body: 'Can be withdrawn tax-free and penalty-free at any age — you already paid tax on them.' },
            { label: 'Earnings — Qualified', color: theme.color.successSoft, text: theme.color.success, body: 'Tax-free and penalty-free if: age 59½+ AND account open ≥5 years (5-year rule).' },
            { label: 'Earnings — Non-qualified', color: theme.color.dangerSoft, text: theme.color.danger, body: 'Subject to income tax + 10% early withdrawal penalty if either condition not met.' },
            { label: 'First-time home purchase', color: theme.color.warningSoft, text: theme.color.warning, body: 'Up to $10,000 of earnings can be withdrawn penalty-free (but still taxed if account <5 years old).' },
          ].map(item => (
            <div key={item.label} style={{ background: item.color, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: item.text, marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 13, color: theme.color.text, lineHeight: 1.5 }}>{item.body}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>The 5-Year Rule</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          To withdraw <em>earnings</em> tax-free and penalty-free, your Roth IRA must have been open for at least 5 tax years. The clock starts on <strong>January 1 of the year you make your first contribution</strong> — not the date of the contribution.
        </p>
        <p style={{ margin: 0, fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          Example: if you make your first Roth IRA contribution in November 2025, the 5-year clock started January 1, 2025. The account satisfies the 5-year rule on January 1, 2030.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Roth Conversion</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          You can convert a Traditional IRA to a Roth IRA regardless of income. The converted amount is taxable as ordinary income in the year of conversion. Good reasons to convert:
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: theme.color.text, lineHeight: 1.8 }}>
          <li>You expect to be in a higher tax bracket in retirement</li>
          <li>You want to avoid future RMDs (Traditional IRAs require distributions at 73)</li>
          <li>You're in a temporarily low-income year (good time to convert at low tax rate)</li>
          <li>You want to leave tax-free assets to heirs</li>
        </ul>
      </div>

      <div style={{ background: theme.color.primarySoft, border: `1px solid ${theme.color.primarySoftBorder}`, borderRadius: 10, padding: '14px 16px', fontSize: 13, color: theme.color.text, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span>Wondering how much you'll need to retire? See how a Roth IRA fits into your long-term plan.</span>
        <Link to="/resources/retirement-calculator" style={{ flexShrink: 0, background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Retirement Calculator →
        </Link>
      </div>

      <div style={{ background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: theme.color.warning }}>
        Roth IRA strategy decisions depend heavily on your current vs. future tax rates. For personalized guidance, schedule a callback with one of our advisors.
      </div>
    </div>
  );
}
