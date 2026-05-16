import React from 'react';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function AccountTransferPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Account Transfer Instructions</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Moving investments to or from Bob's Mutual Funds? Our ACAT transfer process makes it straightforward.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Incoming Transfer (Moving to Bob's Mutual Funds)</h2>
        <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li><strong>Step 1:</strong> Open or confirm your receiving account at Bob's Mutual Funds</li>
          <li><strong>Step 2:</strong> Complete the Transfer of Assets (TOA) form — available in My Account → Transfer Assets, or by calling support</li>
          <li><strong>Step 3:</strong> We submit the ACAT (Automated Customer Account Transfer) request to your current firm on your behalf</li>
          <li><strong>Step 4:</strong> Most transfers complete in 5–7 business days. You can track status in your account</li>
        </ul>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          Make sure your account registration at the delivering firm exactly matches your Bob's Mutual Funds account (same name, same SSN/EIN). Mismatches delay transfers.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Outgoing Transfer (Leaving Bob's Mutual Funds)</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          To transfer assets out, contact the receiving institution and initiate the ACAT request from their side. They will contact us to facilitate the transfer. We do not charge an outgoing transfer fee.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>In-Kind vs. Cash Transfers</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li><strong>In-kind:</strong> Your existing fund shares transfer as-is (no selling). Best when the receiving firm offers the same funds.</li>
          <li><strong>Liquidate and transfer:</strong> Your holdings are sold and proceeds transferred as cash. May trigger capital gains taxes in taxable accounts.</li>
        </ul>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <span style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700 }}>
          Chat With an Advisor →
        </span>
      </div>
    </div>
  );
}
