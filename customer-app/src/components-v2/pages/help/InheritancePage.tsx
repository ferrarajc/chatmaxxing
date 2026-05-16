import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function InheritancePage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Inheriting a Bob's Mutual Funds Account</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        We're here to help you navigate this process as smoothly as possible. Our inheritance specialists will guide you through every step.
      </p>

      <div style={{ ...card, background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}` }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          We extend our deepest condolences on your loss. Our team is committed to handling this with care, compassion, and as little complexity as we can.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>How to Get Started</h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          The fastest way to begin is to speak with one of our inheritance specialists, who can review the specific account, identify the appropriate transfer process, and walk you through required documentation.
        </p>
        <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <strong>Call us:</strong> 1-800-BOB-FUND, Monday–Friday 8:00 AM – 7:30 PM ET. Say "inherited account" and you'll be routed to the right team.
        </p>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          <strong>Prefer to start online?</strong> You can initiate a request by downloading and completing our{' '}
          <NavLink to="/help/ownership-form" style={{ color: theme.color.primary, textDecoration: 'underline' }}>Account Ownership Transfer Form</NavLink>.
          However, we strongly recommend speaking with a specialist first — the required documents vary by account type and your relationship to the deceased.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>What You'll Generally Need</h2>
        <ul style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Certified copy of the death certificate</li>
          <li>Your government-issued photo ID</li>
          <li>Proof of your relationship or beneficiary designation (if applicable)</li>
          <li>Letters Testamentary or Letters of Administration (if going through probate)</li>
          <li>The deceased's account number or Social Security Number</li>
        </ul>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.textMuted }}>
          Exact requirements vary. Your inheritance specialist will provide a personalized document checklist during your call.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Inherited Account Types &amp; Rules</h2>
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: theme.color.bg }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Account Type</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Key Considerations</th>
              </tr>
            </thead>
            <tbody>
              {[
                { type: 'Traditional IRA', notes: 'Beneficiaries must generally take Required Minimum Distributions (RMDs). Rules vary by your relationship to the deceased and the SECURE 2.0 Act.' },
                { type: 'Roth IRA', notes: 'Distributions are tax-free, but the 10-year rule typically applies for non-spouse beneficiaries.' },
                { type: 'Taxable (Brokerage) Account', notes: 'Assets receive a step-up in cost basis to the date-of-death value, which can reduce capital gains taxes.' },
                { type: 'Joint Account', notes: 'If set up as Joint Tenants with Rights of Survivorship (JTWROS), assets transfer automatically to the surviving owner.' },
              ].map((row, i) => (
                <tr key={row.type} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, fontWeight: 500, whiteSpace: 'nowrap' }}>{row.type}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          <strong>Tax note:</strong> Inherited account rules changed significantly under the SECURE Act (2019) and SECURE 2.0 (2022). We recommend consulting a tax advisor or estate attorney for guidance specific to your situation.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>The Transfer Process</h2>
        {[
          { step: '1', title: 'Contact us', body: 'Reach our inheritance team by phone or request a callback through chat.' },
          { step: '2', title: 'Gather documents', body: 'Your specialist will send you a personalized checklist within 1–2 business days.' },
          { step: '3', title: 'Submit documentation', body: 'Upload securely via your online account, mail certified copies, or visit a service center.' },
          { step: '4', title: 'Account review', body: 'Our team typically completes the transfer within 5–10 business days of receiving complete documentation.' },
          { step: '5', title: 'Confirmation', body: "You'll receive written confirmation once assets have been transferred to your account." },
        ].map(item => (
          <div key={item.step} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{ background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
              {item.step}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{item.title}</div>
              <div style={{ fontSize: 14, color: theme.color.textMuted, lineHeight: 1.5 }}>{item.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
