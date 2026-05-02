import React, { useState } from 'react';
import { useClientStore } from '../../../store/clientStore';
import { Beneficiary } from '../../../data/personas';

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '20px 24px',
  boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb', marginBottom: 20,
};

export function BeneficiariesPage() {
  const { activePersona, removeBeneficiary, updateBeneficiaries } = useClientStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Beneficiary>>({});
  const [saved, setSaved] = useState(false);

  const accounts = activePersona.accounts.map(a => ({
    id: a.id,
    type: a.type,
    beneficiaries: activePersona.beneficiaries.filter(b => b.accountId === a.id),
  }));

  const handleEdit = (b: Beneficiary) => {
    setEditingId(b.id);
    setEditForm({ name: b.name, relationship: b.relationship, percentage: b.percentage });
    setSaved(false);
  };

  const handleSave = (b: Beneficiary) => {
    const updated: Beneficiary = { ...b, ...editForm };
    const accountBeneficiaries = activePersona.beneficiaries
      .filter(x => x.accountId === b.accountId)
      .map(x => x.id === b.id ? updated : x);
    updateBeneficiaries(b.accountId, accountBeneficiaries);
    setEditingId(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <a href="/account" style={{ color: '#6b7280', fontSize: 13, textDecoration: 'none' }}>← Account</a>
      </div>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800 }}>Beneficiary Designations</h1>
      <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: 14 }}>
        Designations are legally binding and override your will. Review after major life events.
      </p>

      {saved && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 14, color: '#065f46' }}>
          Beneficiary updated successfully.
        </div>
      )}

      {accounts.map(account => (
        <div key={account.id} style={card}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>
            {account.type}
          </h2>

          {account.beneficiaries.length === 0 ? (
            <p style={{ color: '#ef4444', fontSize: 14 }}>No beneficiary on file — please add one.</p>
          ) : (
            account.beneficiaries.map(b => (
              <div key={b.id} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 14, marginBottom: 14 }}>
                {editingId === b.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <label style={{ fontSize: 13, color: '#374151' }}>
                        Name
                        <input
                          value={editForm.name ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                        />
                      </label>
                      <label style={{ fontSize: 13, color: '#374151' }}>
                        Relationship
                        <input
                          value={editForm.relationship ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, relationship: e.target.value }))}
                          style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                        />
                      </label>
                    </div>
                    <label style={{ fontSize: 13, color: '#374151', width: 120 }}>
                      Share (%)
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={editForm.percentage ?? 0}
                        onChange={e => setEditForm(f => ({ ...f, percentage: Number(e.target.value) }))}
                        style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        onClick={() => handleSave(b)}
                        style={{ background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{b.name}</div>
                      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                        {b.relationship} · {b.type} · {b.percentage}% · DOB {b.dob} · SSN {b.ssn}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleEdit(b)}
                        style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: '#374151' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeBeneficiary(b.id)}
                        style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: '#dc2626' }}
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
      ))}

      <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400e' }}>
        Changes are effective immediately. Keep designations up to date after marriage, divorce, birth, or death of a beneficiary.
      </div>
    </div>
  );
}
