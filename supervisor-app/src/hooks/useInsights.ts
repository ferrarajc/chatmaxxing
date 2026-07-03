import { useCallback, useEffect, useRef, useState } from 'react';
import { get } from '../api/client';
import { InsightsPayload, WindowKey } from '../types';

/**
 * AI insights load AFTER the numbers (statsReady) so the dashboard never waits on the
 * LLM; any failure degrades to null and the panel shows a quiet unavailable state.
 */
export function useInsights(windowKey: WindowKey, division: string | null, statsReady: boolean) {
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const reqSeq = useRef(0);

  const load = useCallback(async (refresh: boolean) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    if (refresh) setInsights(null);
    try {
      const q = `?window=${windowKey}${division ? `&division=${encodeURIComponent(division)}` : ''}&view=insights${refresh ? '&refresh=1' : ''}`;
      const payload = await get<InsightsPayload>(`/supervisor-stats${q}`);
      if (seq === reqSeq.current) setInsights(payload);
    } catch {
      if (seq === reqSeq.current) setInsights(null);
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [windowKey, division]);

  useEffect(() => {
    if (!statsReady) return;
    setInsights(null);
    void load(false);
  }, [statsReady, load]);

  return { insights, loading, refresh: () => void load(true) };
}
