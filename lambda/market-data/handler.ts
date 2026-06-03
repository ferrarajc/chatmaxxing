import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

// ── Types ──────────────────────────────────────────────────────────────────

interface IndexQuote {
  symbol: string;
  name: string;
  value: number;
  change: number;
}

interface FundData {
  ticker: string;
  realSymbol: string;
  price: number;
  dayChange: number;
  ytd: number;
  oneYear: number;
  threeYear: number;
  fiveYear: number;
  weekHigh52: number;
  weekLow52: number;
  totalAssets: number | null;
  expenseRatio: number;
  inceptionDate: string | null;
  topHoldings: { name: string; pct: number }[];
}

interface MarketDataPayload {
  indices: IndexQuote[];
  funds: FundData[];
  fetchedAt: number;
}

// ── Config ─────────────────────────────────────────────────────────────────

const FUND_MAP = [
  { ticker: 'BF500',  realSymbol: 'VOO',  expenseRatio: 0.03 },
  { ticker: 'BFGR',  realSymbol: 'VUG',  expenseRatio: 0.04 },
  { ticker: 'BFBI',  realSymbol: 'BND',  expenseRatio: 0.03 },
  { ticker: 'BFIN',  realSymbol: 'VXUS', expenseRatio: 0.07 },
  { ticker: 'BFESG', realSymbol: 'ESGV', expenseRatio: 0.09 },
  { ticker: 'BFST',  realSymbol: 'VGSH', expenseRatio: 0.04 },
] as const;

const INDEX_MAP = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^DJI',  name: 'Dow Jones' },
  { symbol: '^IXIC', name: 'NASDAQ' },
] as const;

// ── Module-level cache (survives warm invocations) ─────────────────────────

let cache: { data: MarketDataPayload; expiresAt: number } | null = null;
const CACHE_TTL_MS = 20 * 60 * 1000;

// ── Yahoo Finance helpers ──────────────────────────────────────────────────

const YF_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

type YfMeta = Record<string, unknown>;

interface YfChartResult {
  meta: YfMeta;
  timestamp: number[];
  indicators: {
    quote: [{ close: (number | null)[]; }];
    adjclose?: [{ adjclose: (number | null)[] }];
  };
}

async function fetchChart(symbol: string, interval: string, range: string): Promise<YfChartResult> {
  const enc = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${enc}?interval=${interval}&range=${range}`;
  const res = await fetch(url, { headers: YF_HEADERS });
  if (!res.ok) throw new Error(`YF chart ${symbol}: HTTP ${res.status}`);
  const json = await res.json() as { chart: { result: YfChartResult[] | null } };
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No chart data for ${symbol}`);
  return result;
}

async function fetchSummary(symbol: string): Promise<Record<string, unknown> | null> {
  try {
    const enc = encodeURIComponent(symbol);
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${enc}?modules=defaultKeyStatistics,topHoldings`;
    const res = await fetch(url, { headers: YF_HEADERS });
    if (!res.ok) return null;
    const json = await res.json() as { quoteSummary: { result: Record<string, unknown>[] | null } };
    return json?.quoteSummary?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

// ── Return calculations ────────────────────────────────────────────────────

function pctRound(n: number): number {
  return Math.round(n * 10000) / 100;
}

interface Returns { ytd: number; oneYear: number; threeYear: number; fiveYear: number; }

function calcReturns(timestamps: number[], closes: (number | null)[], currentPrice: number): Returns {
  const pairs: { ts: number; price: number }[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const p = closes[i];
    if (p != null && !isNaN(p) && p > 0) pairs.push({ ts: timestamps[i], price: p });
  }
  if (pairs.length === 0) return { ytd: 0, oneYear: 0, threeYear: 0, fiveYear: 0 };

  const nowMs = Date.now();

  function priceAt(targetMs: number): number | null {
    let best: { ts: number; price: number } | null = null;
    let bestDiff = Infinity;
    for (const pair of pairs) {
      const diff = Math.abs(pair.ts * 1000 - targetMs);
      if (diff < bestDiff) { bestDiff = diff; best = pair; }
    }
    return best ? best.price : null;
  }

  const jan1Ms = new Date(new Date().getFullYear(), 0, 1).getTime();
  let ytdBase: number | null = null;
  for (let i = pairs.length - 1; i >= 0; i--) {
    if (pairs[i].ts * 1000 < jan1Ms) { ytdBase = pairs[i].price; break; }
  }

  const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;
  const p1y = priceAt(nowMs - 12 * MONTH_MS);
  const p3y = priceAt(nowMs - 36 * MONTH_MS);
  const p5y = priceAt(nowMs - 60 * MONTH_MS);

  return {
    ytd:       ytdBase ? pctRound((currentPrice - ytdBase) / ytdBase) : 0,
    oneYear:   p1y     ? pctRound((currentPrice - p1y) / p1y)         : 0,
    threeYear: p3y     ? pctRound(Math.pow(currentPrice / p3y, 1 / 3) - 1) : 0,
    fiveYear:  p5y     ? pctRound(Math.pow(currentPrice / p5y, 1 / 5) - 1) : 0,
  };
}

// ── Per-fund and per-index fetch ───────────────────────────────────────────

async function fetchFundData(ticker: string, realSymbol: string, expenseRatio: number): Promise<FundData> {
  const [chart, dayChart, summary] = await Promise.all([
    fetchChart(realSymbol, '1mo', '5y'),
    fetchChart(realSymbol, '1d', '1d').catch(() => null),  // for accurate day change only
    fetchSummary(realSymbol),
  ]);

  const meta = chart.meta as Record<string, number>;
  const price      = (meta.regularMarketPrice ?? 0) as number;
  const weekHigh52 = (meta.fiftyTwoWeekHigh ?? 0) as number;
  const weekLow52  = (meta.fiftyTwoWeekLow  ?? 0) as number;

  // 1d/1d chart: chartPreviousClose is unambiguously yesterday's close
  const dayChange = (() => {
    if (!dayChart) return 0;
    const dm = dayChart.meta as Record<string, number>;
    const prev = (dm.chartPreviousClose ?? dm.regularMarketPreviousClose ?? 0) as number;
    return prev > 0 ? pctRound((price - prev) / prev) : 0;
  })();

  const closes = chart.indicators?.adjclose?.[0]?.adjclose ?? chart.indicators?.quote?.[0]?.close ?? [];
  const returns = calcReturns(chart.timestamp ?? [], closes, price);

  let totalAssets: number | null = null;
  let inceptionDate: string | null = null;
  const topHoldings: { name: string; pct: number }[] = [];

  if (summary) {
    const stats = (summary.defaultKeyStatistics ?? {}) as Record<string, { raw?: number }>;
    totalAssets = stats.totalAssets?.raw ?? null;
    const inceptRaw = stats.fundInceptionDate?.raw;
    if (inceptRaw) {
      inceptionDate = new Date(inceptRaw * 1000).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    }

    const rawHoldings = ((summary.topHoldings as Record<string, unknown>)?.holdings ?? []) as Record<string, unknown>[];
    for (const h of rawHoldings.slice(0, 10)) {
      topHoldings.push({
        name: (h.holdingName ?? h.name ?? 'Unknown') as string,
        pct:  Math.round(((h.holdingPercent as { raw?: number })?.raw ?? 0) * 10000) / 100,
      });
    }
  }

  return { ticker, realSymbol, price, dayChange, ...returns, weekHigh52, weekLow52, totalAssets, expenseRatio, inceptionDate, topHoldings };
}

async function fetchIndexQuote(symbol: string, name: string): Promise<IndexQuote> {
  const chart = await fetchChart(symbol, '1d', '1d');
  const meta  = chart.meta as Record<string, number>;
  const price = (meta.regularMarketPrice ?? 0) as number;
  const prev  = (meta.chartPreviousClose ?? meta.regularMarketPreviousClose ?? price) as number;
  return { symbol, name, value: price, change: prev > 0 ? pctRound((price - prev) / prev) : 0 };
}

// ── Handler ────────────────────────────────────────────────────────────────

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

export const handler = async (_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  if (cache && cache.expiresAt > Date.now()) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify(cache.data) };
  }

  try {
    const [indicesResults, fundsResults] = await Promise.all([
      Promise.allSettled(INDEX_MAP.map(i => fetchIndexQuote(i.symbol, i.name))),
      Promise.allSettled(FUND_MAP.map(f => fetchFundData(f.ticker, f.realSymbol, f.expenseRatio))),
    ]);

    const indices: IndexQuote[] = indicesResults.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { symbol: INDEX_MAP[i].symbol, name: INDEX_MAP[i].name, value: 0, change: 0 }
    );

    const funds: FundData[] = fundsResults.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      console.warn(`market-data: ${FUND_MAP[i].realSymbol} failed:`, (r as PromiseRejectedResult).reason);
      return {
        ticker: FUND_MAP[i].ticker, realSymbol: FUND_MAP[i].realSymbol,
        price: 0, dayChange: 0, ytd: 0, oneYear: 0, threeYear: 0, fiveYear: 0,
        weekHigh52: 0, weekLow52: 0, totalAssets: null,
        expenseRatio: FUND_MAP[i].expenseRatio, inceptionDate: null, topHoldings: [],
      };
    });

    const data: MarketDataPayload = { indices, funds, fetchedAt: Date.now() };
    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
  } catch (err) {
    console.error('market-data error', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to fetch market data' }) };
  }
};
