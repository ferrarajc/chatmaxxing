import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function FundPerformancePage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Fund Performance FAQ</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Everything you need to know about how we measure and report fund performance at Bob's Mutual Funds.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>How is fund performance calculated?</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          All returns are calculated on a total-return basis, meaning they include both price appreciation and reinvested dividends. We report returns for standard periods: YTD, 1-year, 3-year, 5-year, and 10-year (where available). Returns beyond one year are annualized.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>BobsFunds Performance Summary</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
            <thead>
              <tr style={{ background: theme.color.bg }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Fund</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>YTD</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>1-Year</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>3-Year</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>5-Year</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, fontWeight: 700 }}>Exp. Ratio</th>
              </tr>
            </thead>
            <tbody>
              {[
                { fund: 'BobsFunds 500 Index (BF500)', ytd: '+8.4%', y1: '+24.1%', y3: '+9.8%', y5: '+13.2%', exp: '0.03%' },
                { fund: 'BobsFunds Growth (BFGR)', ytd: '+11.2%', y1: '+31.4%', y3: '+12.1%', y5: '+18.7%', exp: '0.25%' },
                { fund: 'BobsFunds Bond Income (BFBI)', ytd: '+1.8%', y1: '+4.2%', y3: '+2.1%', y5: '+3.8%', exp: '0.10%' },
                { fund: 'BobsFunds International (BFIN)', ytd: '+6.3%', y1: '+15.3%', y3: '+6.4%', y5: '+9.1%', exp: '0.20%' },
                { fund: 'BobsFunds ESG Leaders (BFESG)', ytd: '+7.9%', y1: '+22.7%', y3: '+9.3%', y5: '+12.8%', exp: '0.18%' },
                { fund: 'BobsFunds Short-Term Treasury (BFST)', ytd: '+1.9%', y1: '+5.1%', y3: '+3.2%', y5: '+2.9%', exp: '0.08%' },
              ].map((row, i) => (
                <tr key={row.fund} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text }}>{row.fund}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.ytd}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.y1}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.y3}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.y5}</td>
                  <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' }}>{row.exp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          Returns as of April 30, 2025. Past performance is not a guarantee of future results.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>What benchmarks do your funds use?</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li><strong>BF500:</strong> S&amp;P 500 Index</li>
          <li><strong>BFGR:</strong> Russell 1000 Growth Index</li>
          <li><strong>BFBI:</strong> Bloomberg US Aggregate Bond Index</li>
          <li><strong>BFIN:</strong> MSCI EAFE Index</li>
          <li><strong>BFESG:</strong> MSCI USA ESG Leaders Index</li>
          <li><strong>BFST:</strong> Bloomberg US 1–3 Year Treasury Index</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Where can I find the full prospectus?</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Full fund prospectuses, including detailed performance histories, risk disclosures, and investment objectives, are available in our{' '}
          <NavLink to="/help/prospectus" style={{ color: theme.color.primary, textDecoration: 'underline' }}>Fund Prospectus Library</NavLink>.
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/portfolio" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          View Your Portfolio →
        </NavLink>
      </div>
    </div>
  );
}
