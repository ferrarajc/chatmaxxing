import { useEffect, useRef, useState } from 'react';
import { post } from '../api/client';
import { TransactionRow } from '../data/transactionStatus';

/**
 * Fetch the newest transactions for a client (optionally one account) from the
 * bobs-transactions table via /client-data. Falls back to the supplied static rows
 * on error so the recent tables still paint offline.
 */
export function useRecentTransactions(
  clientId: string,
  opts?: { accountId?: string; limit?: number; fallback?: TransactionRow[] },
): { rows: TransactionRow[]; loading: boolean } {
  const { accountId, limit = 8, fallback } = opts ?? {};
  const [rows, setRows] = useState<TransactionRow[]>(fallback ?? []);
  const [loading, setLoading] = useState(true);
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  useEffect(() => {
    let active = true;
    setLoading(true);
    post<{ transactions: TransactionRow[] }>('/client-data', {
      action: 'get-recent-transactions',
      clientId,
      data: { accountId, limit },
    })
      .then(res => { if (active) setRows(res.transactions ?? []); })
      .catch(() => { if (active) setRows(fallbackRef.current ?? []); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clientId, accountId, limit]);

  return { rows, loading };
}
