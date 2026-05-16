import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function BeneficiaryPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Beneficiary Designation Guide</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Designating beneficiaries ensures your assets pass directly to loved ones — without probate. Learn how to add, update, or verify your beneficiaries.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Why Beneficiary Designations Matter</h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Beneficiary designations on retirement accounts (IRAs, 401(k)s) and life insurance policies <strong>override your will</strong>. An outdated designation can mean assets pass to an ex-spouse or deceased relative. Review your designations after any major life event.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Marriage, divorce, or domestic partnership change</li>
          <li>Birth or adoption of a child</li>
          <li>Death of a named beneficiary</li>
          <li>Significant change in your financial situation</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>How to Update Your Beneficiary</h2>
        {[
          { step: '1', body: 'Log in to your Bob\'s Mutual Funds account and navigate to My Account → Beneficiaries.' },
          { step: '2', body: 'Select the account you wish to update (IRA, Roth IRA, Taxable). Each account has separate beneficiary designations.' },
          { step: '3', body: 'Add primary beneficiaries. Assign a percentage to each — all primary shares must total 100%.' },
          { step: '4', body: 'Optionally add secondary beneficiaries, who receive assets only if all primary beneficiaries predecease you.' },
          { step: '5', body: 'Review, sign electronically, and submit. Changes take effect immediately.' },
        ].map(item => (
          <div key={item.step} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{ background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
              {item.step}
            </div>
            <div style={{ fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>{item.body}</div>
          </div>
        ))}
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text, marginTop: 4 }}>
          If you cannot complete the update online, contact our support team to request a paper Beneficiary Designation Form. Some trusts or special designations may require paper forms.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Primary vs. Secondary Beneficiaries</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li><strong>Primary beneficiaries</strong> receive your assets first. You can name multiple people and specify what percentage each receives.</li>
          <li><strong>Secondary beneficiaries</strong> receive assets only if all primary beneficiaries cannot. Strongly recommended as a backstop.</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Naming a Minor as Beneficiary</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Minors cannot legally receive retirement account proceeds directly. If you name a minor, a court may appoint a guardian of the property to manage the funds until they reach adulthood. To avoid this, consider naming a trust or a custodian under the Uniform Transfers to Minors Act (UTMA).
        </p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Please speak with an estate planning attorney before naming a minor as a primary beneficiary.
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/account/beneficiaries" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Update Your Beneficiaries →
        </NavLink>
      </div>
    </div>
  );
}
