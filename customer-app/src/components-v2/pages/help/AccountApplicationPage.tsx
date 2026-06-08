import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

const STEPS: { n: number; title: string; body: string }[] = [
  { n: 1, title: 'Account type', body: 'Choose a Roth IRA, Traditional IRA, SEP-IRA, or taxable account. Each has its own tax treatment — you can open more than one over time.' },
  { n: 2, title: 'Personal information', body: 'Your legal name, date of birth, Social Security Number, citizenship, employment, and a few financial details. These verify your identity and help us assess suitability.' },
  { n: 3, title: 'Contact & address', body: 'Email, phone, and mailing address — where we send statements, tax forms, and security notifications. Your permanent residence can differ from your mailing address.' },
  { n: 4, title: 'Regulatory disclosures', body: 'A short set of FINRA/SEC questions (control person, industry affiliation, political exposure) plus an optional trusted contact. Most applicants answer "No" to the first three.' },
  { n: 5, title: 'Account setup', body: 'This step varies by account type: IRA beneficiaries (allocations totaling 100%), SEP business information, or taxable ownership and an optional transfer-on-death designation.' },
  { n: 6, title: 'Funding & first investment', body: 'Pick how you\'ll fund the account — ACH, wire, check, or rollover — and choose your initial fund and amount. Most funds have a $1,000 minimum initial investment.' },
  { n: 7, title: 'Automatic investing (optional)', body: 'Optionally enroll in free dollar-cost averaging: a fixed amount invested on a schedule you choose. You can change or cancel it anytime, with no fees.' },
  { n: 8, title: 'Review & sign', body: 'Review every section, accept the agreements, and sign electronically by typing your full legal name. Nothing is submitted until you click Submit.' },
];

const TIMELINE: { title: string; body: string }[] = [
  { title: 'Email confirmation', body: 'You receive a confirmation with an application reference number within minutes of submitting.' },
  { title: 'Identity verification', body: 'We verify your identity from the information you provided — typically within 1 business day.' },
  { title: 'Account opened', body: 'Once verified, your account number is emailed to you, usually within 1–3 business days.' },
  { title: 'First investment', body: 'Your initial funding is applied and your first investment is placed once the account is active.' },
];

export function AccountApplicationPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>How the Application Works</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Opening an account takes about 10–15 minutes across eight short steps. Here's what each step asks and what happens after you submit.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>The Eight Steps</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {STEPS.map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 14 }}>
              <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 999, background: theme.color.primarySoft, border: `1px solid ${theme.color.primarySoftBorder}`, color: theme.color.primary, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.n}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: theme.color.text }}>{s.title}</div>
                <div style={{ fontSize: 13, color: theme.color.textMuted, lineHeight: 1.55, marginTop: 2 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>What You Need on Hand</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Social Security Number (or ITIN)</li>
          <li>A government-issued photo ID</li>
          <li>Bank routing and account numbers (for ACH funding)</li>
          <li>For a rollover: your current institution's name and account number</li>
          <li>For an IRA: beneficiary names and allocations; for a SEP: your business EIN</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>After You Submit</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TIMELINE.map((t, i) => (
            <div key={t.title} style={{ display: 'flex', gap: 14, position: 'relative', paddingBottom: i < TIMELINE.length - 1 ? 18 : 0 }}>
              {i < TIMELINE.length - 1 && <div style={{ position: 'absolute', left: 9, top: 22, bottom: 0, width: 2, background: theme.color.border }} />}
              <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 999, background: theme.color.success, marginTop: 1, zIndex: 1 }} />
              <div style={{ paddingTop: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: theme.color.text }}>{t.title}</div>
                <div style={{ fontSize: 13, color: theme.color.textMuted, lineHeight: 1.55, marginTop: 2 }}>{t.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          Made a mistake after submitting? Contact us as soon as possible — minor corrections are quick, while changes to your legal name or SSN need extra verification.
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
