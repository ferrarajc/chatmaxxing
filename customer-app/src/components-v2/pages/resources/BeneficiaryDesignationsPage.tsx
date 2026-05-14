import React from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function BeneficiaryDesignationsPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Beneficiary Designations</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Who receives your retirement assets when you pass away — and why this form matters more than your will.
      </p>

      <div style={{ ...card, background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}` }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: theme.color.warning, fontFamily: theme.font.serif }}>Your Beneficiary Designation Overrides Your Will</h2>
        <p style={{ margin: 0, fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          If your will leaves your IRA to your children but your beneficiary form names an ex-spouse, the <strong>ex-spouse receives the money</strong>. Courts have consistently upheld beneficiary forms over contradictory will provisions. Review your designations after every major life event.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Primary vs. Contingent Beneficiaries</h2>
        {[
          {
            label: 'Primary Beneficiary',
            color: theme.color.primary,
            desc: 'Receives your assets directly when you pass away. You can name multiple primary beneficiaries and split the allocation between them — the percentages must add up to 100%.',
          },
          {
            label: 'Contingent (Secondary) Beneficiary',
            color: theme.color.accent,
            desc: 'Receives your assets only if all primary beneficiaries have predeceased you or disclaim the inheritance. Provides a backup layer of protection for your estate plan.',
          },
        ].map(item => (
          <div key={item.label} style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: item.color }}>{item.label}</h3>
            <p style={{ margin: 0, fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>{item.desc}</p>
          </div>
        ))}
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>When to Update Your Designations</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: theme.color.text, lineHeight: 1.9 }}>
          <li>Marriage or divorce</li>
          <li>Birth or adoption of a child</li>
          <li>Death of a named beneficiary</li>
          <li>Significant change in your relationship with a named beneficiary</li>
          <li>Opening a new retirement account</li>
          <li>At a minimum, review every 3–5 years</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Naming a Minor Child</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          Minor children cannot directly receive inherited retirement assets. If a minor is named as beneficiary, the court will appoint a guardian to manage the funds until the child reaches the age of majority — a costly and public process.
        </p>
        <p style={{ margin: 0, fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          A better approach is to name a trust as beneficiary with the child as the trust beneficiary, giving you control over how and when funds are distributed.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Allocation Rules</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          When naming multiple beneficiaries, their allocations must sum to exactly 100%. For example:
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: theme.color.text, lineHeight: 1.9 }}>
          <li>Spouse — 60%, Child A — 20%, Child B — 20% ✓</li>
          <li>Three equal beneficiaries — 33% / 33% / 34% ✓</li>
          <li>Two beneficiaries at 40% each — will be rejected (only 80%) ✗</li>
        </ul>
      </div>

      <div style={{ background: theme.color.primarySoft, border: `1px solid ${theme.color.primarySoftBorder}`, borderRadius: 10, padding: '14px 18px', fontSize: 14, color: theme.color.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <span>Ready to review or update your designations?</span>
        <Link to="/account/beneficiaries" style={{ flexShrink: 0, background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: 8, padding: '8px 18px', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
          Manage Beneficiaries
        </Link>
      </div>
    </div>
  );
}
