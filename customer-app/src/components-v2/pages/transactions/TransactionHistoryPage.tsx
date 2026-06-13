import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useClientStore } from '../../../store/clientStore';
import { post } from '../../../api/client';
import { StatusCell } from '../../common/StatusCell';
import { TransactionRow, ALL_STATUSES } from '../../../data/transactionStatus';
import { theme } from '../../../theme';

const PAGE_SIZE = 25;

const selectStyle: React.CSSProperties = {
  appearance: 'none', WebkitAppearance: 'none',
  background: theme.color.surface, color: theme.color.text,
  border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md,
  padding: '8px 30px 8px 12px', fontSize: 13, fontFamily: theme.font.sans,
  cursor: 'pointer',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B645A' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
};

const th: React.CSSProperties = {
  padding: '10px 0', color: theme.color.textMuted, fontWeight: 600,
  fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
};
const td: React.CSSProperties = { padding: '11px 0', borderBottom: `1px solid ${theme.color.border}` };

export function TransactionHistoryPage() {
  const { activePersona } = useClientStore();
  const clientId = activePersona.clientId;
  const accounts = activePersona.accounts;

  const [searchParams, setSearchParams] = useSearchParams();
  const accountId = searchParams.get('account') ?? 'all';

  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [amountSort, setAmountSort] = useState<'none' | 'asc' | 'desc'>('none');

  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPage = useCallback(async (reset: boolean, nextCursor?: string) => {
    const myReq = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await post<{ transactions: TransactionRow[]; cursor: string | null }>('/client-data', {
        action: 'get-transactions-page',
        clientId,
        data: {
          accountId: accountId === 'all' ? undefined : accountId,
          status: status === 'all' ? undefined : status,
          search: debouncedSearch.trim() || undefined,
          sort,
          limit: PAGE_SIZE,
          cursor: reset ? undefined : nextCursor,
        },
      });
      if (myReq !== reqId.current) return; // a newer request superseded this one
      setRows(prev => (reset ? res.transactions : [...prev, ...res.transactions]));
      setCursor(res.cursor);
    } catch (e) {
      if (myReq !== reqId.current) return;
      setError(e instanceof Error ? e.message : 'Could not load transactions.');
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
  }, [clientId, accountId, status, debouncedSearch, sort]);

  // Reload first page whenever a filter/sort changes
  useEffect(() => { fetchPage(true); }, [fetchPage]);

  const setAccount = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'all') next.delete('account'); else next.set('account', id);
    setSearchParams(next, { replace: true });
  };

  // Amount sort is applied client-side over the rows loaded so far.
  const displayRows = useMemo(() => {
    if (amountSort === 'none') return rows;
    const copy = [...rows];
    copy.sort((a, b) => amountSort === 'asc' ? a.amount - b.amount : b.amount - a.amount);
    return copy;
  }, [rows, amountSort]);

  const toggleDateSort = () => {
    setAmountSort('none');
    setSort(s => (s === 'newest' ? 'oldest' : 'newest'));
  };
  const toggleAmountSort = () => {
    setAmountSort(s => (s === 'desc' ? 'asc' : 'desc'));
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <Link to="/portfolio" style={{
        fontSize: 13, color: theme.color.textMuted, textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20,
      }}>
        ← Back to Portfolio
      </Link>

      <h1 style={{ margin: '0 0 24px', fontSize: 32, fontWeight: 600, color: theme.color.text, fontFamily: theme.font.serif, letterSpacing: '-0.02em' }}>
        Transaction History
      </h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <select aria-label="Account" value={accountId} onChange={e => setAccount(e.target.value)} style={selectStyle}>
          <option value="all">All accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.type}</option>)}
        </select>
        <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
          <option value="all">All statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          aria-label="Search descriptions"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search descriptions…"
          style={{
            flex: '1 1 220px', minWidth: 180,
            background: theme.color.surface, color: theme.color.text,
            border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md,
            padding: '8px 12px', fontSize: 13, fontFamily: theme.font.sans,
          }}
        />
      </div>

      {/* Table */}
      <div style={{ background: theme.color.surface, borderRadius: theme.radius.lg, padding: '8px 24px 20px', boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${theme.color.borderStrong}` }}>
              <th style={{ ...th, textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={toggleDateSort}>
                Date {sort === 'newest' ? '↓' : '↑'}
              </th>
              <th style={{ ...th, textAlign: 'left' }}>Description</th>
              <th style={{ ...th, textAlign: 'left' }}>Account</th>
              <th style={{ ...th, textAlign: 'left' }}>Status</th>
              <th style={{ ...th, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={toggleAmountSort}>
                Amount {amountSort === 'none' ? '' : amountSort === 'desc' ? '↓' : '↑'}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((t, i) => (
              <tr key={t.txnId ?? i}>
                <td style={{ ...td, color: theme.color.textMuted, whiteSpace: 'nowrap', paddingRight: 16 }}>{t.date}</td>
                <td style={{ ...td, color: theme.color.text }}>{t.description}</td>
                <td style={{ ...td, color: theme.color.textMuted }}>{t.account}</td>
                <td style={td}><StatusCell status={t.status} /></td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: t.amount > 0 ? theme.color.success : t.amount < 0 ? theme.color.danger : theme.color.textMuted }}>
                  {t.amount > 0 ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* States */}
        {!loading && !error && displayRows.length === 0 && (
          <div style={{ padding: '28px 0', textAlign: 'center', color: theme.color.textMuted, fontSize: 14 }}>
            No transactions match your filters.
          </div>
        )}
        {error && (
          <div style={{ padding: '20px 0', textAlign: 'center', color: theme.color.danger, fontSize: 14 }}>
            {error} <button onClick={() => fetchPage(true)} style={{ marginLeft: 8, color: theme.color.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Retry</button>
          </div>
        )}
        {loading && (
          <div style={{ padding: '20px 0', textAlign: 'center', color: theme.color.textMuted, fontSize: 13 }}>Loading…</div>
        )}

        {amountSort !== 'none' && cursor && (
          <div style={{ padding: '8px 0 0', fontSize: 11.5, color: theme.color.textSubtle, fontStyle: 'italic' }}>
            Amount sort applies to the {displayRows.length} loaded transactions. Load more to sort the full history.
          </div>
        )}

        {cursor && !loading && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              onClick={() => fetchPage(false, cursor)}
              style={{
                background: theme.color.surface, color: theme.color.primary,
                border: `1px solid ${theme.color.primarySoftBorder}`, borderRadius: theme.radius.pill,
                padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
