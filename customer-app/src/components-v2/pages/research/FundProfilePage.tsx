import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { theme } from '../../../theme';
import { FUND_BY_TICKER, AllocationSlice, Distribution } from '../../../data/funds';
import { useMarketData, FundQuote } from '../../../hooks/useMarketData';
import { useClientStore } from '../../../store/clientStore';

// ── Shared styles ──────────────────────────────────────────────────────────

const S = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '32px 24px',
    fontFamily: theme.font.sans,
  } as React.CSSProperties,

  back: {
    fontSize: 13,
    color: theme.color.textMuted,
    textDecoration: 'none',
    display: 'inline-block',
    marginBottom: 24,
  } as React.CSSProperties,

  card: {
    background: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: '24px',
    marginBottom: 20,
    boxShadow: theme.shadow.sm,
    border: `1px solid ${theme.color.border}`,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: theme.color.text,
    fontFamily: theme.font.serif,
    letterSpacing: '-0.01em',
    margin: '0 0 16px',
  } as React.CSSProperties,

  th: {
    padding: '8px 0',
    color: theme.color.textMuted,
    fontWeight: 600,
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } as React.CSSProperties,

  td: {
    padding: '10px 0',
    borderBottom: `1px solid ${theme.color.border}`,
    fontSize: 14,
    color: theme.color.text,
  } as React.CSSProperties,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtAum(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  return `$${fmt(n, 0)}`;
}

function pctColor(n: number): string {
  if (n > 0) return theme.color.success;
  if (n < 0) return theme.color.danger;
  return theme.color.textMuted;
}

function pctText(n: number, showSign = true): string {
  if (!showSign) return `${Math.abs(n)}%`;
  if (n > 0) return `▲ ${n}%`;
  if (n < 0) return `▼ ${Math.abs(n)}%`;
  return `${n}%`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PerfCell({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div style={{ textAlign: 'center', background: theme.color.surfaceMuted, borderRadius: theme.radius.md, padding: '16px 8px' }}>
      <div style={{
        fontSize: 22, fontWeight: 600, color: pctColor(value),
        fontFamily: theme.font.serif, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
      }}>
        {pctText(value)}
      </div>
      <div style={{ fontSize: 11, color: theme.color.textSubtle, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
        {label}
      </div>
      {note && <div style={{ fontSize: 10, color: theme.color.textSubtle, marginTop: 2 }}>{note}</div>}
    </div>
  );
}

const RISK_LEVELS = ['Low', 'Low–Medium', 'Medium', 'Medium–High', 'High'] as const;
const RISK_COLORS = ['#2F6B4F', '#7A9E48', '#C09030', '#C0622A', '#9A2B2B'];

function RiskMeter({ level }: { level: string }) {
  const idx = RISK_LEVELS.indexOf(level as typeof RISK_LEVELS[number]);
  const activeColor = idx >= 0 ? RISK_COLORS[idx] : theme.color.primary;
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {RISK_LEVELS.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 10, borderRadius: 5,
            background: i === idx ? activeColor : theme.color.border,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: theme.color.textSubtle }}>Low</span>
        <span style={{ color: activeColor, fontWeight: 700, fontSize: 12 }}>{level}</span>
        <span style={{ color: theme.color.textSubtle }}>High</span>
      </div>
    </div>
  );
}

function AllocationChart({ data, label }: { data: AllocationSlice[]; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 14 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.map(row => (
          <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 200, fontSize: 13, color: theme.color.text, flexShrink: 0 }}>{row.name}</div>
            <div style={{ flex: 1, height: 10, background: theme.color.border, borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ width: `${row.pct}%`, height: '100%', background: theme.color.primary, borderRadius: 5 }} />
            </div>
            <div style={{ width: 44, fontSize: 13, color: theme.color.textMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {row.pct}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionTable({ distributions }: { distributions: Distribution[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...S.th, textAlign: 'left'  }}>Ex-Date</th>
          <th style={{ ...S.th, textAlign: 'left'  }}>Type</th>
          <th style={{ ...S.th, textAlign: 'right' }}>Per Share</th>
        </tr>
      </thead>
      <tbody>
        {distributions.map((d, i) => (
          <tr key={i}>
            <td style={{ ...S.td, textAlign: 'left',  color: theme.color.textMuted }}>
              {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </td>
            <td style={{ ...S.td, textAlign: 'left' }}>{d.type}</td>
            <td style={{ ...S.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
              ${d.amount.toFixed(3)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Your Holdings section ──────────────────────────────────────────────────

function YourHoldings({ ticker, fundName, currentPrice }: { ticker: string; fundName: string; currentPrice: number }) {
  const { activePersona } = useClientStore();
  const fundHoldings = activePersona.holdings.filter(h => h.ticker === ticker);
  if (fundHoldings.length === 0) return null;

  const accountTypeMap = new Map(activePersona.accounts.map(a => [a.id, a.type]));
  const priceToUse = currentPrice > 0 ? currentPrice : (fundHoldings[0]?.price ?? 0);
  const totalShares = fundHoldings.reduce((sum, h) => sum + h.shares, 0);
  const totalValue  = fundHoldings.reduce((sum, h) => sum + h.shares * priceToUse, 0);

  const fundTxns = activePersona.transactions
    .filter(t => {
      const d = t.description.toLowerCase();
      return d.includes(ticker.toLowerCase()) || d.includes(fundName.toLowerCase());
    })
    .slice(0, 5);

  return (
    <div style={{ ...S.card, borderLeft: `3px solid ${theme.color.success}` }}>
      <h2 style={S.sectionTitle}>Your Holdings</h2>

      <div style={{ display: 'flex', gap: 32, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>Total Value</div>
          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: theme.font.serif, fontVariantNumeric: 'tabular-nums', color: theme.color.text, letterSpacing: '-0.02em' }}>
            ${fmt(totalValue)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>Total Shares</div>
          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: theme.font.serif, fontVariantNumeric: 'tabular-nums', color: theme.color.text, letterSpacing: '-0.02em' }}>
            {fmt(totalShares)}
          </div>
        </div>
        {priceToUse > 0 && (
          <div>
            <div style={{ fontSize: 11, color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>Current Price</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: theme.font.serif, fontVariantNumeric: 'tabular-nums', color: theme.color.text, letterSpacing: '-0.02em' }}>
              ${fmt(priceToUse)}
            </div>
          </div>
        )}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: fundTxns.length > 0 ? 20 : 0 }}>
        <thead>
          <tr>
            <th style={{ ...S.th, textAlign: 'left'  }}>Account</th>
            <th style={{ ...S.th, textAlign: 'right' }}>Shares</th>
            <th style={{ ...S.th, textAlign: 'right' }}>Price</th>
            <th style={{ ...S.th, textAlign: 'right' }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {fundHoldings.map((h, i) => (
            <tr key={i}>
              <td style={{ ...S.td, textAlign: 'left'  }}>{accountTypeMap.get(h.accountId) ?? h.accountId}</td>
              <td style={{ ...S.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(h.shares)}</td>
              <td style={{ ...S.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${fmt(priceToUse)}</td>
              <td style={{ ...S.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>${fmt(h.shares * priceToUse)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {fundTxns.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.color.textMuted, marginBottom: 8 }}>Recent Transactions</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...S.th, textAlign: 'left'  }}>Date</th>
                <th style={{ ...S.th, textAlign: 'left'  }}>Description</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {fundTxns.map((t, i) => (
                <tr key={i}>
                  <td style={{ ...S.td, textAlign: 'left', color: theme.color.textMuted, whiteSpace: 'nowrap' }}>
                    {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={{ ...S.td, textAlign: 'left' }}>{t.description}</td>
                  <td style={{
                    ...S.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                    color: t.amount >= 0 ? theme.color.success : theme.color.danger,
                  }}>
                    {t.amount >= 0 ? '+' : '-'}${fmt(Math.abs(t.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function FundProfilePage() {
  const { ticker } = useParams<{ ticker: string }>();
  const fundDef = FUND_BY_TICKER.get(ticker ?? '');
  const { fundQuote, loading } = useMarketData();

  if (!fundDef) {
    return (
      <div style={S.page}>
        <Link to="/research" style={S.back}>← Back to Fund Research</Link>
        <p style={{ color: theme.color.textMuted }}>Fund not found.</p>
      </div>
    );
  }

  const live: FundQuote | undefined = fundQuote(fundDef.ticker);

  const price     = live?.price      ?? 0;
  const dayChange = live?.dayChange  ?? 0;
  const ytd       = live?.ytd        ?? 0;
  const oneYear   = live?.oneYear    ?? 0;
  const threeYear = live?.threeYear  ?? 0;
  const fiveYear  = live?.fiveYear   ?? 0;
  const aum       = live?.totalAssets  ?? null;
  const inception = live?.inceptionDate ?? null;
  const topHoldings = live?.topHoldings ?? [];
  const expRatio  = live?.expenseRatio ?? fundDef.expenseRatio;

  const aboutDetails = [
    { label: 'Benchmark Index',        value: fundDef.benchmark },
    { label: 'Fund Category',          value: fundDef.category },
    { label: 'Expense Ratio',          value: `${expRatio}%` },
    { label: 'Minimum Investment',     value: `$${fundDef.minInvestment}` },
    { label: '# of Holdings',         value: fundDef.numHoldings.toLocaleString() },
    { label: 'Annual Turnover',        value: `~${fundDef.turnoverRate}%` },
    { label: 'Risk Level',             value: fundDef.riskLevel },
    { label: 'Distribution Frequency',value: fundDef.distributionFrequency },
    ...(aum       ? [{ label: 'Assets Under Mgmt', value: fmtAum(aum) }] : []),
    ...(inception ? [{ label: 'Inception Date',    value: inception }]    : []),
  ];

  return (
    <div style={S.page}>

      {/* Back link */}
      <Link to="/research" style={S.back}>← Back to Fund Research</Link>

      {/* ── Fund header card ─────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>

          {/* Left: name, category, description */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <h1 style={{
                margin: 0, fontSize: 26, fontWeight: 600, color: theme.color.text,
                fontFamily: theme.font.serif, letterSpacing: '-0.02em', lineHeight: 1.1,
              }}>
                {fundDef.name}
              </h1>
              <span style={{
                fontSize: 12, fontWeight: 700, color: theme.color.accent,
                fontFamily: theme.font.mono, letterSpacing: '0.04em',
                background: theme.color.accentSoft, padding: '3px 8px',
                borderRadius: theme.radius.sm, flexShrink: 0,
              }}>
                {fundDef.ticker}
              </span>
            </div>
            <span style={{
              fontSize: 11, color: theme.color.textMuted, background: theme.color.surfaceMuted,
              borderRadius: theme.radius.sm, padding: '3px 8px', letterSpacing: '0.02em', display: 'inline-block', marginBottom: 12,
            }}>
              {fundDef.category}
            </span>
            <p style={{ margin: 0, fontSize: 14, color: theme.color.textMuted, lineHeight: 1.55 }}>
              {fundDef.description}
            </p>
          </div>

          {/* Right: price + day change */}
          {price > 0 && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                fontSize: 32, fontWeight: 600, fontFamily: theme.font.serif,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                color: theme.color.text, lineHeight: 1,
              }}>
                ${fmt(price)}
              </div>
              <div style={{
                fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                marginTop: 4, color: pctColor(dayChange),
              }}>
                {pctText(dayChange)} today
              </div>
              {loading && <div style={{ fontSize: 11, color: theme.color.textSubtle, marginTop: 4 }}>Updating…</div>}
            </div>
          )}
        </div>

        {/* Buy button — lower right */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: `1px solid ${theme.color.border}` }}>
          <Link
            to={`/research/fund/${fundDef.ticker}/buy`}
            style={{
              display: 'inline-block', padding: '10px 24px',
              background: theme.color.primary, color: theme.color.textOnPrimary,
              borderRadius: theme.radius.md, textDecoration: 'none',
              fontSize: 14, fontWeight: 600, fontFamily: theme.font.sans,
              letterSpacing: '0.02em',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = theme.color.primaryHover)}
            onMouseLeave={e => (e.currentTarget.style.background = theme.color.primary)}
          >
            Buy {fundDef.ticker}
          </Link>
        </div>
      </div>

      {/* ── Your Holdings (conditional) ───────────────────────────────────── */}
      <YourHoldings ticker={fundDef.ticker} fundName={fundDef.name} currentPrice={price} />

      {/* ── About This Fund ──────────────────────────────────────────────── */}
      <div style={S.card}>
        <h2 style={S.sectionTitle}>About This Fund</h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: theme.color.textMuted, lineHeight: 1.65 }}>
          {fundDef.longDescription}
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 14, paddingTop: 16, borderTop: `1px solid ${theme.color.border}`,
        }}>
          {aboutDetails.map(item => (
            <div key={item.label}>
              <div style={{ fontSize: 11, color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 3 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 14, color: theme.color.text, fontWeight: 500 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Performance Returns ───────────────────────────────────────────── */}
      <div style={S.card}>
        <h2 style={S.sectionTitle}>Performance Returns</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
          <PerfCell label="YTD"    value={ytd} />
          <PerfCell label="1-Year" value={oneYear} />
          <PerfCell label="3-Year" value={threeYear} note="annualized" />
          <PerfCell label="5-Year" value={fiveYear}  note="annualized" />
        </div>
        <p style={{ margin: 0, fontSize: 11, color: theme.color.textSubtle }}>
          Returns calculated from market data. Past performance does not guarantee future results.
        </p>
      </div>

      {/* ── Portfolio Composition ─────────────────────────────────────────── */}
      <div style={S.card}>
        <h2 style={S.sectionTitle}>Portfolio Composition</h2>
        <AllocationChart data={fundDef.sectorAllocation} label={fundDef.allocationLabel} />

        {topHoldings.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: '24px 0 14px' }}>
              Top {topHoldings.length} Holdings
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, textAlign: 'left'  }}>#</th>
                  <th style={{ ...S.th, textAlign: 'left'  }}>Holding</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Weight</th>
                </tr>
              </thead>
              <tbody>
                {topHoldings.map((h, i) => (
                  <tr key={i}>
                    <td style={{ ...S.td, textAlign: 'left',  color: theme.color.textMuted, width: 28 }}>{i + 1}</td>
                    <td style={{ ...S.td, textAlign: 'left' }}>{h.name}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{h.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* ── Risk Profile ──────────────────────────────────────────────────── */}
      <div style={S.card}>
        <h2 style={S.sectionTitle}>Risk Profile</h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: theme.color.textMuted, lineHeight: 1.55 }}>
          Risk is assessed relative to the fund's asset class and investment universe. This is not a guarantee of future volatility.
        </p>
        <RiskMeter level={fundDef.riskLevel} />
      </div>

      {/* ── Distribution History ──────────────────────────────────────────── */}
      <div style={S.card}>
        <h2 style={S.sectionTitle}>Distribution History</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: theme.color.textMuted }}>
          {fundDef.distributionFrequency} distributions. Amounts shown are per-share.
        </p>
        <DistributionTable distributions={fundDef.distributions} />
      </div>

      {/* ── Fund Documents ────────────────────────────────────────────────── */}
      <div style={S.card}>
        <h2 style={S.sectionTitle}>Fund Documents</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            'Prospectus',
            'Summary Prospectus',
            'Annual Report',
            'Semi-Annual Report',
            'Statement of Additional Information',
          ].map(doc => (
            <div key={doc} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: theme.radius.md,
              border: `1px solid ${theme.color.border}`, background: theme.color.surfaceMuted,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.color.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span style={{ fontSize: 14, color: theme.color.text }}>{doc}</span>
              </div>
              <span style={{ fontSize: 12, color: theme.color.textSubtle, fontStyle: 'italic' }}>PDF</span>
            </div>
          ))}
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 11, color: theme.color.textSubtle }}>
          Before investing, consider the fund's investment objectives, risks, charges, and expenses.
        </p>
      </div>

    </div>
  );
}
