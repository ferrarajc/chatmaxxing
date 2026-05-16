import React from 'react';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function OwnershipFormPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Change of Ownership Form</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Transferring account ownership due to death, divorce, or other circumstances. Our specialized team handles all change-of-ownership requests.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>When Is a Change of Ownership Required?</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Death of an account holder (inherited accounts)</li>
          <li>Divorce decree transferring assets to a spouse</li>
          <li>Qualified Domestic Relations Order (QDRO)</li>
          <li>Transfer to a trust or business entity</li>
          <li>Legal name change (different process — see Account Settings)</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Required Documentation</h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          All change-of-ownership requests require specific documentation. Typically you will need:
        </p>
        <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li><strong>Death:</strong> Certified copy of death certificate, Letters Testamentary or Letters of Administration, completed Inherited IRA application</li>
          <li><strong>Divorce:</strong> Certified copy of divorce decree and QDRO (if applicable)</li>
          <li><strong>Trust transfer:</strong> Certification of Trust or complete trust document (first and last pages)</li>
        </ul>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          Our Change of Ownership team will send you a personalized document checklist after you initiate the request. Call us at 1-800-BOB-FUND or chat with an agent to begin.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Processing Timeline</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Change-of-ownership requests typically take <strong>5–10 business days</strong> after all required documents are received and verified. Complex estates or disputed claims may take longer.
        </p>
      </div>
    </div>
  );
}
