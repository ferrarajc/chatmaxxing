import React from 'react';
import { Link } from 'react-router-dom';
import { useClientStore } from '../../../../store/clientStore';
import { useFunds } from '../../../../hooks/useFunds';
import { theme } from '../../../../theme';
import { SectionCard, LinkButton } from './ui';

export function WatchlistSection() {
  const watchlist = useClientStore(s => s.activePersona.watchlist) ?? [];
  const toggleWatchlist = useClientStore(s => s.toggleWatchlist);
  const { byTicker } = useFunds();

  return (
    <SectionCard
      title="Watchlist"
      subtitle="Funds you're keeping an eye on."
      headerRight={<Link to="/research" style={{ color: theme.color.primary, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Browse funds →</Link>}
      id="watchlist"
    >
      {watchlist.length === 0 && (
        <p style={{ fontSize: 13, color: theme.color.textMuted, fontStyle: 'italic', margin: 0 }}>
          Your watchlist is empty. Add funds from <Link to="/research" style={{ color: theme.color.primary }}>Research</Link> or any fund's page.
        </p>
      )}

      {watchlist.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${theme.color.border}` }}>
              <th style={{ textAlign: 'left', padding: '6px 0', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Fund</th>
              <th style={{ textAlign: 'left', padding: '6px 0', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Category</th>
              <th style={{ textAlign: 'right', padding: '6px 0', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Expense ratio</th>
              <th style={{ textAlign: 'right', padding: '6px 0', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Risk</th>
              <th style={{ width: 70 }} />
            </tr>
          </thead>
          <tbody>
            {watchlist.map(w => {
              const f = byTicker.get(w.ticker);
              return (
                <tr key={w.ticker} style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                  <td style={{ padding: '11px 0' }}>
                    <Link to={`/research/fund/${w.ticker}`} style={{ color: theme.color.text, textDecoration: 'none', fontWeight: 600 }}>
                      {f ? f.name : w.ticker}
                    </Link>
                    <span style={{ color: theme.color.textMuted, fontWeight: 400, marginLeft: 6 }}>{w.ticker}</span>
                  </td>
                  <td style={{ padding: '11px 0', color: theme.color.textMuted }}>{f ? f.category : '—'}</td>
                  <td style={{ padding: '11px 0', textAlign: 'right' }}>{f ? `${f.expenseRatio.toFixed(2)}%` : '—'}</td>
                  <td style={{ padding: '11px 0', textAlign: 'right', color: theme.color.textMuted }}>{f ? f.riskLevel : '—'}</td>
                  <td style={{ padding: '11px 0', textAlign: 'right' }}>
                    <button onClick={() => toggleWatchlist(w.ticker)} title="Remove from watchlist"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.color.accent, fontSize: 17, lineHeight: 1 }}>
                      ★
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}
