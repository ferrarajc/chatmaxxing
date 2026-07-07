// ── Yahoo Finance client for the nightly fund-data refresh ───────────────────
// Two endpoints:
//   • v8 chart (no auth): daily close + adjclose back to inception, plus real
//     dividend / capital-gain events.
//   • v10 quoteSummary (needs the crumb+cookie handshake): holdings, sector
//     weightings, portfolio characteristics, AUM, inception.
// The crumb is fetched ONCE per refresh run and reused for all funds. A failed
// handshake degrades gracefully (quoteSummary-derived fields carry over from the
// previous run) — it never fails the refresh.

const YF_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

export interface YahooAuth { cookie: string; crumb: string; }

/** One event as Yahoo reports it: epoch-seconds date + per-share amount. */
export interface YahooEvent { amount: number; date: number; }

export interface ChartData {
  /** Epoch seconds, ascending, nulls-filtered in lockstep with the price arrays. */
  timestamps: number[];
  /** Raw close (split-adjusted by Yahoo, NOT dividend-adjusted) — the share price. */
  close: number[];
  /** Adjusted close (split + dividend) — total-return basis. */
  adjclose: number[];
  meta: Record<string, unknown>;
  dividends: YahooEvent[];
  capitalGains: YahooEvent[];
}

/**
 * Crumb handshake: fc.yahoo.com sets the session cookie (via a 404/redirect —
 * hence redirect:'manual'), then v1/test/getcrumb exchanges it for the crumb
 * that quoteSummary requires. Returns null on any failure (degraded mode).
 */
export async function getYahooCrumb(): Promise<YahooAuth | null> {
  try {
    const res = await fetch('https://fc.yahoo.com', { headers: YF_HEADERS, redirect: 'manual' });
    const setCookies = res.headers.getSetCookie?.() ?? [];
    const cookie = setCookies.map(c => c.split(';')[0]).filter(Boolean).join('; ');
    if (!cookie) return null;

    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...YF_HEADERS, Cookie: cookie },
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.includes('<')) return null;   // HTML error page, not a crumb
    return { cookie, crumb };
  } catch {
    return null;
  }
}

interface YfChartResult {
  meta: Record<string, unknown>;
  timestamp?: number[];
  indicators?: {
    quote?: [{ close?: (number | null)[] }];
    adjclose?: [{ adjclose?: (number | null)[] }];
  };
  events?: {
    dividends?: Record<string, YahooEvent>;
    capitalGains?: Record<string, YahooEvent>;
  };
}

/**
 * Full daily history back to inception, with distribution events.
 * `interval` is parameterized only for the index fetches (1d quotes / 10y history).
 * NOTE: `range=max` silently coerces granularity to monthly, so the max fetch
 * must use explicit period1=0&period2=now — that returns true daily bars back
 * to the first trading day (verified: VOO → ~4,000 points, granularity '1d').
 */
export async function fetchChart(symbol: string, interval = '1d', range = 'max'): Promise<ChartData> {
  const enc = encodeURIComponent(symbol);
  const events = encodeURIComponent('div|capitalGain|split');
  const window = range === 'max'
    ? `period1=0&period2=${Math.floor(Date.now() / 1000)}`
    : `range=${range}`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${enc}?interval=${interval}&${window}&events=${events}`;
  const res = await fetch(url, { headers: YF_HEADERS });
  if (!res.ok) throw new Error(`YF chart ${symbol}: HTTP ${res.status}`);
  const json = await res.json() as { chart: { result: YfChartResult[] | null; error?: { description?: string } | null } };
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`YF chart ${symbol}: ${json?.chart?.error?.description ?? 'no data'}`);

  const ts = result.timestamp ?? [];
  const rawClose = result.indicators?.quote?.[0]?.close ?? [];
  const rawAdj = result.indicators?.adjclose?.[0]?.adjclose ?? [];

  // Filter half-day/holiday nulls in lockstep so all three arrays stay aligned.
  const timestamps: number[] = [];
  const close: number[] = [];
  const adjclose: number[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = rawClose[i];
    if (c == null || !isFinite(c) || c <= 0) continue;
    const a = rawAdj[i];
    timestamps.push(ts[i]);
    close.push(c);
    adjclose.push(a != null && isFinite(a) && a > 0 ? a : c);
  }

  const toEvents = (rec?: Record<string, YahooEvent>): YahooEvent[] =>
    Object.values(rec ?? {})
      .filter(e => e && isFinite(e.amount) && e.amount > 0 && isFinite(e.date))
      .sort((a, b) => a.date - b.date);

  return {
    timestamps, close, adjclose,
    meta: result.meta ?? {},
    dividends: toEvents(result.events?.dividends),
    capitalGains: toEvents(result.events?.capitalGains),
  };
}

export interface QuoteSummaryData {
  totalAssets: number | null;
  inceptionDate: string | null;          // 'YYYY-MM-DD'
  beta3Y: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  avgDuration: number | null;
  topHoldings: { name: string; symbol?: string; pct: number }[];
  /** Yahoo key → weight (0..1), e.g. { technology: 0.32, ... } */
  sectorWeights: Record<string, number>;
}

type Raw = { raw?: number } | undefined;
const rawNum = (v: Raw): number | null => (v?.raw != null && isFinite(v.raw) ? v.raw : null);

// Yahoo reports fund P/E and P/B as RECIPROCALS (e.g. VOO priceToEarnings.raw =
// 0.0369 = 1/27.1) and as 0 for bond funds. Normalize to the conventional ratio;
// no real fund P/E or P/B in this lineup is < 1, so the inversion guard is safe.
const ratio = (v: Raw): number | null => {
  const r = rawNum(v);
  if (r == null || r <= 0) return null;
  return Math.round((r < 1 ? 1 / r : r) * 10) / 10;
};

/**
 * quoteSummary (crumb-authenticated). Returns null on any failure — never
 * throws. Yahoo intermittently 429s the first burst of concurrent calls, so
 * failures retry twice with a pause (the nightly run is latency-insensitive);
 * a fund that still fails just carries last night's profile fields forward.
 */
export async function fetchQuoteSummary(symbol: string, auth: YahooAuth): Promise<QuoteSummaryData | null> {
  try {
    const enc = encodeURIComponent(symbol);
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${enc}` +
      `?modules=defaultKeyStatistics,topHoldings&crumb=${encodeURIComponent(auth.crumb)}`;
    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
      res = await fetch(url, { headers: { ...YF_HEADERS, Cookie: auth.cookie } });
      if (res.ok) break;
    }
    if (!res || !res.ok) return null;
    const json = await res.json() as { quoteSummary?: { result?: Record<string, unknown>[] | null } };
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return null;

    const stats = (result.defaultKeyStatistics ?? {}) as Record<string, unknown>;
    const th = (result.topHoldings ?? {}) as Record<string, unknown>;

    const inceptRaw = rawNum(stats.fundInceptionDate as Raw);
    const equity = (th.equityHoldings ?? {}) as Record<string, Raw>;
    const bond = (th.bondHoldings ?? {}) as Record<string, Raw>;

    const topHoldings = (((th.holdings ?? []) as Record<string, unknown>[])
      .slice(0, 10)
      .map(h => ({
        name: String(h.holdingName ?? h.symbol ?? 'Unknown'),
        symbol: typeof h.symbol === 'string' ? h.symbol : undefined,
        pct: Math.round((rawNum(h.holdingPercent as Raw) ?? 0) * 10000) / 100,
      }))
      .filter(h => h.pct > 0));

    // sectorWeightings is an array of single-key objects: [{ realestate: {raw: .02} }, ...]
    const sectorWeights: Record<string, number> = {};
    for (const entry of (th.sectorWeightings ?? []) as Record<string, Raw>[]) {
      for (const [key, val] of Object.entries(entry)) {
        const w = rawNum(val);
        if (w != null && w > 0) sectorWeights[key] = w;
      }
    }

    return {
      totalAssets: rawNum(stats.totalAssets as Raw),
      inceptionDate: inceptRaw ? new Date(inceptRaw * 1000).toISOString().slice(0, 10) : null,
      beta3Y: rawNum(stats.beta3Year as Raw),
      peRatio: ratio(equity.priceToEarnings),
      pbRatio: ratio(equity.priceToBook),
      avgDuration: rawNum(bond.duration),
      topHoldings,
      sectorWeights,
    };
  } catch {
    return null;
  }
}

/** Small concurrency pool — keeps the run inside Yahoo's comfort zone without deps. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
