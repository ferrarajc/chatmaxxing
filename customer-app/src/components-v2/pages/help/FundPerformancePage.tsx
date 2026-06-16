import React, { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';
import { useFunds } from '../../../hooks/useFunds';
import { useMarketData } from '../../../hooks/useMarketData';
import { FundGroup } from '../../../data/funds';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

const GROUP_ORDER: FundGroup[] = ['US Equity', 'Sector Equity', 'International', 'Fixed Income'];

function Perf({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return <span style={{ color: theme.color.textSubtle }}>—</span>;
  }
  const color = value > 0 ? theme.color.success : value < 0 ? theme.color.danger : theme.color.textMuted;
  const txt = `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  return <span style={{ color, fontWeight: 600 }}>{txt}</span>;
}

const thR: React.CSSProperties = {
  textAlign: 'right', padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`,
  fontWeight: 700, position: 'sticky', top: 0, background: theme.color.bg,
};
const thL: React.CSSProperties = { ...thR, textAlign: 'left' };
const tdR: React.CSSProperties = { padding: '8px 12px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.text, textAlign: 'right' };
const tdL: React.CSSProperties = { ...tdR, textAlign: 'left' };

export function FundPerformancePage() {
  const { funds } = useFunds();
  const { fundQuote } = useMarketData();

  const sorted = useMemo(() => {
    const rank = (g: FundGroup) => GROUP_ORDER.indexOf(g);
    return [...funds].sort((a, b) => rank(a.group) - rank(b.group) || a.name.localeCompare(b.name));
  }, [funds]);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Fund Performance FAQ</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Everything you need to know about how we measure and report fund performance at Bob's Mutual Funds.
      </p>

      {/* Explanatory content first, so it stays visible as the fund table grows. */}
      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>How is fund performance calculated?</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          All returns are calculated on a total-return basis, meaning they include both price appreciation and reinvested dividends. We report returns for standard periods: YTD, 1-year, 3-year, 5-year, and 10-year (where available). Returns beyond one year are annualized.
        </p>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>BobsFunds Performance Summary</h2>
          <span style={{ fontSize: 12, color: theme.color.textMuted }}>{sorted.length} funds</span>
        </div>
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: theme.color.bg }}>
                <th style={thL}>Fund</th>
                <th style={thR}>YTD</th>
                <th style={thR}>1-Year</th>
                <th style={thR}>3-Year</th>
                <th style={thR}>5-Year</th>
                <th style={thR}>Exp. Ratio</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((f, i) => {
                const q = fundQuote(f.ticker);
                return (
                  <tr key={f.ticker} style={{ background: i % 2 === 0 ? 'transparent' : theme.color.bg }}>
                    <td style={tdL}>{f.name} <span style={{ color: theme.color.textMuted, fontWeight: 600 }}>({f.ticker})</span></td>
                    <td style={tdR}><Perf value={q?.ytd} /></td>
                    <td style={tdR}><Perf value={q?.oneYear} /></td>
                    <td style={tdR}><Perf value={q?.threeYear} /></td>
                    <td style={tdR}><Perf value={q?.fiveYear} /></td>
                    <td style={tdR}>{f.expenseRatio.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 16, background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          Returns reflect the latest delayed market quotes and are shown net of fees. Past performance is not a guarantee of future results. A dash (—) means a live quote is temporarily unavailable.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>What benchmarks do your funds use?</h2>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: theme.color.textMuted }}>
          Each fund is measured against a widely recognized index:
        </p>
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: theme.color.text }}>
            {sorted.map(f => (
              <li key={f.ticker}><strong>{f.ticker}:</strong> {f.benchmark}</li>
            ))}
          </ul>
        </div>
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
