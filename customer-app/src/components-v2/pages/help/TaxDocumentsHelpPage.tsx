import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function TaxDocumentsHelpPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Tax Documents &amp; 1099 Forms</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Find, download, and understand your annual tax forms. Bob's Mutual Funds makes tax season as painless as possible.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Available Tax Forms</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: theme.color.bg }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Form</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>What It Reports</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Mailing Deadline</th>
            </tr>
          </thead>
          <tbody>
            {[
              { form: '1099-DIV', what: 'Dividends and capital gain distributions', deadline: 'January 31' },
              { form: '1099-B', what: 'Proceeds from sales and exchanges', deadline: 'February 15' },
              { form: '1099-R', what: 'Retirement account distributions (including RMDs)', deadline: 'January 31' },
              { form: '5498', what: 'IRA contributions and fair market value', deadline: 'May 31' },
            ].map((row, i) => (
              <tr key={row.form} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, fontWeight: 600 }}>{row.form}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.what}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.deadline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Accessing Your Tax Documents</h2>
        <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Log in → My Account → Tax Documents</li>
          <li>Forms are available electronically by the dates above (often earlier)</li>
          <li>If enrolled in paperless delivery, you receive email notification when forms are ready</li>
          <li>Paper copies are mailed by the IRS deadlines</li>
        </ul>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          Consolidated 1099 forms (combining 1099-DIV, 1099-B, and 1099-INT) are delivered by February 15. Some forms require a correction period and may be delivered up to March 15.
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/account/tax-documents" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          View Your Tax Documents →
        </NavLink>
      </div>
    </div>
  );
}
