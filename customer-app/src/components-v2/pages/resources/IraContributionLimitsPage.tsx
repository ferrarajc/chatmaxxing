import React from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../../theme';
// The IRS figures come from the shared table that also drives the contributions card on
// each IRA account page. Hardcoding them here is what let this page drift a year behind
// in the first place — and a page that contradicts the client's own remaining-room
// number is worse than no page at all.
import {
  ROTH_PHASE_OUT_MFS, iraDeadlineFor, limitsForYear, openTaxYears,
} from '../../../../../lambda/shared/contribution-limits';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
const usdK = (n: number) => `$${Math.round(n / 1000)}k`;

/** "2027-04-15" -> "April 15, 2027" */
function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[m - 1]} ${d}, ${y}`;
}

export function IraContributionLimitsPage() {
  const openYears = openTaxYears();
  const taxYear = openYears[0];
  const priorYear = openYears[1];
  const lim = limitsForYear(taxYear);
  const prior = priorYear ? limitsForYear(priorYear) : null;
  const base = usd(lim.base);
  const withCatchUp = usd(lim.base + lim.catchUp);
  const phaseOut = (r: readonly [number, number]) => `${usd(r[0])}–${usd(r[1])}`;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>IRA Contribution Limits {taxYear}</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Complete guide to Roth IRA and Traditional IRA contribution rules for the {taxYear} tax year.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, fontFamily: theme.font.serif }}>{taxYear} Annual Limits at a Glance</h2>
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
              {
                type: 'Roth IRA', under50: base, over50: withCatchUp,
                income: `Phase-out: ${usdK(lim.rothPhaseOut.single[0])}–${usdK(lim.rothPhaseOut.single[1])} (single) / ${usdK(lim.rothPhaseOut.joint[0])}–${usdK(lim.rothPhaseOut.joint[1])} (joint)`,
              },
              { type: 'Traditional IRA', under50: base, over50: withCatchUp, income: 'No income limit to contribute (deductibility may be limited)' },
              { type: 'Combined IRA limit', under50: base, over50: withCatchUp, income: 'Total across ALL IRAs — Roth + Traditional combined' },
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
        <p style={{ margin: '14px 0 0', fontSize: 13, color: theme.color.textMuted, lineHeight: 1.6 }}>
          The deadline to contribute for {taxYear} is <strong>{longDate(iraDeadlineFor(taxYear))}</strong>. A filing extension does not extend it.
        </p>
      </div>

      {/* Between January 1 and the April deadline a client can contribute for TWO tax
          years at once, and the older year's limit may differ — so surface it while it is
          still actionable, and drop it the moment the deadline passes. */}
      {prior && priorYear && (
        <div style={card}>
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>You can still contribute for {priorYear}</h2>
          <p style={{ margin: '0 0 10px', fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
            Until <strong>{longDate(iraDeadlineFor(priorYear))}</strong> you can still make a {priorYear} contribution — up
            to {usd(prior.base)} ({usd(prior.base + prior.catchUp)} if you were 50 or older during {priorYear}). It is a
            separate limit from {taxYear}, so contributing for one year does not reduce what you can put in for the other.
          </p>
          <p style={{ margin: 0, fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
            Tell us which tax year a contribution is for when you make it — otherwise it is applied to {taxYear}.
          </p>
        </div>
      )}

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Combined Limit Rule</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          The {base} (or {withCatchUp}) limit applies across all your IRAs combined. You cannot contribute {base} to a
          Roth IRA and another {base} to a Traditional IRA in the same year.
        </p>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          Example: if you're under 50, you could split the {base} across a Roth IRA and a Traditional IRA in any
          proportion — but the total must not exceed {base}.
        </p>
        <p style={{ margin: 0, fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          Your own running total is on each IRA account page, adding up every IRA you hold with us.{' '}
          <Link to="/portfolio" style={{ color: theme.color.primary, fontWeight: 500 }}>See your accounts →</Link>
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Roth IRA Income Limits {taxYear}</h2>
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
                { status: 'Single / Head of Household', range: lim.rothPhaseOut.single },
                { status: 'Married Filing Jointly', range: lim.rothPhaseOut.joint },
                { status: 'Married Filing Separately', range: ROTH_PHASE_OUT_MFS },
              ].map(r => (
                <tr key={r.status} style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                  <td style={{ padding: '10px 8px', fontWeight: 500 }}>{r.status}</td>
                  <td style={{ padding: '10px 8px', color: theme.color.success }}>{r.range[0] === 0 ? '$0' : `Under ${usd(r.range[0])}`}</td>
                  <td style={{ padding: '10px 8px', color: theme.color.warning }}>{phaseOut(r.range)}</td>
                  <td style={{ padding: '10px 8px', color: theme.color.danger }}>Over {usd(r.range[1])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 13, color: theme.color.textMuted, lineHeight: 1.6 }}>
          We do not hold your income, so the remaining-contribution figures on your account pages do not apply these
          phase-outs. Check the table above against your own modified AGI.
        </p>
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
        Limits shown are for {taxYear}. The IRS adjusts them periodically for inflation. Earned income must equal or
        exceed your contribution amount — you cannot contribute to an IRA without earned income. The running totals on
        your account pages cover contributions made at Bob's Mutual Funds only; anything you contributed elsewhere
        counts toward the same limit.
      </div>
    </div>
  );
}
