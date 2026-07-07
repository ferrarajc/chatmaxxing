import { useState, useEffect } from 'react';
import { get } from '../api/client';
import type { FundMarketData, FundMarketSummary } from '../data/fundMarket';

// ── Real fund market data (nightly cache) ────────────────────────────────────
// Read path, fastest first:
//   1. Static JSON published nightly to this site's own origin
//      ({BASE_URL}fund-data/{TICKER}.json — gh-pages in prod, public/ in local dev
//      after `npm run fund-data`). Same-origin + CDN ⇒ effectively instant.
//   2. GET /fund-market?ticker= — the live API over the same DynamoDB data
//      (covers a fund added before the next nightly publish).
//   3. null — callers fall back to today's behavior (useMarketData + static
//      catalog values), so a missing cache can never break a page.
//
// Payloads are cached in a module-level Map (NOT localStorage: 36 × ~20KB would
// crowd the 5MB quota already shared with bobs_market_data_v1/bobs_funds_v1;
// repeat visits are covered by HTTP caching on the static file).

const fundCache = new Map<string, FundMarketData | null>();
const inflight = new Map<string, Promise<FundMarketData | null>>();

const fileUrl = (name: string): string => `${import.meta.env.BASE_URL}fund-data/${name}.json`;

async function fetchStaticJson<T extends { schemaVersion?: number }>(name: string): Promise<T | null> {
  try {
    const res = await fetch(fileUrl(name));
    if (!res.ok) return null;
    const json = await res.json() as T;
    // The vite dev server answers unknown paths with index.html (SPA fallback) —
    // res.json() usually throws on it, but be explicit that this is our schema.
    if (!json || json.schemaVersion !== 1) return null;
    return json;
  } catch {
    return null;
  }
}

async function loadFundMarket(ticker: string): Promise<FundMarketData | null> {
  const cached = fundCache.get(ticker);
  if (cached !== undefined) return cached;
  let pending = inflight.get(ticker);
  if (!pending) {
    pending = (async () => {
      const fromFile = await fetchStaticJson<FundMarketData>(ticker);
      if (fromFile && fromFile.ticker === ticker) return fromFile;
      try {
        return await get<FundMarketData>(`/fund-market?ticker=${encodeURIComponent(ticker)}`);
      } catch {
        return null;
      }
    })();
    inflight.set(ticker, pending);
    pending.then(data => { fundCache.set(ticker, data); inflight.delete(ticker); });
  }
  return pending;
}

/** Real market payload for one fund, or null while loading / when unavailable. */
export function useFundMarket(ticker: string): FundMarketData | null {
  const [data, setData] = useState<FundMarketData | null>(() => fundCache.get(ticker) ?? null);
  useEffect(() => {
    if (!ticker) return;
    let alive = true;
    loadFundMarket(ticker).then(d => { if (alive) setData(d); });
    return () => { alive = false; };
  }, [ticker]);
  return data;
}

// ── Lineup-wide summary (Research table, Buy page) ───────────────────────────

let summaryCache: FundMarketSummary | null | undefined;
let summaryInflight: Promise<FundMarketSummary | null> | null = null;

async function loadSummary(): Promise<FundMarketSummary | null> {
  if (summaryCache !== undefined) return summaryCache;
  if (!summaryInflight) {
    summaryInflight = (async () => {
      const fromFile = await fetchStaticJson<FundMarketSummary>('summary');
      if (fromFile?.funds?.length) return fromFile;
      try {
        return await get<FundMarketSummary>('/fund-market?summary=1');
      } catch {
        return null;
      }
    })();
    summaryInflight.then(data => { summaryCache = data; summaryInflight = null; });
  }
  return summaryInflight;
}

/** The nightly lineup summary, or null while loading / when unavailable. */
export function useFundMarketSummary(): FundMarketSummary | null {
  const [data, setData] = useState<FundMarketSummary | null>(() => summaryCache ?? null);
  useEffect(() => {
    let alive = true;
    loadSummary().then(d => { if (alive) setData(d); });
    return () => { alive = false; };
  }, []);
  return data;
}
