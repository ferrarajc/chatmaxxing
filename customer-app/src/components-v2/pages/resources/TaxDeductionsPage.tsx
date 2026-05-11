import React from 'react';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function TaxDeductionsPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>SEP-IRA Tax Deduction Strategies</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        How to maximize your SEP-IRA tax deduction and what records you need for your return.
      </p>

      <div style={{ ...card, background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}` }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: theme.color.warning, fontFamily: theme.font.serif }}>The Core Tax Benefit</h2>
        <p style={{ margin: 0, fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          SEP-IRA contributions are a <strong>100% tax-deductible business expense</strong>. Unlike many deductions, this one doesn't require itemizing. For someone in the 24% federal bracket with a $30,000 SEP contribution, that's a <strong>$7,200 federal tax reduction</strong>, plus any applicable state tax savings.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Tax Savings at a Glance (2025)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.color.border}` }}>
              {['SEP-IRA Contribution', '22% Bracket', '24% Bracket', '32% Bracket'].map(h => (
                <th key={h} style={{ textAlign: 'right', padding: '6px 8px 10px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { contrib: '$10,000', b22: '$2,200', b24: '$2,400', b32: '$3,200' },
              { contrib: '$20,000', b22: '$4,400', b24: '$4,800', b32: '$6,400' },
              { contrib: '$40,000', b22: '$8,800', b24: '$9,600', b32: '$12,800' },
              { contrib: '$70,000', b22: '$15,400', b24: '$16,800', b32: '$22,400' },
            ].map(r => (
              <tr key={r.contrib} style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                <td style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>{r.contrib}</td>
                <td style={{ padding: '10px 8px', color: theme.color.success, textAlign: 'right' }}>{r.b22}</td>
                <td style={{ padding: '10px 8px', color: theme.color.success, textAlign: 'right' }}>{r.b24}</td>
                <td style={{ padding: '10px 8px', color: theme.color.success, textAlign: 'right' }}>{r.b32}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: theme.color.textMuted }}>Federal tax savings only. State savings may apply in addition.</p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Timing Your Contribution</h2>
        {[
          { title: 'Best time: as early as possible in the year', body: 'Contributions made January 1 have a full extra year of compounding vs. contributions made on the deadline. At 8% growth, $20,000 contributed in January rather than October adds ~$1,200 to your account over the year.' },
          { title: 'Deadline: October 15 of the following year', body: 'With a tax filing extension, your 2025 SEP-IRA contribution can be made as late as October 15, 2026. No extension is needed to make the contribution itself — only to file your return.' },
          { title: 'April 15 without extension', body: 'If you file by April 15, 2026 without an extension, your contribution must be made by April 15. An extension gives you until October 15.' },
        ].map(item => (
          <div key={item.title} style={{ borderBottom: `1px solid ${theme.color.border}`, paddingBottom: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{item.title}</div>
            <div style={{ fontSize: 14, color: theme.color.textMuted, lineHeight: 1.5 }}>{item.body}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Records You Need</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: theme.color.text, lineHeight: 1.8 }}>
          <li><strong>Form 5498</strong> — provided by Bob's Mutual Funds each May, shows the contribution amount credited to your SEP-IRA for the year</li>
          <li><strong>Schedule C</strong> — your business income/expense form, used to calculate net self-employment income</li>
          <li><strong>Schedule SE</strong> — self-employment tax calculation; the deductible portion reduces your net compensation for the SEP limit</li>
          <li><strong>Bank or transfer records</strong> — proof of contribution date (ensure it falls within the eligible period)</li>
        </ul>
      </div>

      <div style={{ background: theme.color.primarySoft, border: `1px solid ${theme.color.primarySoftBorder}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: theme.color.primary }}>
        Bob's Mutual Funds sends your Form 5498 by May 31 each year. If you need a copy earlier (e.g., to file before you receive it), you can use your account statement as backup documentation — the Form 5498 is informational only and does not need to be filed with your return.
      </div>
    </div>
  );
}
