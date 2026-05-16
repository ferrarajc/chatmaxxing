import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function ProspectusPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Fund Prospectus Library</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Review detailed fund disclosures, investment objectives, risk factors, and historical performance for all BobsFunds mutual funds.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Available Fund Documents</h2>
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: theme.color.bg }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Fund</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Ticker</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Prospectus</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>SAI</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Annual Report</th>
              </tr>
            </thead>
            <tbody>
              {[
                { fund: 'BobsFunds 500 Index', ticker: 'BF500' },
                { fund: 'BobsFunds Growth', ticker: 'BFGR' },
                { fund: 'BobsFunds Bond Income', ticker: 'BFBI' },
                { fund: 'BobsFunds International', ticker: 'BFIN' },
                { fund: 'BobsFunds ESG Leaders', ticker: 'BFESG' },
                { fund: 'BobsFunds Short-Term Treasury', ticker: 'BFST' },
              ].map((row, i) => (
                <tr key={row.ticker} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.fund}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, fontWeight: 600 }}>{row.ticker}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>2025 Prospectus</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>Available</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>Dec 2024</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          All prospectuses are updated annually. To request a printed copy by mail, call 1-800-BOB-FUND or chat with a support agent.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>What Is in a Prospectus?</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Investment objectives and principal strategies</li>
          <li>Principal risks (market risk, credit risk, etc.)</li>
          <li>Historical performance bar charts and tables</li>
          <li>Fees and expenses (expense ratio, sales loads if any)</li>
          <li>Portfolio managers and their experience</li>
          <li>How to buy and sell shares</li>
          <li>Distributions and taxes</li>
        </ul>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/research" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Explore Funds →
        </NavLink>
      </div>
    </div>
  );
}
