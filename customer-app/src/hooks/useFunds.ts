import { useState, useEffect, useRef } from 'react';
import { get } from '../api/client';
import { FUNDS as BUNDLED_FUNDS, FundDef } from '../data/funds';

// Fund catalog hook. The runtime source of truth is the bobs-funds DynamoDB table, served by
// GET /funds (module-cached server-side). We cache the response in localStorage (fund data
// changes < once/day) and fall back to the bundled funds.ts copy so pages always render —
// offline, on a cold/empty table, or on any fetch error. Same shape as useMarketData.
const STORAGE_KEY = 'bobs_funds_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface FundsCache {
  funds: FundDef[];
  fetchedAt: number;
}

function loadCache(): FundDef[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as FundsCache;
    if (!cached.funds?.length) return null;
    if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
    return cached.funds;
  } catch {
    return null;
  }
}

function saveCache(funds: FundDef[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ funds, fetchedAt: Date.now() } as FundsCache));
  } catch { /* ignore */ }
}

/**
 * Returns the fund catalog. Initial value is the fresh localStorage cache if present, else the
 * bundled funds.ts catalog — so consumers always have all funds immediately, then get refreshed
 * from the API. `byTicker` is a convenience lookup map.
 */
export function useFunds(): { funds: FundDef[]; byTicker: Map<string, FundDef>; loading: boolean } {
  const [funds, setFunds] = useState<FundDef[]>(() => loadCache() ?? BUNDLED_FUNDS);
  const [loading, setLoading] = useState(false);
  const fetching = useRef(false);

  useEffect(() => {
    if (fetching.current) return;
    if (loadCache()) return; // fresh cache already in state
    fetching.current = true;
    setLoading(true);
    get<{ funds: FundDef[] }>('/funds')
      .then(d => {
        if (d.funds?.length) { saveCache(d.funds); setFunds(d.funds); }
      })
      .catch(() => { /* keep bundled fallback */ })
      .finally(() => setLoading(false));
  }, []);

  const byTicker = new Map(funds.map(f => [f.ticker, f]));
  return { funds, byTicker, loading };
}
