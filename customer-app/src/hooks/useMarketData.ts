import { useState, useEffect, useRef } from 'react';
import { get } from '../api/client';

export interface IndexQuote {
  symbol: string;
  name: string;
  value: number;
  change: number;
}

export interface FundQuote {
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

export interface MarketData {
  indices: IndexQuote[];
  funds: FundQuote[];
  fetchedAt: number;
}

const STORAGE_KEY = 'bobs_market_data_v1';
const CACHE_TTL_MS = 20 * 60 * 1000;

function loadCache(): MarketData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as MarketData;
    if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

function saveCache(data: MarketData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export function useMarketData() {
  const [data, setData] = useState<MarketData | null>(loadCache);
  const [loading, setLoading] = useState(false);
  const fetching = useRef(false);

  useEffect(() => {
    if (fetching.current) return;
    const cached = loadCache();
    if (cached) { setData(cached); return; }
    fetching.current = true;
    setLoading(true);
    get<MarketData>('/market-data')
      .then(d => { saveCache(d); setData(d); })
      .catch(() => { /* keep static fallback data */ })
      .finally(() => setLoading(false));
  }, []);

  // Helper: get live quote for a given BobsFunds ticker
  function fundQuote(ticker: string): FundQuote | undefined {
    return data?.funds.find(f => f.ticker === ticker);
  }

  return { data, loading, fundQuote };
}
