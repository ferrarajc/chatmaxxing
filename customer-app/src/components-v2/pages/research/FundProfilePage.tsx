import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { theme } from '../../../theme';
import { FUND_BY_TICKER, AllocationSlice, Distribution, FundDef } from '../../../data/funds';
import { useMarketData, FundQuote } from '../../../hooks/useMarketData';
import { useClientStore } from '../../../store/clientStore';

// ── Formatters ─────────────────────────────────────────────────────────────

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
function pctSign(n: number): string {
  return n > 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`;
}

// ── Card style (no marginBottom — callers handle spacing) ──────────────────

const card: React.CSSProperties = {
  background: theme.color.surface,
  borderRadius: theme.radius.xl,
  padding: '24px 28px',
  boxShadow: theme.shadow.sm,
  border: `1px solid ${theme.color.border}`,
};

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: theme.color.accent,
      borderBottom: `2px solid ${theme.color.accent}`,
      paddingBottom: 2, marginBottom: 20, display: 'inline-block',
    }}>
      {children}
    </div>
  );
}

// ── Annual Returns Bar Chart ───────────────────────────────────────────────

function AnnualReturnsChart({ data }: { data: { year: number; pct: number }[] }) {
  const maxAbs = Math.max(...data.map(d => Math.abs(d.pct)), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {data.map(({ year, pct }) => {
        const barW = (Math.abs(pct) / maxAbs) * 46;
        const pos = pct >= 0;
        return (
          <div key={year} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 34, textAlign: 'right', fontSize: 12, color: theme.color.textSubtle, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {year}
            </span>
            <div style={{ flex: 1, position: 'relative', height: 22 }}>
              <div style={{ position: 'absolute', left: '50%', top: 3, bottom: 3, width: 1, background: theme.color.border, transform: 'translateX(-50%)' }} />
              <div style={{
                position: 'absolute', top: 4, bottom: 4,
                ...(pos
                  ? { left: '50%', width: `${barW}%`, borderRadius: '0 3px 3px 0' }
                  : { right: '50%', width: `${barW}%`, borderRadius: '3px 0 0 3px' }),
                background: pos ? theme.color.success : theme.color.danger,
                opacity: 0.82,
              }} />
            </div>
            <span style={{
              width: 52, textAlign: 'right', fontSize: 12, fontWeight: 600, flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
              color: pos ? theme.color.success : theme.color.danger,
            }}>
              {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Performance vs Benchmark Table ────────────────────────────────────────

function PerformanceTable({
  dayChange, ytd, oneYear, threeYear, fiveYear, expRatio, benchmark,
}: {
  dayChange: number; ytd: number; oneYear: number; threeYear: number; fiveYear: number;
  expRatio: number; benchmark: string;
}) {
  const rows = [
    { label: 'Day Change', fund: dayChange,  bm: null,                               note: '' },
    { label: 'YTD',        fund: ytd,        bm: parseFloat((ytd + expRatio).toFixed(2)),       note: '' },
    { label: '1-Year',     fund: oneYear,    bm: parseFloat((oneYear + expRatio).toFixed(2)),   note: '' },
    { label: '3-Year',     fund: threeYear,  bm: parseFloat((threeYear + expRatio).toFixed(2)), note: 'ann.' },
    { label: '5-Year',     fund: fiveYear,   bm: parseFloat((fiveYear + expRatio).toFixed(2)),  note: 'ann.' },
  ];
  const thStyle: React.CSSProperties = { padding: '6px 0', fontSize: 11, fontWeight: 600, color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em' };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...thStyle, textAlign: 'left'  }}>Period</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Fund</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Index</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.label}>
            <td style={{ padding: '9px 0', borderBottom: `1px solid ${theme.color.border}`, fontSize: 13, color: theme.color.textMuted }}>
              {row.label}
              {row.note && <span style={{ fontSize: 10, marginLeft: 4, color: theme.color.textSubtle }}>{row.note}</span>}
            </td>
            <td style={{ padding: '9px 0', borderBottom: `1px solid ${theme.color.border}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 14, color: pctColor(row.fund) }}>
              {pctSign(row.fund)}
            </td>
            <td style={{ padding: '9px 0', borderBottom: `1px solid ${theme.color.border}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: theme.color.textSubtle }}>
              {row.bm !== null ? pctSign(row.bm) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3} style={{ paddingTop: 8, fontSize: 10, color: theme.color.textSubtle }}>
            Index: {benchmark}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

// ── Sector Allocation Donut ────────────────────────────────────────────────

const ALLOC_COLORS = ['#0F2340','#A05A2C','#2A7B6E','#B07E2A','#4A6080','#5C7A60','#7A4A6A'];

function polarXY(cx: number, cy: number, r: number, deg: number) {
  const rad = deg * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function donutArc(cx: number, cy: number, outerR: number, innerR: number, s: number, e: number): string {
  const os = polarXY(cx, cy, outerR, s); const oe = polarXY(cx, cy, outerR, e);
  const ie = polarXY(cx, cy, innerR, e); const is_ = polarXY(cx, cy, innerR, s);
  const large = (e - s) > 180 ? 1 : 0;
  return `M ${os.x} ${os.y} A ${outerR} ${outerR} 0 ${large} 1 ${oe.x} ${oe.y} L ${ie.x} ${ie.y} A ${innerR} ${innerR} 0 ${large} 0 ${is_.x} ${is_.y} Z`;
}

function AllocationDonut({ data, label }: { data: AllocationSlice[]; label: string }) {
  const [hov, setHov] = useState<number | null>(null);
  const cx = 72, cy = 72, oR = 62, iR = 38;
  const total = data.reduce((s, d) => s + d.pct, 0);
  let cum = -90;
  const segs = data.map((sl, i) => {
    const span = Math.min((sl.pct / total) * 360, 359.99);
    const st = cum; cum += span;
    return { path: donutArc(cx, cy, oR, iR, st, cum), color: ALLOC_COLORS[i % ALLOC_COLORS.length], sl };
  });
  const h = hov !== null ? data[hov] : null;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.color.textSubtle, marginBottom: 14 }}>{label}</div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <svg width={144} height={144} style={{ flexShrink: 0 }}>
          {segs.map((seg, i) => (
            <path key={i} d={seg.path} fill={seg.color} stroke={theme.color.surface} strokeWidth={2}
              opacity={hov === null || hov === i ? 1 : 0.3}
              style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
            />
          ))}
          {h ? (
            <>
              <text x={cx} y={cy - 4} textAnchor="middle" fontSize={18} fontWeight="bold" fill={theme.color.text} fontFamily={theme.font.serif}>{h.pct}%</text>
              <text x={cx} y={cx + 13} textAnchor="middle" fontSize={8} fill={theme.color.textMuted}>{h.name.split(' ')[0]}</text>
            </>
          ) : (
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fill={theme.color.textSubtle}>hover</text>
          )}
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          {data.map((row, i) => (
            <div key={row.name} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'default', borderBottom: `1px solid ${theme.color.border}` }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: ALLOC_COLORS[i % ALLOC_COLORS.length], flexShrink: 0, display: 'inline-block' }} />
              <span style={{ flex: 1, fontSize: 12, color: hov === i ? theme.color.text : theme.color.textMuted, fontWeight: hov === i ? 600 : 400, transition: 'color 0.1s', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
              <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: theme.color.text, flexShrink: 0 }}>{row.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Top Holdings with Weight Bars ──────────────────────────────────────────

function TopHoldings({ holdings }: { holdings: { name: string; pct: number }[] }) {
  if (holdings.length === 0) return null;
  const max = Math.max(...holdings.map(h => h.pct));
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.color.textSubtle, margin: '20px 0 12px' }}>
        Top {holdings.length} Holdings
      </div>
      {holdings.map((h, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${theme.color.border}` }}>
          <span style={{ width: 16, fontSize: 11, color: theme.color.textSubtle, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{i + 1}</span>
          <span style={{ flex: 1, fontSize: 12, color: theme.color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
          <div style={{ width: 64, height: 5, background: theme.color.surfaceMuted, borderRadius: 999, flexShrink: 0 }}>
            <div style={{ width: `${(h.pct / max) * 100}%`, height: '100%', background: theme.color.primary, borderRadius: 999, opacity: 0.65 }} />
          </div>
          <span style={{ width: 36, textAlign: 'right', fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: theme.color.text, flexShrink: 0 }}>{h.pct}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Portfolio Characteristics ──────────────────────────────────────────────

function PortfolioChars({ fund }: { fund: FundDef }) {
  const stats: { label: string; value: string; sub?: string }[] = [];
  if (fund.peRatio !== null)          stats.push({ label: 'P/E Ratio',      value: fund.peRatio.toFixed(1) });
  if (fund.pbRatio !== null)          stats.push({ label: 'P/B Ratio',      value: fund.pbRatio.toFixed(1) });
  stats.push({ label: 'Yield (TTM)',  value: `${fund.yield.toFixed(2)}%` });
  if (fund.medianMarketCapB !== null) stats.push({ label: 'Median Mkt Cap', value: `$${fund.medianMarketCapB.toFixed(1)}B` });
  if (fund.avgDuration !== null)      stats.push({ label: 'Avg Duration',   value: `${fund.avgDuration.toFixed(1)} yr` });
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 48px' }}>
      {stats.map(s => (
        <Metric key={s.label} label={s.label} value={s.value} sub={s.sub} />
      ))}
    </div>
  );
}

// Shared metric tile — label above a large serif value. Used by the
// Portfolio Characteristics strip and the Risk Profile figures.
function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.color.textSubtle, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: theme.color.text, fontFamily: theme.font.serif, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: theme.color.textSubtle, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Style Box ─────────────────────────────────────────────────────────────

const SB_LABEL_W = 40; // px allocated for row labels (Large/Mid/Small)
const SB_CELL    = 34; // px per cell
const SB_GAP     = 2;  // px between cells

function StyleBox({ box }: { box: NonNullable<FundDef['styleBox']> }) {
  const sizes  = ['Large', 'Mid', 'Small'] as const;
  const styles = ['Value', 'Blend', 'Growth'] as const;
  const gridW  = styles.length * (SB_CELL + SB_GAP) - SB_GAP; // total grid width without row labels

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.color.textSubtle, marginBottom: 12 }}>
        Style Box
      </div>

      {/* Column headers — aligned over the grid cells, not the row labels */}
      <div style={{ display: 'flex', paddingLeft: SB_LABEL_W, marginBottom: 4 }}>
        {styles.map(s => (
          <div key={s} style={{ width: SB_CELL + SB_GAP, textAlign: 'center', fontSize: 9, color: theme.color.textSubtle, letterSpacing: '0.02em' }}>
            {s}
          </div>
        ))}
      </div>

      {/* Grid rows */}
      {sizes.map(sz => (
        <div key={sz} style={{ display: 'flex', alignItems: 'center', marginBottom: SB_GAP }}>
          <div style={{ width: SB_LABEL_W, textAlign: 'right', paddingRight: 8, fontSize: 9, color: theme.color.textSubtle, flexShrink: 0 }}>
            {sz}
          </div>
          {styles.map(st => {
            const active = sz === box.size && st === box.style;
            return (
              <div key={st} style={{
                width: SB_CELL, height: SB_CELL,
                background: active ? theme.color.primary : theme.color.surfaceMuted,
                border: `1px solid ${active ? theme.color.primary : theme.color.border}`,
                borderRadius: 3,
                marginRight: SB_GAP,
                flexShrink: 0,
              }} />
            );
          })}
        </div>
      ))}

      {/* Label — indented to align under the grid, not the row labels */}
      <div style={{ paddingLeft: SB_LABEL_W, marginTop: 10, fontSize: 13, fontWeight: 600, color: theme.color.text }}>
        {box.size} {box.style}
      </div>
    </div>
  );
}

// ── Risk Meter ─────────────────────────────────────────────────────────────

const RISK_LEVELS = ['Low', 'Low–Medium', 'Medium', 'Medium–High', 'High'] as const;
const RISK_COLORS = ['#2F6B4F', '#7A9E48', '#C09030', '#C0622A', '#9A2B2B'];

function RiskMeter({ level }: { level: string }) {
  const idx = RISK_LEVELS.indexOf(level as typeof RISK_LEVELS[number]);
  const color = idx >= 0 ? RISK_COLORS[idx] : theme.color.primary;
  return (
    <div style={{ width: 280 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.color.textSubtle }}>Risk Level</span>
        <span style={{ color, fontWeight: 700, fontSize: 14, fontFamily: theme.font.serif }}>{level}</span>
      </div>
      <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
        {RISK_LEVELS.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i <= idx ? color : theme.color.border, opacity: i === idx ? 1 : i < idx ? 0.4 : 1 }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: theme.color.textSubtle }}>
        <span>Lower</span>
        <span>Higher</span>
      </div>
    </div>
  );
}

// ── Distribution Table ─────────────────────────────────────────────────────

function DistributionTable({ distributions, frequency }: { distributions: Distribution[]; frequency: string }) {
  const thStyle: React.CSSProperties = { padding: '6px 0', fontSize: 11, fontWeight: 600, color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em' };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...thStyle, textAlign: 'left'  }}>Ex-Date</th>
          <th style={{ ...thStyle, textAlign: 'left'  }}>Type</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Per Share</th>
        </tr>
      </thead>
      <tbody>
        {distributions.map((d, i) => (
          <tr key={i}>
            <td style={{ padding: '9px 0', borderBottom: `1px solid ${theme.color.border}`, fontSize: 13, color: theme.color.textMuted }}>
              {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </td>
            <td style={{ padding: '9px 0', borderBottom: `1px solid ${theme.color.border}`, fontSize: 13, color: theme.color.text }}>{d.type}</td>
            <td style={{ padding: '9px 0', borderBottom: `1px solid ${theme.color.border}`, textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: theme.color.text }}>
              ${d.amount.toFixed(3)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3} style={{ paddingTop: 8, fontSize: 10, color: theme.color.textSubtle }}>{frequency} distributions. Amounts per share.</td>
        </tr>
      </tfoot>
    </table>
  );
}

// ── Your Holdings — full-width white section, no card ─────────────────────

function YourHoldings({ ticker, fundName, currentPrice }: { ticker: string; fundName: string; currentPrice: number }) {
  const { activePersona } = useClientStore();
  const fundHoldings = activePersona.holdings.filter(h => h.ticker === ticker);
  if (fundHoldings.length === 0) return null;

  const accountTypeMap = new Map(activePersona.accounts.map(a => [a.id, a.type]));
  const priceToUse  = currentPrice > 0 ? currentPrice : (fundHoldings[0]?.price ?? 0);
  const totalShares = fundHoldings.reduce((sum, h) => sum + h.shares, 0);
  const totalValue  = fundHoldings.reduce((sum, h) => sum + h.shares * priceToUse, 0);

  const fundTxns = activePersona.transactions
    .filter(t => {
      const d = t.description.toLowerCase();
      return d.includes(ticker.toLowerCase()) || d.includes(fundName.toLowerCase());
    })
    .slice(0, 5);

  const thStyle: React.CSSProperties = { padding: '6px 0', fontSize: 11, fontWeight: 600, color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em' };
  const tdStyle: React.CSSProperties = { padding: '9px 0', borderBottom: `1px solid ${theme.color.border}`, fontSize: 13 };

  return (
    <div style={{ background: '#fff', borderBottom: `1px solid ${theme.color.border}` }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 48px 32px' }}>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.color.accent, borderBottom: `2px solid ${theme.color.accent}`, paddingBottom: 2, marginBottom: 20, display: 'inline-block' }}>
          Your Holdings
        </div>

        {/* Summary stats */}
        <div style={{ display: 'flex', gap: 40, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Value',   val: `$${fmt(totalValue)}` },
            { label: 'Shares',        val: fmt(totalShares) },
            ...(priceToUse > 0 ? [{ label: 'Current Price', val: `$${fmt(priceToUse)}` }] : []),
          ].map(({ label, val }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 600, fontFamily: theme.font.serif, fontVariantNumeric: 'tabular-nums', color: theme.color.text, letterSpacing: '-0.02em' }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Holdings by account */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: fundTxns.length > 0 ? 20 : 0 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left'  }}>Account</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Shares</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Price</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {fundHoldings.map((h, i) => (
              <tr key={i}>
                <td style={{ ...tdStyle, textAlign: 'left',  color: theme.color.text }}>{accountTypeMap.get(h.accountId) ?? h.accountId}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: theme.color.textMuted, fontVariantNumeric: 'tabular-nums' }}>{fmt(h.shares)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: theme.color.textMuted, fontVariantNumeric: 'tabular-nums' }}>${fmt(priceToUse)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: theme.color.text,     fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>${fmt(h.shares * priceToUse)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Recent transactions */}
        {fundTxns.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.color.textSubtle, marginBottom: 10 }}>Recent Transactions</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left'  }}>Date</th>
                  <th style={{ ...thStyle, textAlign: 'left'  }}>Description</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {fundTxns.map((t, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, textAlign: 'left', color: theme.color.textMuted, whiteSpace: 'nowrap' }}>
                      {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'left', color: theme.color.text }}>{t.description}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: t.amount >= 0 ? theme.color.success : theme.color.danger }}>
                      {t.amount >= 0 ? '+' : '-'}${fmt(Math.abs(t.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function FundProfilePage() {
  const { ticker } = useParams<{ ticker: string }>();
  const fundDef = FUND_BY_TICKER.get(ticker ?? '');
  const { fundQuote, loading } = useMarketData();

  if (!fundDef) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
        <Link to="/research" style={{ fontSize: 13, color: theme.color.textMuted, textDecoration: 'none' }}>← Back to Fund Research</Link>
        <p style={{ color: theme.color.textMuted, marginTop: 24 }}>Fund not found.</p>
      </div>
    );
  }

  const live: FundQuote | undefined = fundQuote(fundDef.ticker);
  const price      = live?.price        ?? 0;
  const dayChange  = live?.dayChange    ?? 0;
  const ytd        = live?.ytd          ?? 0;
  const oneYear    = live?.oneYear      ?? 0;
  const threeYear  = live?.threeYear    ?? 0;
  const fiveYear   = live?.fiveYear     ?? 0;
  const aum        = live?.totalAssets  ?? null;
  const inception  = live?.inceptionDate ?? null;
  const topH       = live?.topHoldings  ?? [];
  const expRatio   = live?.expenseRatio ?? fundDef.expenseRatio;
  const hasPrice   = price > 0;
  const today      = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ fontFamily: theme.font.sans }}>

      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(160deg, ${theme.color.primaryDeep} 0%, ${theme.color.primary} 100%)`,
        borderTop: `5px solid ${theme.color.accent}`,
        padding: '32px 48px 40px',
      }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>

          {/* Fund identity */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
              color: theme.color.accent, background: 'rgba(160,90,44,0.2)',
              padding: '4px 10px', borderRadius: theme.radius.sm, fontFamily: theme.font.mono,
            }}>{fundDef.ticker}</span>
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'rgba(251,249,244,0.6)',
              background: 'rgba(255,255,255,0.08)',
              padding: '4px 10px', borderRadius: theme.radius.sm,
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>{fundDef.category}</span>
          </div>

          <h1 style={{
            margin: '0 0 8px', fontSize: 40, fontWeight: 800,
            fontFamily: theme.font.serif, color: theme.color.textOnPrimary,
            letterSpacing: '-0.02em', lineHeight: 1.1,
          }}>
            {fundDef.name}
          </h1>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(251,249,244,0.6)', maxWidth: 600, lineHeight: 1.6 }}>
            {fundDef.longDescription}
          </p>

          {/* Price + Buy button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 16 }}>
            {hasPrice ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 44, fontWeight: 700, fontFamily: theme.font.serif, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', color: theme.color.textOnPrimary, lineHeight: 1 }}>
                  ${fmt(price)}
                </span>
                <span style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: pctColor(dayChange) }}>
                  {dayChange >= 0 ? '▲' : '▼'} {Math.abs(dayChange).toFixed(2)}% today
                </span>
                <span style={{ fontSize: 12, color: 'rgba(251,249,244,0.4)' }}>
                  as of {today}{loading && ' · updating…'}
                </span>
              </div>
            ) : (
              <div />
            )}
            <Link
              to={`/research/fund/${fundDef.ticker}/buy`}
              style={{
                display: 'inline-block', padding: '10px 24px',
                background: theme.color.accent, color: '#fff',
                borderRadius: theme.radius.md, textDecoration: 'none',
                fontSize: 14, fontWeight: 700, letterSpacing: '0.03em',
                flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              Buy {fundDef.ticker}
            </Link>
          </div>

          {/* Key stats strip */}
          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {[
              { label: 'Expense Ratio',       val: `${expRatio}%` },
              ...(aum      ? [{ label: 'Fund Assets',     val: fmtAum(aum) }] : []),
              { label: 'Distribution Yield',  val: `${fundDef.yield.toFixed(2)}%` },
              { label: 'Min. Investment',     val: `$${fundDef.minInvestment}` },
              ...(inception ? [{ label: 'Inception',     val: inception }] : []),
              { label: 'Holdings',            val: fundDef.numHoldings.toLocaleString() },
            ].map((s, i, arr) => (
              <div key={s.label} style={{
                paddingRight: 28, marginRight: 28, marginBottom: 8,
                borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none',
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(251,249,244,0.45)', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: theme.color.textOnPrimary, fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Your Holdings — white section, directly under masthead ─────── */}
      <YourHoldings ticker={fundDef.ticker} fundName={fundDef.name} currentPrice={price} />

      {/* ── Cards (beige background from App) ───────────────────────────── */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '32px 48px 56px' }}>

        {/* Performance */}
        <div style={{ ...card, marginBottom: 20 }}>
          <CardTitle>Performance</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.color.textMuted, marginBottom: 14 }}>Annual Returns — Calendar Year</div>
              <AnnualReturnsChart data={fundDef.annualReturns} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.color.textMuted, marginBottom: 14 }}>Returns vs. {fundDef.benchmark}</div>
              {hasPrice
                ? <PerformanceTable dayChange={dayChange} ytd={ytd} oneYear={oneYear} threeYear={threeYear} fiveYear={fiveYear} expRatio={expRatio} benchmark={fundDef.benchmark} />
                : <p style={{ fontSize: 13, color: theme.color.textSubtle }}>Loading…</p>}
            </div>
          </div>
        </div>

        {/* Portfolio Composition + Distribution History — side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div style={card}>
            <CardTitle>Portfolio Composition</CardTitle>
            <AllocationDonut data={fundDef.sectorAllocation} label={fundDef.allocationLabel} />
            <TopHoldings holdings={topH} />
          </div>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <CardTitle>Distribution History</CardTitle>
              <span style={{ fontSize: 13, color: theme.color.textMuted, marginBottom: 20, display: 'inline-block' }}>
                TTM Yield: <strong style={{ color: theme.color.text }}>{fundDef.yield.toFixed(2)}%</strong>
              </span>
            </div>
            <DistributionTable distributions={fundDef.distributions} frequency={fundDef.distributionFrequency} />
          </div>
        </div>

        {/* Portfolio Characteristics + Risk Profile — combined */}
        <div style={{ ...card, marginBottom: 20 }}>
          <CardTitle>Portfolio Characteristics</CardTitle>

          <div style={{ display: 'flex', gap: 40, alignItems: 'stretch' }}>
            {/* Left rail — metrics + risk */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <PortfolioChars fund={fundDef} />

              {/* ── Risk Profile ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '28px 0 18px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.color.textSubtle }}>Risk Profile</span>
                <div style={{ flex: 1, height: 1, background: theme.color.border }} />
              </div>

              <div style={{ display: 'flex', gap: '20px 48px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <RiskMeter level={fundDef.riskLevel} />
                {([
                  fundDef.beta        !== null && { label: 'Beta',          val: fundDef.beta.toFixed(2),                sub: 'vs. S&P 500'        },
                  fundDef.stdDev      !== null && { label: 'Std Deviation', val: `${fundDef.stdDev.toFixed(1)}%`,        sub: '3-yr annualized'    },
                  fundDef.avgDuration !== null && { label: 'Avg Duration',  val: `${fundDef.avgDuration.toFixed(1)} yr`, sub: 'interest rate risk' },
                ] as (false | { label: string; val: string; sub: string })[])
                  .filter((x): x is { label: string; val: string; sub: string } => x !== false)
                  .map(s => <Metric key={s.label} label={s.label} value={s.val} sub={s.sub} />)}
              </div>

              <p style={{ margin: '18px 0 0', maxWidth: 560, fontSize: 12, color: theme.color.textSubtle, lineHeight: 1.6 }}>
                Risk is assessed relative to the fund's asset class and investment universe.
                {fundDef.beta !== null && ' Beta measures sensitivity to broad market movements (S&P 500).'}
              </p>
            </div>

            {/* Right rail — style box, vertically centered against the left content */}
            {fundDef.styleBox && (
              <div style={{ flexShrink: 0, paddingLeft: 40, borderLeft: `1px solid ${theme.color.border}`, display: 'flex', alignItems: 'center' }}>
                <StyleBox box={fundDef.styleBox} />
              </div>
            )}
          </div>
        </div>

        {/* Fund Details + Fund Documents — side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          <div style={card}>
            <CardTitle>Fund Details</CardTitle>
            {[
              { label: 'Benchmark Index',        value: fundDef.benchmark },
              { label: 'Fund Category',          value: fundDef.category },
              { label: 'Expense Ratio',          value: `${expRatio}%` },
              { label: 'Minimum Investment',     value: `$${fundDef.minInvestment}` },
              { label: 'Distribution Frequency', value: fundDef.distributionFrequency },
              { label: 'Annual Turnover',        value: `~${fundDef.turnoverRate}%` },
              ...(aum       ? [{ label: 'Assets Under Mgmt', value: fmtAum(aum) }] : []),
              ...(inception ? [{ label: 'Inception Date',    value: inception }]    : []),
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0', borderBottom: `1px solid ${theme.color.border}` }}>
                <span style={{ fontSize: 12, color: theme.color.textSubtle, flexShrink: 0, marginRight: 12 }}>{item.label}</span>
                <span style={{ fontSize: 13, color: theme.color.text, fontWeight: 500, textAlign: 'right' }}>{item.value}</span>
              </div>
            ))}
          </div>

          <div style={card}>
            <CardTitle>Fund Documents</CardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Prospectus', 'Summary Prospectus', 'Annual Report', 'Semi-Annual Report', 'Statement of Additional Information'].map(doc => (
                <div key={doc} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: theme.radius.md,
                  border: `1px solid ${theme.color.border}`, background: theme.color.surfaceMuted,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.color.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span style={{ fontSize: 13, color: theme.color.text }}>{doc}</span>
                  </div>
                  <span style={{ fontSize: 10, color: theme.color.textSubtle, fontWeight: 600, letterSpacing: '0.04em' }}>PDF</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legal Disclosures */}
        <div style={{ paddingTop: 24, borderTop: `1px solid ${theme.color.border}` }}>
          <p style={{ margin: '0 0 8px', fontSize: 10, color: theme.color.textSubtle, lineHeight: 1.7 }}>
            Before investing, carefully consider the fund's investment objectives, risks, charges, and expenses. Read the prospectus or, if available, a summary prospectus carefully before you invest. Prospectuses and other fund documents are available through Bob's Mutual Funds, Inc.
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 10, color: theme.color.textSubtle, lineHeight: 1.7 }}>
            Performance data assumes reinvestment of dividends and capital gains distributions. Returns reflect total returns and do not account for taxes, which would reduce performance. Periods greater than one year reflect compound annual growth rates (annualized). Past performance is no guarantee of future results. All investing is subject to risk, including possible loss of the money you invest.
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 10, color: theme.color.textSubtle, lineHeight: 1.7 }}>
            The fund's benchmark index is provided for comparison purposes only. You cannot invest directly in an index, which does not reflect management fees, expenses, or transaction costs. Index benchmark returns are estimated by adding the fund's expense ratio to fund returns and are for illustrative purposes only.
          </p>
          <p style={{ margin: 0, fontSize: 10, color: theme.color.textSubtle, lineHeight: 1.7 }}>
            Beta and standard deviation are based on monthly returns over the trailing 3-year period. Beta is measured relative to the S&P 500 Index. The Style Box is for illustrative purposes and reflects a point-in-time snapshot of portfolio holdings. Bob's Mutual Funds, Inc. does not provide tax or legal advice; consult a qualified professional for guidance specific to your situation. © 2026 Bob's Mutual Funds, Inc. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  );
}
