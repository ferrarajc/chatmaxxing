import React from 'react';
import { useClientStore } from '../../../../store/clientStore';
import { AgreementEntry } from '../../../../data/personas';
import { theme } from '../../../../theme';
import { SectionCard } from './ui';
import { openTextPdf } from '../../../../utils/pdf';

const fmt = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Representative body text per agreement type (demo content; real PDF output).
const BODY: Record<string, string[]> = {
  customer: [
    'This Customer Agreement governs your brokerage and mutual fund account(s) with Bob\'s Mutual Funds ("the Firm"). By signing, you authorize the Firm to open and maintain your account(s) and to act on instructions you or your authorized agents provide.',
    'You agree to provide accurate information, to keep your contact details current, and to review confirmations and statements promptly. Mutual fund orders are priced at the next net asset value (NAV) calculated after the order is received; settlement generally occurs the next business day.',
    'Investing involves risk, including possible loss of principal. This agreement is governed by applicable federal securities laws and the rules of FINRA and the SEC.',
  ],
  'e-delivery': [
    'By consenting to electronic delivery, you agree to receive account statements, trade confirmations, tax forms, prospectuses, regulatory notices, and other communications electronically. Documents are emailed to you as secure PDFs and remain available to download from your account on the Firm\'s website.',
    'You may withdraw this consent or request paper copies at any time in your account settings, without charge. You confirm you have a valid email address and the ability to view PDF documents.',
  ],
  privacy: [
    'This acknowledges that you have received and reviewed the Firm\'s Privacy Policy, which describes the information we collect, how we use and protect it, and the limited circumstances in which we share it.',
    'The Firm does not sell your personal information. Mobile phone numbers and consent are never shared with third parties for their own marketing.',
  ],
  'sms-consent': [
    'By opting in, you consent to receive recurring automated text messages from Bob\'s Mutual Funds at the verified mobile number(s) on your account, including account and security alerts and, only if separately selected, promotional messages. Consent is not a condition of any purchase.',
    'Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help. You can manage or revoke consent at any time in your account settings. See the Firm\'s SMS Program Terms and Privacy Policy for details.',
  ],
  ira: [
    'This IRA Custodial Agreement and Disclosure Statement establishes your Individual Retirement Account with the Firm acting as custodian, under Section 408(a) of the Internal Revenue Code.',
    'It describes contribution limits, distribution and required minimum distribution rules, beneficiary designations, and applicable fees. You acknowledge receipt of the disclosure statement and the right to revoke the account within seven days of establishment.',
  ],
  sep: [
    'This SEP Plan Adoption Agreement establishes a Simplified Employee Pension plan under Section 408(k) of the Internal Revenue Code. You certify that the plan is established for all eligible employees and that contributions will be made on a uniform basis as required.',
  ],
};

function paragraphsFor(a: AgreementEntry): string[] {
  const meta = [
    `Document version: ${a.version}`,
    `Signed electronically by: ${a.signature}`,
    `Date signed: ${fmt(a.signedAt)}`,
    '',
  ];
  const body = BODY[a.type] ?? ['This document is on file with Bob\'s Mutual Funds.'];
  return [
    ...meta,
    ...body,
    '',
    'This electronic signature carries the same legal effect as a handwritten signature. This copy is provided for your records.',
  ];
}

export function AgreementsSection() {
  const agreements = useClientStore(s => s.activePersona.agreements) ?? [];

  return (
    <SectionCard
      title="Signed agreements & disclosures"
      subtitle="Documents you've electronically signed. Each carries the same legal effect as a handwritten signature."
      id="agreements"
    >
      {agreements.length === 0 && (
        <p style={{ fontSize: 13, color: theme.color.textMuted, fontStyle: 'italic', margin: 0 }}>No signed agreements on file.</p>
      )}

      {agreements.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${theme.color.border}` }}>
              <th style={{ textAlign: 'left', padding: '6px 0', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Document</th>
              <th style={{ textAlign: 'left', padding: '6px 0', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Signed</th>
              <th style={{ textAlign: 'left', padding: '6px 0', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Version</th>
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {agreements.map((a, i) => (
              <tr key={a.id} style={{ borderBottom: i === agreements.length - 1 ? 'none' : `1px solid ${theme.color.border}` }}>
                <td style={{ padding: '11px 0' }}>
                  <div style={{ fontWeight: 600, color: theme.color.text }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: theme.color.textSubtle, marginTop: 2 }}>Signed by {a.signature}</div>
                </td>
                <td style={{ padding: '11px 0', color: theme.color.textMuted, whiteSpace: 'nowrap' }}>{fmt(a.signedAt)}</td>
                <td style={{ padding: '11px 0', color: theme.color.textMuted }}>{a.version}</td>
                <td style={{ padding: '11px 0', textAlign: 'right' }}>
                  <button onClick={() => openTextPdf(a.title, paragraphsFor(a))}
                    style={{ background: 'none', border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md, padding: '4px 12px', fontSize: 12, cursor: 'pointer', color: theme.color.text }}>
                    View PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}
