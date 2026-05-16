import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function CostBasisPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Cost Basis Methods Explained</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Understanding cost basis affects your capital gains taxes when you sell fund shares. Choose the method that best suits your tax strategy.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>What Is Cost Basis?</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Cost basis is the original value of your shares. When you sell: Sale Proceeds minus Cost Basis equals your Capital Gain or Loss. Choosing the right method can meaningfully affect your annual tax bill.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Available Methods</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 16 }}>
          <thead>
            <tr style={{ background: theme.color.bg }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Method</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>How It Works</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Best For</th>
            </tr>
          </thead>
          <tbody>
            {[
              { method: 'Average Cost (Default)', how: 'Average price of all purchased shares', best: 'Most investors — simple and automatic' },
              { method: 'FIFO (First In, First Out)', how: 'Oldest shares sold first', best: 'Long-term investors seeking long-term gain treatment' },
              { method: 'Specific Identification', how: 'You choose exactly which shares to sell', best: 'Tax-loss harvesting strategies' },
            ].map((row, i) => (
              <tr key={row.method} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, fontWeight: 500 }}>{row.method}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.how}</td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.best}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          We use Average Cost by default. Change your method under My Account &gt; Tax Settings before executing a sale. The method cannot be changed after a sale is placed.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Short-Term vs. Long-Term Gains</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li><strong>Short-term (held less than 1 year):</strong> Taxed as ordinary income — up to 37%</li>
          <li><strong>Long-term (held 1 year or more):</strong> Taxed at preferential rates — 0%, 15%, or 20% depending on income</li>
        </ul>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/portfolio" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          View Your Portfolio →
        </NavLink>
      </div>
    </div>
  );
}
