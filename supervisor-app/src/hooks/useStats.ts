import { useEffect, useRef, useState } from 'react';
import { get } from '../api/client';
import { StatsPayload, WindowKey } from '../types';

const POLL_MS = 60_000;

export function useStats(windowKey: WindowKey, division: string | null) {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reqSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const seq = ++reqSeq.current;
    const load = async (initial: boolean) => {
      if (initial) setLoading(true);
      try {
        const q = `?window=${windowKey}${division ? `&division=${encodeURIComponent(division)}` : ''}`;
        const payload = await get<StatsPayload>(`/supervisor-stats${q}`);
        if (cancelled || seq !== reqSeq.current) return;
        if (payload.error) { setError(payload.error); setStats(null); }
        else { setStats(payload); setError(null); }
      } catch (e) {
        if (!cancelled && seq === reqSeq.current) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled && seq === reqSeq.current) setLoading(false);
      }
    };
    void load(true);
    const timer = setInterval(() => void load(false), POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [windowKey, division, nonce]);

  // Force an immediate refetch (keeps the current dashboard visible while it reloads).
  const refresh = () => setNonce(n => n + 1);

  return { stats, loading, error, refresh };
}
