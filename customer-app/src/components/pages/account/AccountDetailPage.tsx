import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useClientStore } from '../../../store/clientStore';
import { post } from '../../../api/client';

interface LiveBeneficiary {
  accountId: string;
  name: string;
  relationship: string;
  percentage: number;
  type: 'Primary' | 'Secondary';
}

function isRetirementAccount(type: string) {
  const t = type.toLowerCase();
  return t.includes('ira') || t.includes('sep');
}

const S = {
  card: {
    background: '#fff', borderRadius: 14, padding: 24,
    marginBottom: 24, boxShadow: '0 1px 6px rgba(0,0,0,.07)',
    border: '1px solid #e5e7eb',
  } as React.CSSProperties,
  th: { padding: '8px 0', color: '#6b7280', fontWeight: 600 } as React.CSSProperties,
  td: { padding: '10px 0', borderBottom: '1px solid #f3f4f6', textAlign: 'left' } as React.CSSProperties,
};

export function AccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const { activePersona } = useClientStore();

  const account = activePersona.accounts.find(a => a.id === accountId);
  const holdings  = activePersona.holdings.filter(h => h.accountId === accountId);
  const autoInvest = activePersona.autoInvest.filter(s => s.accountId === accountId);
  const transactions = activePersona.transactions.filter(t =>
    account && t.account === account.type,
  );

  const isIra = account ? isRetirementAccount(account.type) : false;
  const rmd = activePersona.rmd;
  const showRmd = isIra && rmd.eligible && rmd.accountId === accountId;

  const [liveBens, setLiveBens]   = useState<LiveBeneficiary[] | null>(null);
  const [bensLoading, setBensLoading] = useState(false);
  const [bensError, setBensError] = useState<string | null>(null);

  useEffect(() => {
    if (!isIra || !accountId) return;
    setBensLoading(true);
    setBensError(null);
    post<{ beneficiaries: LiveBeneficiary[] }>('/client-data', {
      action: 'get-beneficiaries',
      clientId: activePersona.clientId,
    })
      .then(res => setLiveBens(
        (res.beneficiaries ?? []).filter(b => b.accountId === accountId),
      ))
      .catch(e => setBensError(e.message))
      .finally(() => setBensLoading(false));
  }, [accountId, activePersona.clientId, isIra]);

  if (!account) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        <Link to="/portfolio" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>← Back to Portfolio</Link>
        <p style={{ marginTop: 24, color: '#6b7280' }}>Account not found.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

      {/* Back */}
      <Link to="/portfolio" style={{
        fontSize: 13, color: '#6b7280', textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20,
      }}>
        ← Back to Portfolio
      </Link>

      {/* Header */}
      <div style={{ ...S.card, padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace', marginBottom: 6 }}>{account.id}</div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>{account.type}</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 34, fontWeight: 800 }}>${account.balance.toLocaleString()}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: account.change >= 0 ? '#10b981' : '#ef4444' }}>
              {account.change >= 0 ? '▲' : '▼'} {Math.abs(account.change)}% today
            </div>
          </div>
        </div>
      </div>

      {/* Holdings */}
      {holdings.length > 0 && (
        <div style={S.card}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Holdings</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ ...S.th, textAlign: 'left' }}>Fund</th>
                <th style={{ ...S.th, textAlign: 'left' }}>Ticker</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Shares</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Price</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Value</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Change</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h, i) => (
                <tr key={i}>
                  <td style={{ ...S.td, fontWeight: 500 }}>{h.name}</td>
                  <td style={{ ...S.td, color: '#6b7280' }}>{h.ticker}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{h.shares.toFixed(1)}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>${h.price.toFixed(2)}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>${h.value.toLocaleString()}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: h.change >= 0 ? '#10b981' : '#ef4444' }}>
                    {h.change >= 0 ? '+' : ''}{h.change}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Beneficiaries — IRA/SEP only, loaded live from DynamoDB */}
      {isIra && (
        <div style={S.card}>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>Beneficiary Designations</h2>
            <Link to="/account/beneficiaries" style={{ fontSize: 13, color: '#1a56db', textDecoration: 'none', fontWeight: 500 }}>
              Manage →
            </Link>
          </div>

          {bensLoading && (
            <div style={{ fontSize: 13, color: '#6b7280' }}>Loading…</div>
          )}
          {bensError && (
            <div style={{ fontSize: 13, color: '#ef4444' }}>Could not load beneficiaries — {bensError}</div>
          )}
          {!bensLoading && liveBens !== null && (
            liveBens.length === 0 ? (
              <div style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic', padding: '8px 0' }}>
                No beneficiaries currently designated for this account.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ ...S.th, textAlign: 'left' }}>Name</th>
                    <th style={{ ...S.th, textAlign: 'left' }}>Relationship</th>
                    <th style={{ ...S.th, textAlign: 'right', paddingRight: 20 }}>Share</th>
                    <th style={{ ...S.th, textAlign: 'left' }}>Designation</th>
                  </tr>
                </thead>
                <tbody>
                  {liveBens.map((b, i) => (
                    <tr key={i}>
                      <td style={{ ...S.td, fontWeight: 500 }}>{b.name}</td>
                      <td style={{ ...S.td, color: '#6b7280' }}>{b.relationship}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, paddingRight: 20 }}>{b.percentage}%</td>
                      <td style={S.td}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 12,
                          background: b.type === 'Primary' ? '#eff6ff' : '#f0fdf4',
                          color:      b.type === 'Primary' ? '#1a56db' : '#059669',
                        }}>{b.type}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      )}

      {/* RMD summary — only for Maria's Traditional IRA */}
      {showRmd && (
        <div style={S.card}>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>Required Minimum Distribution (2025)</h2>
            <Link to="/account/rmd" style={{ fontSize: 13, color: '#1a56db', textDecoration: 'none', fontWeight: 500 }}>
              Full details →
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            {[
              { label: 'Required Amount', value: `$${rmd.annualRmd?.toLocaleString()}` },
              { label: 'Taken This Year', value: `$${rmd.takenThisYear?.toLocaleString()}` },
              { label: 'Remaining',       value: `$${rmd.remainingThisYear?.toLocaleString()}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
          {rmd.nextDeadline && (
            <div style={{ fontSize: 13, color: '#92400e', background: '#fffbeb', borderRadius: 8, padding: '8px 12px' }}>
              Deadline to take remaining ${rmd.remainingThisYear?.toLocaleString()}: <strong>{rmd.nextDeadline}</strong>
            </div>
          )}
        </div>
      )}

      {/* Auto-invest schedules */}
      {autoInvest.length > 0 && (
        <div style={S.card}>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>Auto-Invest Schedules</h2>
            <Link to="/account/auto-invest" style={{ fontSize: 13, color: '#1a56db', textDecoration: 'none', fontWeight: 500 }}>
              Manage →
            </Link>
          </div>
          {autoInvest.map(s => (
            <div key={s.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', borderBottom: '1px solid #f3f4f6',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.fund} <span style={{ color: '#6b7280', fontWeight: 400 }}>({s.ticker})</span></div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.frequency} · Next: {s.nextDate}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>${s.amount.toLocaleString()}</div>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 12, marginTop: 2, display: 'inline-block',
                  background: s.active ? '#f0fdf4' : '#f3f4f6',
                  color:      s.active ? '#059669' : '#6b7280',
                  fontWeight: 600,
                }}>
                  {s.active ? 'Active' : 'Paused'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <div style={S.card}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Recent Transactions</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ ...S.th, textAlign: 'left' }}>Date</th>
                <th style={{ ...S.th, textAlign: 'left' }}>Description</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => (
                <tr key={i}>
                  <td style={{ ...S.td, color: '#6b7280', whiteSpace: 'nowrap', paddingRight: 24 }}>{t.date}</td>
                  <td style={S.td}>{t.description}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: t.amount >= 0 ? '#10b981' : '#ef4444' }}>
                    {t.amount >= 0 ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
