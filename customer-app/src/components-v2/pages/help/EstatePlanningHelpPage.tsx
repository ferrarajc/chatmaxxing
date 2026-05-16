import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function EstatePlanningHelpPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Estate Planning &amp; Inherited Accounts</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Losing a loved one is difficult. Our Estate Services team is here to help you navigate inherited accounts with care and efficiency.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>First Steps After a Death</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Notify Bob's Mutual Funds by calling 1-800-BOB-FUND or visiting a branch</li>
          <li>The account will be placed on hold pending documentation review</li>
          <li>Gather: certified copy of death certificate, your government-issued ID, and any estate documents (Letters Testamentary, trust documents)</li>
          <li>Our Estate Services team will contact you within 2 business days to guide the process</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Options for Inherited IRAs</h2>
        <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li><strong>Surviving spouse:</strong> May roll over to their own IRA, treat as their own, or open an Inherited IRA</li>
          <li><strong>Non-spouse beneficiary (inherited after 12/31/2019):</strong> Must deplete account within 10 years; annual RMDs required in years 1–9 if original owner had begun RMDs</li>
          <li><strong>Eligible Designated Beneficiaries</strong> (minor child, disabled, chronically ill, person not more than 10 years younger): May stretch distributions over life expectancy</li>
        </ul>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          Inherited IRA rules changed significantly under SECURE 2.0. Our Estate Services specialists will provide a personalized distribution plan based on your specific situation.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Transferring Taxable Accounts</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Upon death, taxable account assets receive a <strong>step-up in cost basis</strong> to the fair market value on the date of death. This can significantly reduce capital gains taxes for beneficiaries. Our team will document the date-of-death values for your records and tax reporting.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Planning Ahead</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          The best time to plan your estate is now. Ensure your beneficiary designations are current, review your account ownership structure (individual, joint, or trust), and consider whether a revocable living trust is appropriate. See our{' '}
          <NavLink to="/help/beneficiary" style={{ color: theme.color.primary, textDecoration: 'underline' }}>Beneficiary Designation Guide</NavLink>{' '}
          for more.
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/account/beneficiaries" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Review Your Beneficiaries →
        </NavLink>
      </div>
    </div>
  );
}
