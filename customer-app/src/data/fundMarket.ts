// ── Fund market-data contract ────────────────────────────────────────────────
// The shape of the REAL market data mirrored nightly from each fund's Vanguard
// proxy (FundDef.realSymbol) into the bobs-fund-market table and exported as
// static JSON to GitHub Pages (/fund-data/{TICKER}.json). Pure types, no React —
// the backend reaches this file through lambda/shared/fund-market-types.ts, the
// same bridge pattern as funds.ts / fund-catalog.ts. Keep it types-only.
//
// Producers: lambda/fund-data-refresh (writes), lambda/fund-market (serves),
//            scripts/fund-data/export.mjs (publishes files).
// Consumers: customer-app hooks/useFundMarket.ts → FundProfilePage, ResearchPage,
//            BuyPage.

/** Compact time series: parallel arrays, t[i] = UTC epoch DAYS (ms = t * 86_400_000). */
export interface ChartSeries {
  t: number[];
  /** Close price (raw close, not adjusted — this is the share-price chart). */
  c: number[];
}

export interface FundMarketData {
  schemaVersion: 1;
  ticker: string;
  realSymbol: string;
  /** Last trading day present in the data, 'YYYY-MM-DD'. */
  asOf: string;
  /** Epoch ms of the refresh run that produced this payload. */
  generatedAt: number;

  // ── Quote ──────────────────────────────────────────────────────────────────
  price: number;
  /** % change, last close vs prior close. */
  dayChange: number;
  weekHigh52: number;
  weekLow52: number;

  // ── Trailing total returns (from adjusted closes; % — 3y/5y/10y/inception
  //    annualized; null = fund younger than the window) ───────────────────────
  ytd: number;
  oneYear: number | null;
  threeYear: number | null;
  fiveYear: number | null;
  tenYear: number | null;
  sinceInception: number;

  // ── Profile (quoteSummary-derived; null = unavailable → UI falls back to the
  //    static catalog value) ──────────────────────────────────────────────────
  totalAssets: number | null;
  /** Real inception date of the realSymbol ETF, 'YYYY-MM-DD'. */
  inceptionDate: string | null;
  /** Trailing-12-month distribution yield %, computed from real dividend events. */
  yieldTtm: number | null;
  /** 3-year beta vs the S&P 500, computed from monthly total returns. */
  beta3Y: number | null;
  /** 3-year annualized standard deviation %, from monthly total returns. */
  stdDev3Y: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  /** Bond funds: average effective duration in years. */
  avgDuration: number | null;
  topHoldings: { name: string; symbol?: string; pct: number }[];
  /** AllocationSlice-compatible; null (e.g. bond funds) → UI keeps the static donut. */
  sectorAllocation: { name: string; pct: number }[] | null;

  // ── History ────────────────────────────────────────────────────────────────
  /** Every FULL calendar year since inception, newest first (total return %). */
  annualReturns: { year: number; pct: number }[];
  /** Most recent real distribution events, newest first. */
  distributions: { date: string; type: 'Dividend' | 'Capital Gain'; amount: number }[];
  chart: {
    /** Daily closes, last ~12 months. */
    daily1Y: ChartSeries;
    /** Weekly closes, last ~5 years. */
    weekly5Y: ChartSeries;
    /** Month-end closes since inception. */
    monthlyMax: ChartSeries;
  };
}

/** Lineup-wide slice for list pages (Research table, Buy page) — fund-data/summary.json. */
export interface FundMarketSummary {
  schemaVersion: 1;
  generatedAt: number;
  indices: { symbol: string; name: string; value: number; change: number }[];
  funds: {
    ticker: string;
    realSymbol: string;
    price: number;
    dayChange: number;
    ytd: number;
    oneYear: number | null;
    threeYear: number | null;
    fiveYear: number | null;
    expenseRatio: number;
  }[];
}

/** Refresh-run status (`_status`/`latest` item; served by GET /fund-market?status=1). */
export interface FundRefreshStatus {
  state: 'running' | 'ok' | 'partial' | 'error';
  runId: string;
  trigger: 'scheduled' | 'manual';
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  fundsOk?: number;
  fundsFailed?: { ticker: string; error: string }[];
  /** True when the crumb handshake failed — chart-derived fields still refreshed,
   *  quoteSummary-derived profile fields carried over unchanged. */
  quoteSummaryDegraded?: boolean;
  generatedAt?: number;
}
