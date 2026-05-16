import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function RmdGuidePage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Required Minimum Distributions (RMDs)</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        The IRS requires retirees to withdraw a minimum amount from most retirement accounts each year. Here's what you need to know.
      </p>

      <div style={{ background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: theme.color.text, marginBottom: 20 }}>
        ⚠ Missing your RMD deadline can result in a 25% excise tax on the amount not withdrawn. We can help you calculate and process your RMD — contact support or use our online RMD calculator.
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>What Accounts Require RMDs?</h2>
        <ul style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Traditional IRAs</li>
          <li>SEP-IRAs</li>
          <li>SIMPLE IRAs</li>
          <li>401(k), 403(b), 457(b) plans (if no longer working)</li>
          <li>Inherited IRAs (special rules apply — see below)</li>
        </ul>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <strong>Roth IRAs do not require RMDs</strong> during the original owner's lifetime. Roth 401(k)s no longer require RMDs as of 2024.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>When Do RMDs Begin?</h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Under the SECURE 2.0 Act, the RMD starting age depends on your birth year:
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 16 }}>
          <thead>
            <tr style={{ background: theme.color.bg }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Born</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>RMD Starting Age</th>
            </tr>
          </thead>
          <tbody>
            {[
              { born: 'Before 1951', age: '70½ or 72 (depending on when you turned 70½)' },
              { born: '1951–1959', age: '73' },
              { born: '1960 or later', age: '75' },
            ].map((row, i) => (
              <tr key={row.born} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.born}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.age}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          Your first RMD can be delayed until April 1 of the year after you reach your starting age. All subsequent RMDs are due by December 31 each year.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>How Is My RMD Calculated?</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Your annual RMD is calculated by dividing your account balance (as of December 31 of the prior year) by a life expectancy factor from the IRS Uniform Lifetime Table.
        </p>
        <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <strong>Example:</strong> Account balance of $612,000 ÷ life expectancy factor of 26.5 (age 67) = approximately $23,094 RMD for the year.
        </p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Bob's Mutual Funds calculates your RMD automatically each January and notifies you. You can also request a calculation at any time through your account or by contacting support.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Inherited IRA RMD Rules</h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          If you inherited an IRA, different rules apply depending on your relationship to the original owner and when you inherited:
        </p>
        <ul style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li><strong>Spouse beneficiaries:</strong> May roll over to their own IRA, delaying RMDs to their own starting age</li>
          <li><strong>Non-spouse beneficiaries (inherited after 2019):</strong> Generally must deplete the account within 10 years</li>
          <li><strong>Eligible designated beneficiaries</strong> (minor children, disabled, chronically ill, or within 10 years of age): May use the stretch option with annual RMDs</li>
        </ul>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          For inherited account guidance, please speak with a specialist. See our{' '}
          <NavLink to="/help/estate-planning" style={{ color: theme.color.primary, textDecoration: 'underline' }}>Estate Planning guide</NavLink>{' '}
          for more.
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/account/rmd" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Manage Your RMD Settings →
        </NavLink>
      </div>
    </div>
  );
}
