import React, { useState } from 'react';
import { useClientStore } from '../../../store/clientStore';
import { AutoInvestSchedule } from '../../../data/personas';

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '20px 24px',
  boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb', marginBottom: 20,
};

const FUNDS = [
  { name: 'BobsFunds 500 Index', ticker: 'BF500' },
  { name: 'BobsFunds Growth', ticker: 'BFGR' },
  { name: 'BobsFunds Bond Income', ticker: 'BFBI' },
  { name: 'BobsFunds ESG Leaders', ticker: 'BFESG' },
  { name: 'BobsFunds International', ticker: 'BFIN' },
  { name: 'BobsFunds Short-Term Treas.', ticker: 'BFST' },
];

export function AutoInvestPage() {
  const { activePersona, updateAutoInvestSchedule, setAutoInvestSchedules } = useClientStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AutoInvestSchedule>>({});
  const [saved, setSaved] = useState(false);

  const schedules = activePersona.autoInvest;

  const handleEdit = (s: AutoInvestSchedule) => {
    setEditingId(s.id);
    setEditForm({ amount: s.amount, frequency: s.frequency, dayOfMonth: s.dayOfMonth });
    setSaved(false);
  };

  const handleSave = (s: AutoInvestSchedule) => {
    updateAutoInvestSchedule(s.id, editForm);
    setEditingId(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleToggle = (s: AutoInvestSchedule) => {
    updateAutoInvestSchedule(s.id, { active: !s.active });
  };

  const totalMonthly = schedules
    .filter(s => s.active && s.frequency === 'Monthly')
    .reduce((sum, s) => sum + s.amount, 0);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <a href="/account" style={{ color: '#6b7280', fontSize: 13, textDecoration: 'none' }}>← Account</a>
      </div>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800 }}>Automatic Investments</h1>
      <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: 14 }}>
        Recurring contributions help build wealth consistently. IRA contributions count toward annual limits.
      </p>

      {saved && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 14, color: '#065f46' }}>
          Auto-invest schedule updated.
        </div>
      )}

      {totalMonthly > 0 && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#1e40af' }}>
          Total active monthly contributions: <strong>${totalMonthly.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
        </div>
      )}

      {schedules.length === 0 ? (
        <div style={card}>
          <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', padding: '12px 0' }}>
            No automatic investment schedules set up. Contact us or use the app to create one.
          </p>
        </div>
      ) : (
        schedules.map(s => (
          <div key={s.id} style={{ ...card, opacity: s.active ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{s.fund} ({s.ticker})</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{s.accountType}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  background: s.active ? '#d1fae5' : '#f3f4f6',
                  color: s.active ? '#065f46' : '#6b7280',
                  fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                }}>
                  {s.active ? 'Active' : 'Paused'}
                </span>
              </div>
            </div>

            {editingId === s.id ? (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <label style={{ fontSize: 13, color: '#374151' }}>
                    Amount ($)
                    <input
                      type="number"
                      min={50}
                      value={editForm.amount ?? 0}
                      onChange={e => setEditForm(f => ({ ...f, amount: Number(e.target.value) }))}
                      style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                    />
                  </label>
                  <label style={{ fontSize: 13, color: '#374151' }}>
                    Frequency
                    <select
                      value={editForm.frequency ?? 'Monthly'}
                      onChange={e => setEditForm(f => ({ ...f, frequency: e.target.value as AutoInvestSchedule['frequency'] }))}
                      style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                    >
                      <option>Monthly</option>
                      <option>Bi-weekly</option>
                      <option>Quarterly</option>
                    </select>
                  </label>
                  {editForm.frequency === 'Monthly' && (
                    <label style={{ fontSize: 13, color: '#374151' }}>
                      Day of month
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={editForm.dayOfMonth ?? 1}
                        onChange={e => setEditForm(f => ({ ...f, dayOfMonth: Number(e.target.value) }))}
                        style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                      />
                    </label>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleSave(s)}
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
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 14 }}>
                  <strong>${s.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                  {' '}{s.frequency.toLowerCase()}{s.dayOfMonth ? ` on the ${s.dayOfMonth}${s.dayOfMonth === 1 ? 'st' : s.dayOfMonth === 2 ? 'nd' : s.dayOfMonth === 3 ? 'rd' : 'th'}` : ''}
                  <span style={{ color: '#6b7280', marginLeft: 12 }}>Next: {s.nextDate}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleEdit(s)}
                    style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: '#374151' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggle(s)}
                    style={{ background: 'none', border: `1px solid ${s.active ? '#fca5a5' : '#6ee7b7'}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: s.active ? '#dc2626' : '#065f46' }}
                  >
                    {s.active ? 'Pause' : 'Resume'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}

      <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400e' }}>
        IRA contributions from automatic investments count toward your annual limit ($7,000 / $8,000 if 50+). Monitor your total to avoid excess contribution penalties.
      </div>
    </div>
  );
}
