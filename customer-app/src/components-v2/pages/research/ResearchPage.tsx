import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FUNDS } from '../../../data/funds';
import { useMarketData } from '../../../hooks/useMarketData';
import { theme } from '../../../theme';

const CATEGORIES = ['All', 'Large Cap Blend', 'Large Cap Growth', 'Intermediate Bond', 'International Blend', 'Large Cap ESG', 'Short-Term Bond'];

export function ResearchPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const { data: marketData } = useMarketData();

  const filtered = activeCategory === 'All' ? FUNDS : FUNDS.filter(f => f.category === activeCategory);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ margin: '0 0 10px', fontSize: 32, fontWeight: 600, color: theme.color.text, fontFamily: theme.font.serif, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Fund Research</h1>
      <p style={{ margin: '0 0 28px', color: theme.color.textMuted, fontSize: 15, lineHeight: 1.55 }}>
        Explore our full lineup of low-cost mutual funds.
      </p>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '6px 14px', borderRadius: theme.radius.pill, fontSize: 13, fontWeight: 500,
              border: '1px solid',
              borderColor: activeCategory === cat ? theme.color.primary : theme.color.borderStrong,
              background: activeCategory === cat ? theme.color.primary : theme.color.surface,
              color: activeCategory === cat ? theme.color.textOnPrimary : theme.color.textMuted,
              cursor: 'pointer', transition: 'all .15s',
              fontFamily: theme.font.sans, letterSpacing: '0.01em',
            }}
          >{cat}</button>
        ))}
      </div>

      {/* Fund cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 20 }}>
        {filtered.map(fund => {
          const live = marketData?.funds.find(f => f.ticker === fund.ticker);
          const ytd       = live?.ytd       ?? null;
          const oneYear   = live?.oneYear   ?? null;
          const threeYear = live?.threeYear ?? null;
          const fiveYear  = live?.fiveYear  ?? null;
          const expRatio  = live?.expenseRatio ?? fund.expenseRatio;

          const perf = [
            { label: 'YTD',    value: ytd },
            { label: '1-Year', value: oneYear },
            { label: '3-Year', value: threeYear },
            { label: '5-Year', value: fiveYear },
          ];

          return (
            <div key={fund.ticker} style={{ background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px', boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <Link
                    to={`/research/fund/${fund.ticker}`}
                    style={{
                      fontWeight: 600, fontSize: 17, marginBottom: 4, color: theme.color.text,
                      fontFamily: theme.font.serif, letterSpacing: '-0.01em',
                      textDecoration: 'none', display: 'block',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = theme.color.primary)}
                    onMouseLeave={e => (e.currentTarget.style.color = theme.color.text)}
                  >
                    {fund.name}
                  </Link>
                  <span style={{ fontSize: 11, color: theme.color.textMuted, background: theme.color.surfaceMuted, borderRadius: theme.radius.sm, padding: '2px 8px', letterSpacing: '0.02em' }}>{fund.category}</span>
                </div>
                <Link
                  to={`/research/fund/${fund.ticker}`}
                  style={{ fontWeight: 700, fontSize: 14, color: theme.color.accent, fontFamily: theme.font.mono, letterSpacing: '0.04em', background: theme.color.accentSoft, padding: '4px 8px', borderRadius: theme.radius.sm, textDecoration: 'none' }}
                >
                  {fund.ticker}
                </Link>
              </div>
              <p style={{ fontSize: 13, color: theme.color.textMuted, margin: '0 0 18px', lineHeight: 1.55 }}>{fund.description}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
                {perf.map(r => (
                  <div key={r.label} style={{ textAlign: 'center', background: theme.color.surfaceMuted, borderRadius: theme.radius.md, padding: '10px 4px' }}>
                    <div style={{
                      fontSize: 15, fontWeight: 600,
                      color: r.value !== null
                        ? (r.value > 0 ? theme.color.success : r.value < 0 ? theme.color.danger : theme.color.textMuted)
                        : theme.color.textSubtle,
                      fontFamily: theme.font.serif, fontVariantNumeric: 'tabular-nums',
                    }}>
                      {r.value !== null
                        ? r.value > 0 ? `▲ ${r.value}%` : r.value < 0 ? `▼ ${Math.abs(r.value)}%` : `${r.value}%`
                        : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: theme.color.textSubtle, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{r.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: theme.color.textMuted, paddingTop: 14, borderTop: `1px solid ${theme.color.border}`, fontVariantNumeric: 'tabular-nums' }}>
                <span>Expense ratio: <strong style={{ color: theme.color.text, fontWeight: 600 }}>{expRatio}%</strong></span>
                <span>Min investment: <strong style={{ color: theme.color.text, fontWeight: 600 }}>${fund.minInvestment}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
