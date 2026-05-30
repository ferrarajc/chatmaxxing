import React from 'react';
import { Link } from 'react-router-dom';
import { FUNDS } from '../../../data/funds';
import { useMarketData } from '../../../hooks/useMarketData';
import { useClientStore } from '../../../store/clientStore';
import { theme } from '../../../theme';

// Static fallback market data shown while live data loads
const STATIC_INDICES = [
  { name: 'S&P 500',   value: '—', change: '—', up: true },
  { name: 'Dow Jones', value: '—', change: '—', up: true },
  { name: 'NASDAQ',    value: '—', change: '—', up: true },
];

function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function HomePage() {
  const { activePersona } = useClientStore();
  const firstName = activePersona.name.split(' ')[0];
  const { data: marketData } = useMarketData();

  const indices = marketData
    ? marketData.indices.map(idx => ({
        name: idx.name,
        value: fmtNum(idx.value),
        change: idx.change > 0 ? `▲ ${idx.change}%` : idx.change < 0 ? `▼ ${Math.abs(idx.change)}%` : `${idx.change}%`,
        up: idx.change >= 0,
      }))
    : STATIC_INDICES;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>

      {/* Hero */}
      <div style={{
        background: theme.color.primary,
        borderRadius: theme.radius.xl, padding: '52px 48px', color: theme.color.textOnPrimary, marginBottom: 36,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 48, width: 48, height: 3,
          background: theme.color.accent,
        }} />
        <h1 style={{
          margin: '0 0 14px', fontSize: 38, fontWeight: 600,
          fontFamily: theme.font.serif, letterSpacing: '-0.02em', lineHeight: 1.1,
          color: theme.color.textOnPrimary,
        }}>
          Welcome back, {firstName}.
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 15, opacity: 0.78, letterSpacing: '0.02em', textTransform: 'uppercase', fontWeight: 500 }}>
          Your total portfolio value
        </p>
        <div style={{
          fontSize: 56, fontWeight: 600, letterSpacing: '-0.02em',
          fontFamily: theme.font.serif, fontVariantNumeric: 'tabular-nums',
        }}>
          ${activePersona.totalBalance.toLocaleString()}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 14, opacity: 0.72 }}>
          Across {activePersona.accounts.length} account{activePersona.accounts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Market ticker */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 36, flexWrap: 'wrap' }}>
        {indices.map(m => (
          <div key={m.name} style={{
            flex: '1 1 150px', background: theme.color.surface,
            borderRadius: theme.radius.lg, padding: '18px 22px',
            boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`,
          }}>
            <div style={{
              fontSize: 11, color: theme.color.textMuted, marginBottom: 6,
              textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
            }}>{m.name}</div>
            <div style={{
              fontSize: 22, fontWeight: 600, color: theme.color.text,
              fontFamily: theme.font.serif, fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.01em',
            }}>{m.value}</div>
            <div style={{
              color: m.up ? theme.color.success : theme.color.danger,
              fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 2,
            }}>
              {m.change}
            </div>
          </div>
        ))}
      </div>

      {/* Featured funds */}
      <h2 style={{
        fontSize: 22, fontWeight: 600, marginBottom: 18, color: theme.color.text,
        fontFamily: theme.font.serif, letterSpacing: '-0.01em',
      }}>Featured Funds</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
        {FUNDS.slice(0, 3).map(fund => {
          const live = marketData?.funds.find(f => f.ticker === fund.ticker);
          const oneYear = live?.oneYear ?? null;
          const expenseRatio = live?.expenseRatio ?? fund.expenseRatio;

          return (
            <div key={fund.ticker} style={{
              background: theme.color.surface, borderRadius: theme.radius.lg, padding: '22px 24px',
              boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <Link
                    to={`/research/fund/${fund.ticker}`}
                    style={{
                      fontWeight: 600, fontSize: 16, color: theme.color.text,
                      fontFamily: theme.font.serif, letterSpacing: '-0.01em',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = theme.color.primary)}
                    onMouseLeave={e => (e.currentTarget.style.color = theme.color.text)}
                  >
                    {fund.name}
                  </Link>
                  <div style={{ fontSize: 12, color: theme.color.textMuted, marginTop: 2 }}>{fund.category}</div>
                </div>
                <span style={{
                  background: theme.color.primarySoft, color: theme.color.primary,
                  borderRadius: theme.radius.sm, padding: '3px 8px',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                  fontFamily: theme.font.mono,
                }}>{fund.ticker}</span>
              </div>
              <p style={{ fontSize: 13, color: theme.color.textMuted, margin: '0 0 14px', lineHeight: 1.5 }}>{fund.description}</p>
              <div style={{ display: 'flex', gap: 20, paddingTop: 14, borderTop: `1px solid ${theme.color.border}` }}>
                <div>
                  <div style={{
                    fontSize: 18, fontWeight: 600,
                    color: oneYear !== null
                      ? (oneYear > 0 ? theme.color.success : theme.color.danger)
                      : theme.color.textMuted,
                    fontFamily: theme.font.serif, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {oneYear !== null
                      ? oneYear > 0 ? `▲ ${oneYear}%` : oneYear < 0 ? `▼ ${Math.abs(oneYear)}%` : `${oneYear}%`
                      : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: theme.color.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>1-year</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: theme.color.text, fontFamily: theme.font.serif, fontVariantNumeric: 'tabular-nums' }}>{expenseRatio}%</div>
                  <div style={{ fontSize: 10, color: theme.color.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Expense ratio</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat notice */}
      <div style={{
        marginTop: 44, background: theme.color.surfaceWell, borderRadius: theme.radius.lg,
        padding: '22px 26px', border: `1px solid ${theme.color.border}`,
        borderLeft: `3px solid ${theme.color.accent}`,
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
          stroke={theme.color.accent} strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4, color: theme.color.text, fontFamily: theme.font.serif, letterSpacing: '-0.01em' }}>
            Need help? Chat is our front door.
          </div>
          <div style={{ fontSize: 14, color: theme.color.textMuted, lineHeight: 1.55 }}>
            Our chat support team is available 24/7. Click the chat bubble in the corner to get started.
            If you call our 800 number, you'll be directed here for the fastest service.
          </div>
        </div>
      </div>
    </div>
  );
}
