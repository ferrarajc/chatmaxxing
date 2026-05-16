import React from 'react';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function ContactPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Contact Us &amp; Support Hours</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        We are here to help. Choose the contact method that works best for you.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Ways to Reach Us</h2>

        {[
          {
            icon: '💬',
            title: 'Live Chat (Fastest)',
            body: 'Available 24/7. Click the chat bubble on any page in your account. Our virtual assistant handles most questions instantly; agents are available for complex issues Monday–Friday, 8 AM–8 PM ET.',
          },
          {
            icon: '📞',
            title: 'Phone',
            body: '1-800-BOB-FUND (1-800-262-3863)\nMonday–Friday: 8:00 AM – 8:00 PM ET\nSaturday: 9:00 AM – 5:00 PM ET',
          },
          {
            icon: '✉',
            title: 'Secure Message',
            body: 'Send a secure message from My Account > Messages. Response within 1 business day for standard requests; 3 business days for complex account issues.',
          },
          {
            icon: '📬',
            title: 'Mail',
            body: "Bob's Mutual Funds\nPO Box 2025, Malvern, PA 19355\nOvernight: 100 Vanguard Blvd, Malvern, PA 19355",
          },
        ].map((method, i) => (
          <div key={method.title} style={{ display: 'flex', gap: 14, marginBottom: i < 3 ? 20 : 0, paddingBottom: i < 3 ? 20 : 0, borderBottom: i < 3 ? `1px solid ${theme.color.border}` : 'none' }}>
            <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{method.icon}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{method.title}</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: theme.color.textMuted, whiteSpace: 'pre-line' }}>{method.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Holiday Closures 2025</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: theme.color.bg }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Holiday</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {[
              { holiday: "New Year's Day", date: 'January 1' },
              { holiday: 'Martin Luther King Jr. Day', date: 'January 20' },
              { holiday: "Presidents' Day", date: 'February 17' },
              { holiday: 'Memorial Day', date: 'May 26' },
              { holiday: 'Juneteenth', date: 'June 19' },
              { holiday: 'Independence Day', date: 'July 4' },
              { holiday: 'Labor Day', date: 'September 1' },
              { holiday: 'Thanksgiving Day', date: 'November 27' },
              { holiday: 'Christmas Day', date: 'December 25' },
            ].map((row, i) => (
              <tr key={row.holiday} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.holiday}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
