import React, { useEffect, useState } from 'react';
import { useClientStore } from '../../../store/clientStore';
import { post } from '../../../api/client';
import { theme } from '../../../theme';

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

const card: React.CSSProperties = {
  background: theme.color.surface,
  borderRadius: theme.radius.lg,
  padding: '20px 24px',
  boxShadow: theme.shadow.sm,
  border: `1px solid ${theme.color.border}`,
  marginBottom: 20,
};

export function BeneficiariesPage() {
  const { activePersona } = useClientStore();
  const [liveBens, setLiveBens] = useState<LiveBeneficiary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<LiveBeneficiary>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    post<{ beneficiaries: LiveBeneficiary[] }>('/client-data', {
      action: 'get-beneficiaries',
      clientId: activePersona.clientId,
    })
      .then(res => setLiveBens(res.beneficiaries ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [activePersona.clientId]);

  const writeBens = (updated: LiveBeneficiary[]) =>
    post('/client-data', {
      action: 'put-beneficiaries',
      clientId: activePersona.clientId,
      data: updated,
    });

  const iraAccounts = activePersona.accounts.filter(a => isRetirementAccount(a.type));

  const benKey = (b: LiveBeneficiary) => `${b.accountId}:${b.name}`;

  const handleEdit = (b: LiveBeneficiary) => {
    setEditingKey(benKey(b));
    setEditForm({ name: b.name, relationship: b.relationship, percentage: b.percentage });
    setSaved(false);
  };

  const handleSave = async (b: LiveBeneficiary) => {
    const updated = liveBens.map(x => x === b ? { ...x, ...editForm } : x);
    await writeBens(updated);
    setLiveBens(updated);
    setEditingKey(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleRemove = async (b: LiveBeneficiary) => {
    const updated = liveBens.filter(x => x !== b);
    await writeBens(updated);
    setLiveBens(updated);
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <div style={{ marginBottom: 8 }}>
        <a href="/account" style={{ color: theme.color.textMuted, fontSize: 13, textDecoration: 'none' }}>← Account</a>
      </div>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Beneficiary Designations</h1>
      <p style={{ margin: '0 0 28px', color: theme.color.textMuted, fontSize: 14 }}>
        Designations are legally binding and override your will. Review after major life events.
      </p>

      {saved && (
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 14, color: theme.color.success }}>
          Beneficiary updated successfully.
        </div>
      )}

      {loading && <div style={{ color: theme.color.textMuted, fontSize: 14, marginBottom: 20 }}>Loading…</div>}
      {error && <div style={{ color: theme.color.danger, fontSize: 14, marginBottom: 20 }}>Could not load beneficiaries — {error}</div>}

      {!loading && iraAccounts.map(account => {
        const accountBens = liveBens.filter(b => b.accountId === account.id);
        return (
          <div key={account.id} style={card}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: theme.color.primary, fontFamily: theme.font.serif }}>
              {account.type}
            </h2>

            {accountBens.length === 0 ? (
              <p style={{ color: theme.color.danger, fontSize: 14 }}>No beneficiary on file — please add one.</p>
            ) : (
              accountBens.map(b => (
                <div key={benKey(b)} style={{ borderBottom: `1px solid ${theme.color.border}`, paddingBottom: 14, marginBottom: 14 }}>
                  {editingKey === benKey(b) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label style={{ fontSize: 13, color: theme.color.text }}>
                          Name
                          <input
                            value={editForm.name ?? ''}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                            style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md, fontSize: 14 }}
                          />
                        </label>
                        <label style={{ fontSize: 13, color: theme.color.text }}>
                          Relationship
                          <input
                            value={editForm.relationship ?? ''}
                            onChange={e => setEditForm(f => ({ ...f, relationship: e.target.value }))}
                            style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md, fontSize: 14 }}
                          />
                        </label>
                      </div>
                      <label style={{ fontSize: 13, color: theme.color.text, width: 120 }}>
                        Share (%)
                        <input
                          type="number" min={1} max={100}
                          value={editForm.percentage ?? 0}
                          onChange={e => setEditForm(f => ({ ...f, percentage: Number(e.target.value) }))}
                          style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md, fontSize: 14 }}
                        />
                      </label>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                          onClick={() => handleSave(b)}
                          style={{ background: theme.color.primary, color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          style={{ background: theme.color.surfaceMuted, color: theme.color.text, border: 'none', borderRadius: theme.radius.md, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{b.name}</div>
                        <div style={{ fontSize: 13, color: theme.color.textMuted, marginTop: 2 }}>
                          {b.relationship} ·{' '}
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 12,
                            background: b.type === 'Primary' ? theme.color.primarySoft : theme.color.successSoft,
                            color:      b.type === 'Primary' ? theme.color.primary : theme.color.success,
                          }}>{b.type}</span>
                          {' '}· {b.percentage}%
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleEdit(b)}
                          style={{ background: 'none', border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: theme.color.text }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemove(b)}
                          style={{ background: 'none', border: `1px solid ${theme.color.dangerSoft}`, borderRadius: theme.radius.md, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: theme.color.danger }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        );
      })}

      <div style={{ background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: theme.color.warning }}>
        Changes are effective immediately. Keep designations up to date after marriage, divorce, birth, or death of a beneficiary.
      </div>
    </div>
  );
}
