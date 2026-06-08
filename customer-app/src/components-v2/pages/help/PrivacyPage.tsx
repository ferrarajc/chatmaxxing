import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Your Privacy &amp; Data Security</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Opening an account means sharing sensitive information. Here's exactly what we collect, why, and how we protect it.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>What We Collect &amp; Why</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: theme.color.bg }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Information</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Why we need it</th>
            </tr>
          </thead>
          <tbody>
            {[
              { item: 'Social Security Number', why: 'Federal law: identity verification and IRS tax reporting' },
              { item: 'Government-issued ID', why: 'Customer Identification Program (anti-fraud) verification' },
              { item: 'Employment & income', why: 'FINRA suitability and anti-money-laundering rules' },
              { item: 'Contact & address', why: 'Statements, tax forms, and security notifications' },
              { item: 'Bank account details', why: 'Funding your account and processing transfers' },
            ].map((row, i) => (
              <tr key={row.item} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, fontWeight: 500 }}>{row.item}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>How We Protect It</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Your data is encrypted both in transit and at rest</li>
          <li>Access is restricted to systems and personnel that need it, and every access is logged</li>
          <li>We never display your full Social Security Number back to you</li>
          <li>Identity is verified through secure, industry-standard verification services</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>What We Don't Do</h2>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13.5, color: theme.color.text, lineHeight: 1.6 }}>
          We do <strong>not</strong> sell your personal information. We share data only as needed to operate your account — for example, with regulators or service providers bound by strict agreements — and as described in our Privacy Policy. Your information is never visible to other customers, and you control your marketing preferences.
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/help/account-application" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          How the application works →
        </NavLink>
      </div>
    </div>
  );
}
