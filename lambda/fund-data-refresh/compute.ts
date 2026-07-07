// ── Pure computations for the nightly fund-data refresh ─────────────────────
// Everything here is deterministic math over the arrays yahoo.ts returns — no
// I/O, no Date.now() — so it's directly unit-testable. Convention throughout:
// timestamps are epoch SECONDS in, epoch DAYS out (the compact ChartSeries unit).

import { createHash } from 'node:crypto';
import type { ChartSeries } from '../shared/fund-market-types';
import type { YahooEvent } from './yahoo';

const DAY_S = 86_400;

export const toEpochDay = (tsSec: number): number => Math.floor(tsSec / DAY_S);
export const dayToISO = (day: number): string => new Date(day * DAY_S * 1000).toISOString().slice(0, 10);
const yearOfDay = (day: number): number => new Date(day * DAY_S * 1000).getUTCFullYear();
const monthKey = (day: number): number => {
  const d = new Date(day * DAY_S * 1000);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
};

const pct2 = (n: number): number => Math.round(n * 10000) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

/** Index of the last point with day <= target (binary search); -1 if none. */
function idxAtOrBefore(days: number[], target: number): number {
  let lo = 0, hi = days.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (days[mid] <= target) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}

export interface TrailingReturns {
  ytd: number;
  oneYear: number | null;
  threeYear: number | null;
  fiveYear: number | null;
  tenYear: number | null;
  sinceInception: number;
}

/**
 * Trailing total returns from adjusted closes. Multi-year windows are annualized;
 * null when the fund is younger than the window. YTD baseline = last close of the
 * prior year (or the first point for funds incepted this year).
 */
export function computeTrailingReturns(days: number[], adj: number[]): TrailingReturns {
  const last = days.length - 1;
  const endPrice = adj[last];
  const endDay = days[last];
  const spanDays = endDay - days[0];

  const simple = (baseIdx: number): number => pct2(endPrice / adj[baseIdx] - 1);
  const annualized = (years: number): number | null => {
    const baseIdx = idxAtOrBefore(days, endDay - Math.round(years * 365.25));
    // Require true window coverage: the fund must be at least `years` old.
    if (baseIdx < 0 || spanDays < years * 365.25 - 10) return null;
    return pct2(Math.pow(endPrice / adj[baseIdx], 1 / years) - 1);
  };

  // YTD: last close strictly before Jan 1 of the end-date's year.
  const jan1Day = Math.floor(Date.UTC(yearOfDay(endDay), 0, 1) / (DAY_S * 1000));
  const ytdIdx = idxAtOrBefore(days, jan1Day - 1);
  const ytd = simple(ytdIdx >= 0 ? ytdIdx : 0);

  const sinceInception = spanDays >= 360
    ? pct2(Math.pow(endPrice / adj[0], 365.25 / spanDays) - 1)
    : simple(0);

  // 1-year is conventionally a simple (not annualized) return.
  const oneYearIdx = idxAtOrBefore(days, endDay - 365);
  const oneYear = oneYearIdx >= 0 && spanDays >= 355 ? simple(oneYearIdx) : null;

  return {
    ytd,
    oneYear,
    threeYear: annualized(3),
    fiveYear: annualized(5),
    tenYear: annualized(10),
    sinceInception,
  };
}

/**
 * Calendar-year total returns, newest first. A year is included only when BOTH
 * its own and the prior year's final closes exist — which cleanly drops the
 * partial inception year and the current in-progress year.
 */
export function computeAnnualReturns(days: number[], adj: number[]): { year: number; pct: number }[] {
  const lastCloseOfYear = new Map<number, number>();
  for (let i = 0; i < days.length; i++) lastCloseOfYear.set(yearOfDay(days[i]), adj[i]);

  const currentYear = yearOfDay(days[days.length - 1]);
  const out: { year: number; pct: number }[] = [];
  for (let y = currentYear - 1; y >= yearOfDay(days[0]); y--) {
    const end = lastCloseOfYear.get(y);
    const base = lastCloseOfYear.get(y - 1);
    if (end == null || base == null) continue;
    out.push({ year: y, pct: pct2(end / base - 1) });
  }
  return out;
}

/** Last point of each bucket (bucket key fn) over an optional trailing window. */
function lastPerBucket(days: number[], close: number[], fromDay: number, bucket: (day: number) => number): ChartSeries {
  const t: number[] = [];
  const c: number[] = [];
  for (let i = 0; i < days.length; i++) {
    if (days[i] < fromDay) continue;
    const isLastOfBucket = i === days.length - 1 || bucket(days[i + 1]) !== bucket(days[i]);
    if (isLastOfBucket) { t.push(days[i]); c.push(round4(close[i])); }
  }
  return { t, c };
}

/** The three page-chart granularities, all from RAW closes (share price). */
export function downsample(days: number[], close: number[]): { daily1Y: ChartSeries; weekly5Y: ChartSeries; monthlyMax: ChartSeries } {
  const endDay = days[days.length - 1];
  const daily1Y: ChartSeries = { t: [], c: [] };
  for (let i = 0; i < days.length; i++) {
    if (days[i] >= endDay - 366) { daily1Y.t.push(days[i]); daily1Y.c.push(round4(close[i])); }
  }
  return {
    daily1Y,
    // Epoch day 0 = Thu 1970-01-01; +3 makes buckets run Mon→Sun.
    weekly5Y: lastPerBucket(days, close, endDay - Math.round(5 * 365.25), d => Math.floor((d + 3) / 7)),
    monthlyMax: lastPerBucket(days, close, 0, monthKey),
  };
}

export interface YearChunk { t: number[]; c: number[]; hash: string; }

/** Raw daily closes chunked by calendar year, content-hashed for write-if-changed. */
export function chunkByYear(days: number[], close: number[]): Map<number, YearChunk> {
  const chunks = new Map<number, { t: number[]; c: number[] }>();
  for (let i = 0; i < days.length; i++) {
    const y = yearOfDay(days[i]);
    let ch = chunks.get(y);
    if (!ch) { ch = { t: [], c: [] }; chunks.set(y, ch); }
    ch.t.push(days[i]);
    ch.c.push(round4(close[i]));
  }
  const out = new Map<number, YearChunk>();
  for (const [y, ch] of chunks) out.set(y, { ...ch, hash: hashOf(ch) });
  return out;
}

export function hashOf(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

/** % change of the final close vs the prior close. NEVER meta.chartPreviousClose —
 *  on range=max that's the close before the range start (inception-era garbage). */
export function computeDayChange(close: number[]): number {
  if (close.length < 2) return 0;
  const prev = close[close.length - 2];
  return prev > 0 ? pct2(close[close.length - 1] / prev - 1) : 0;
}

/** Trailing-12-month distribution yield % from real dividend events. */
export function computeYieldTtm(dividends: YahooEvent[], price: number, endDay: number): number | null {
  if (price <= 0) return null;
  const cutoff = (endDay - 365) * DAY_S;
  const ttm = dividends.filter(d => d.date >= cutoff).reduce((s, d) => s + d.amount, 0);
  return ttm > 0 ? pct2(ttm / price) : null;
}

/** Month-end adjusted closes → simple monthly returns for the trailing `months`. */
export function monthlyReturns(days: number[], adj: number[], months: number): number[] {
  const monthly = lastPerBucket(days, adj, 0, monthKey);
  const closes = monthly.c.slice(-(months + 1));
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) out.push(closes[i] / closes[i - 1] - 1);
  return out;
}

/** 3-year annualized standard deviation % from 36 monthly returns. */
export function computeStdDev(monthly: number[]): number | null {
  if (monthly.length < 30) return null;
  const mean = monthly.reduce((s, r) => s + r, 0) / monthly.length;
  const variance = monthly.reduce((s, r) => s + (r - mean) ** 2, 0) / (monthly.length - 1);
  return pct2(Math.sqrt(variance) * Math.sqrt(12));
}

/** Beta vs the index over aligned trailing monthly returns. */
export function computeBeta(fund: number[], index: number[]): number | null {
  const n = Math.min(fund.length, index.length);
  if (n < 30) return null;
  const f = fund.slice(-n), x = index.slice(-n);
  const mf = f.reduce((s, r) => s + r, 0) / n;
  const mx = x.reduce((s, r) => s + r, 0) / n;
  let cov = 0, varx = 0;
  for (let i = 0; i < n; i++) { cov += (f[i] - mf) * (x[i] - mx); varx += (x[i] - mx) ** 2; }
  if (varx === 0) return null;
  return Math.round((cov / varx) * 100) / 100;
}

// Yahoo sectorWeightings keys → the display labels the AllocationDonut already uses.
const SECTOR_LABELS: Record<string, string> = {
  technology: 'Information Technology',
  financial_services: 'Financials',
  healthcare: 'Healthcare',
  consumer_cyclical: 'Consumer Discretionary',
  consumer_defensive: 'Consumer Staples',
  communication_services: 'Communication Services',
  industrials: 'Industrials',
  energy: 'Energy',
  basic_materials: 'Materials',
  utilities: 'Utilities',
  realestate: 'Real Estate',
};

/**
 * Yahoo sector weights → AllocationSlice[] (top 6 + Other). Returns null when the
 * weights cover <50% of the fund (bond funds) so the UI keeps its static donut.
 */
export function mapSectorWeightings(weights: Record<string, number>): { name: string; pct: number }[] | null {
  const slices = Object.entries(weights)
    .map(([key, w]) => ({ name: SECTOR_LABELS[key] ?? key, pct: w }))
    .filter(s => s.pct > 0.0005)
    .sort((a, b) => b.pct - a.pct);
  const total = slices.reduce((s, x) => s + x.pct, 0);
  if (total < 0.5) return null;

  const top = slices.slice(0, 6).map(s => ({ name: s.name, pct: Math.round(s.pct * 1000) / 10 }));
  const other = Math.round((total - slices.slice(0, 6).reduce((s, x) => s + x.pct, 0)) * 1000) / 10;
  if (other > 0.1) top.push({ name: 'Other', pct: other });
  return top;
}

/** Merge real dividend + capital-gain events → the page's distribution rows (newest first). */
export function mapDistributions(
  dividends: YahooEvent[],
  capitalGains: YahooEvent[],
  keep = 8,
): { date: string; type: 'Dividend' | 'Capital Gain'; amount: number }[] {
  const all = [
    ...dividends.map(e => ({ date: dayToISO(toEpochDay(e.date)), type: 'Dividend' as const, amount: round4(e.amount) })),
    ...capitalGains.map(e => ({ date: dayToISO(toEpochDay(e.date)), type: 'Capital Gain' as const, amount: round4(e.amount) })),
  ];
  return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, keep);
}
