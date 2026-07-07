import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { theme } from '../../../theme';
import type { FundMarketData } from '../../../data/fundMarket';

// ── Price history chart (real data, nightly cache) ──────────────────────────
// Single-series share-price area chart with range pills. Renders inside the
// page's Performance-style card; the parent renders nothing when the market
// payload is absent, so this is purely additive to the existing page.
// One series ⇒ no legend (the card title names it); horizontal-only grid;
// labels/ticks in text tokens; identity carried by the brand-navy line.

type RangeKey = '1M' | '6M' | 'YTD' | '1Y' | '5Y' | 'MAX';
const RANGES: RangeKey[] = ['1M', '6M', 'YTD', '1Y', '5Y', 'MAX'];

const DAY_MS = 86_400_000;

interface Point { d: number; p: number; }   // d = epoch day, p = price

function toPoints(t: number[], c: number[], fromDay: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < t.length; i++) if (t[i] >= fromDay) pts.push({ d: t[i], p: c[i] });
  return pts;
}

function selectRange(chart: FundMarketData['chart'], range: RangeKey): Point[] {
  const daily = chart.daily1Y;
  const endDay = daily.t.length ? daily.t[daily.t.length - 1] : 0;
  switch (range) {
    case '1M':  return toPoints(daily.t, daily.c, endDay - 31);
    case '6M':  return toPoints(daily.t, daily.c, endDay - 183);
    case 'YTD': {
      const jan1 = Math.floor(Date.UTC(new Date(endDay * DAY_MS).getUTCFullYear(), 0, 1) / DAY_MS);
      return toPoints(daily.t, daily.c, jan1);
    }
    case '1Y':  return toPoints(daily.t, daily.c, 0);
    case '5Y':  return toPoints(chart.weekly5Y.t, chart.weekly5Y.c, 0);
    case 'MAX': return toPoints(chart.monthlyMax.t, chart.monthlyMax.c, 0);
  }
}

function fmtTick(day: number, range: RangeKey): string {
  const date = new Date(day * DAY_MS);
  const opts: Intl.DateTimeFormatOptions =
    range === '1M' || range === '6M' ? { month: 'short', day: 'numeric', timeZone: 'UTC' } :
    range === 'YTD' || range === '1Y' ? { month: 'short', timeZone: 'UTC' } :
    range === '5Y' ? { month: 'short', year: '2-digit', timeZone: 'UTC' } :
    { year: 'numeric', timeZone: 'UTC' };
  return date.toLocaleDateString('en-US', opts);
}

function fmtFull(day: number): string {
  return new Date(day * DAY_MS).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  return (
    <div style={{
      background: theme.color.surface, border: `1px solid ${theme.color.border}`,
      borderRadius: theme.radius.md, boxShadow: theme.shadow.sm, padding: '8px 12px',
    }}>
      <div style={{ fontSize: 11, color: theme.color.textMuted, marginBottom: 2 }}>{fmtFull(pt.d)}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: theme.color.text, fontVariantNumeric: 'tabular-nums' }}>
        ${pt.p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}

export function PriceHistoryChart({ chart }: { chart: FundMarketData['chart'] }) {
  const [range, setRange] = useState<RangeKey>('1Y');
  const points = useMemo(() => selectRange(chart, range), [chart, range]);

  if (points.length < 2) return null;

  const first = points[0].p;
  const lastPt = points[points.length - 1];
  const changePct = first > 0 ? ((lastPt.p - first) / first) * 100 : 0;
  const pos = changePct >= 0;
  const changeColor = pos ? theme.color.success : theme.color.danger;

  const prices = points.map(pt => pt.p);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = (max - min) * 0.08 || max * 0.02;
  const domainMin = Math.max(0, min - pad);   // price axes never go negative

  return (
    <div>
      {/* Header row: period change + range pills */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: theme.color.textMuted }}>
          {range === 'MAX' ? 'Since inception' : range === 'YTD' ? 'Year to date' : `Past ${range.replace('M', ' month').replace('Y', ' year')}${range[0] !== '1' ? 's' : ''}`}:{' '}
          <strong style={{ color: changeColor, fontVariantNumeric: 'tabular-nums' }}>
            {pos ? '+' : ''}{changePct.toFixed(changePct >= 100 ? 0 : 2)}%
          </strong>
          <span style={{ color: theme.color.textSubtle, fontSize: 11, marginLeft: 8 }}>share price</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map(r => {
            const active = r === range;
            return (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  borderRadius: theme.radius.pill, border: '1px solid',
                  borderColor: active ? theme.color.primary : theme.color.border,
                  background: active ? theme.color.primary : 'transparent',
                  color: active ? theme.color.textOnPrimary : theme.color.textMuted,
                  fontFamily: theme.font.sans, transition: 'all .12s',
                }}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="phFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.color.primary} stopOpacity={0.18} />
                <stop offset="100%" stopColor={theme.color.primary} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={theme.color.border} strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="d"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="linear"
              tickFormatter={(d: number) => fmtTick(d, range)}
              tickCount={6}
              tick={{ fontSize: 11, fill: theme.color.textSubtle }}
              tickLine={false}
              axisLine={{ stroke: theme.color.border }}
              minTickGap={36}
            />
            <YAxis
              domain={[domainMin, max + pad]}
              tickFormatter={(v: number) => `$${v >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(0)}`}
              tick={{ fontSize: 11, fill: theme.color.textSubtle }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: theme.color.textSubtle, strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="p"
              stroke={theme.color.primary}
              strokeWidth={2}
              fill="url(#phFill)"
              dot={false}
              activeDot={{ r: 4, fill: theme.color.primary, stroke: theme.color.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
