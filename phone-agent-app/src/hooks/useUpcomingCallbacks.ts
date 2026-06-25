import { useEffect, useState, useCallback, useRef } from 'react';
import { post } from '../api/client';
import type { CallbackListItem } from '../types';

// Polls the cockpit's `list` endpoint so countdowns tick, freshly-prepped dossiers flip to
// "ready", and completed calls drop off the board.
export function useUpcomingCallbacks(pollMs = 5000) {
  const [callbacks, setCallbacks] = useState<CallbackListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await post<{ callbacks: CallbackListItem[] }>('/agent-callbacks', { action: 'list' });
      if (mounted.current) setCallbacks(res.callbacks ?? []);
    } catch {
      /* keep last good list */
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const t = setInterval(refresh, pollMs);
    return () => { mounted.current = false; clearInterval(t); };
  }, [refresh, pollMs]);

  return { callbacks, loading, refresh };
}
