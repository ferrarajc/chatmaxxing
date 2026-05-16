import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function RolloverGuidePage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>401(k) to IRA Rollover Guide</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Rolling over an old employer plan into a Bob's Mutual Funds IRA keeps your savings growing tax-deferred and gives you more investment choices.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Direct vs. Indirect Rollover</h2>
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: theme.color.bg }}>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}></th>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Direct Rollover</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Indirect Rollover</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'How it works', direct: 'Funds go directly from old plan to your IRA', indirect: 'You receive a check; must deposit within 60 days' },
                { label: 'Tax withholding', direct: 'None', indirect: '20% mandatory withholding (you must make up from other funds)' },
                { label: 'Risk of taxes/penalties', direct: 'None if done correctly', indirect: 'High if deadline missed' },
                { label: 'Recommended?', direct: 'Yes — always preferred', indirect: 'Not recommended' },
              ].map((row, i) => (
                <tr key={row.label} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, fontWeight: 600 }}>{row.label}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.direct}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.indirect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          Always request a <strong>direct rollover</strong>. Never have the check made out to you personally if you want to avoid withholding taxes.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Step-by-Step: Rolling Over to Bob's Mutual Funds</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li><strong>Step 1:</strong> Open or identify a Bob's Mutual Funds Traditional IRA (for pre-tax 401k funds) or Roth IRA (for Roth 401k funds).</li>
          <li><strong>Step 2:</strong> Contact your former employer's plan administrator and request a direct rollover to Bob's Mutual Funds.</li>
          <li><strong>Step 3:</strong> Provide our receiving details: Bob's Mutual Funds, DTC #XXXX, Account # (yours). Our support team will provide exact wiring instructions.</li>
          <li><strong>Step 4:</strong> Your former plan sends funds directly. Processing typically takes 5–15 business days.</li>
          <li><strong>Step 5:</strong> Confirm receipt in your account and select your investments.</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>What About After-Tax (Roth) 401(k) Money?</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          If your 401(k) has a Roth component, roll it to a <strong>Roth IRA</strong> at Bob's Mutual Funds — not a Traditional IRA. This preserves the tax-free growth. Pre-tax and after-tax balances must be rolled to the corresponding IRA type.
        </p>
      </div>

      <div style={{ background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: theme.color.text, marginBottom: 20 }}>
        ⚠ If you miss the 60-day deadline on an indirect rollover, the entire amount may be treated as ordinary income and subject to a 10% early withdrawal penalty if you're under 59½.
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/open-account" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Open an IRA for Your Rollover →
        </NavLink>
      </div>
    </div>
  );
}
