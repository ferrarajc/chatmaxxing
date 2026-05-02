import React, { useState } from 'react';
import { useClientStore } from '../../../store/clientStore';

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '20px 24px',
  boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb', marginBottom: 20,
};

const DELIVERY_OPTIONS = [
  'Direct deposit — linked bank account',
  'Transfer to taxable account',
  'Check by mail',
];

const FREQUENCY_OPTIONS = ['Annual (lump sum)', 'Quarterly', 'Monthly'];

export function RmdPage() {
  const { activePersona, updateRmd } = useClientStore();
  const rmd = activePersona.rmd;

  const [deliveryMethod, setDeliveryMethod] = useState(
    rmd.distributions?.[0]?.method ?? DELIVERY_OPTIONS[0],
  );
  const [frequency, setFrequency] = useState('Annual (lump sum)');
  const [withholding, setWithholding] = useState(10);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateRmd({ distributions: rmd.distributions });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (!rmd.eligible) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <a href="/account" style={{ color: '#6b7280', fontSize: 13, textDecoration: 'none' }}>← Account</a>
        </div>
        <h1 style={{ margin: '0 0 24px', fontSize: 28, fontWeight: 800 }}>Required Minimum Distributions</h1>
        <div style={{ ...card, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#065f46' }}>Not Yet Required</h2>
          <p style={{ margin: 0, fontSize: 14, color: '#374151' }}>
            {rmd.projectedEligibilityYear
              ? `RMDs from Traditional IRAs begin at age 73. You are projected to reach RMD age around ${rmd.projectedEligibilityYear}. No action needed at this time.`
              : 'Your accounts are not subject to required minimum distributions at this time. Roth IRAs have no RMD requirement during your lifetime.'}
          </p>
        </div>
        <div style={card}>
          <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>What are RMDs?</h2>
          <p style={{ margin: '0 0 8px', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
            Required Minimum Distributions (RMDs) are mandatory annual withdrawals from tax-deferred retirement accounts (Traditional IRA, SEP-IRA) beginning at age 73 under SECURE 2.0. The amount is based on your account balance and IRS life expectancy factors.
          </p>
          <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
            Roth IRAs are <strong>not</strong> subject to RMDs during your lifetime — one of their key advantages for estate planning.
          </p>
        </div>
      </div>
    );
  }

  const progressPct = rmd.annualRmd ? Math.round(((rmd.takenThisYear ?? 0) / rmd.annualRmd) * 100) : 0;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <a href="/account" style={{ color: '#6b7280', fontSize: 13, textDecoration: 'none' }}>← Account</a>
      </div>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800 }}>Required Minimum Distributions</h1>
      <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: 14 }}>
        Traditional IRA · Age {rmd.age} · Deadline: {rmd.nextDeadline}
      </p>

      {saved && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 14, color: '#065f46' }}>
          RMD preferences saved.
        </div>
      )}

      {/* RMD Status Summary */}
      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>2025 RMD Status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          {[
            { label: '2025 RMD Required', value: `$${rmd.annualRmd?.toLocaleString()}` },
            { label: 'Taken This Year', value: `$${rmd.takenThisYear?.toLocaleString()}` },
            { label: 'Remaining', value: `$${rmd.remainingThisYear?.toLocaleString()}`, highlight: (rmd.remainingThisYear ?? 0) > 0 },
          ].map(item => (
            <div key={item.label} style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: item.highlight ? '#dc2626' : '#111' }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, background: '#e5e7eb', borderRadius: 99, height: 8 }}>
            <div style={{ width: `${progressPct}%`, background: progressPct === 100 ? '#10b981' : '#1a56db', borderRadius: 99, height: '100%', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', minWidth: 36 }}>{progressPct}%</span>
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
          Prior year balance: ${rmd.priorYearBalance?.toLocaleString()} · Life expectancy factor: {rmd.lifeExpectancyFactor}
        </div>
      </div>

      {/* Distribution Preferences */}
      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Distribution Preferences</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#374151' }}>
            Delivery method
            <select
              value={deliveryMethod}
              onChange={e => setDeliveryMethod(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
            >
              {DELIVERY_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13, color: '#374151' }}>
            Frequency
            <select
              value={frequency}
              onChange={e => setFrequency(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
            >
              {FREQUENCY_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13, color: '#374151' }}>
            Federal withholding (%)
            <input
              type="number"
              min={0}
              max={99}
              value={withholding}
              onChange={e => setWithholding(Number(e.target.value))}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
            />
          </label>
        </div>
        <button
          onClick={handleSave}
          style={{ background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Save preferences
        </button>
      </div>

      {/* Distribution History */}
      {rmd.distributions && rmd.distributions.length > 0 && (
        <div style={card}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Distribution History</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                {['Date', 'Amount', 'Method', 'Withheld'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 0 10px', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rmd.distributions.map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 0' }}>{d.date}</td>
                  <td style={{ padding: '10px 0', fontWeight: 600 }}>${d.amount.toLocaleString()}</td>
                  <td style={{ padding: '10px 0', color: '#6b7280' }}>{d.method}</td>
                  <td style={{ padding: '10px 0' }}>${d.withheld.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400e' }}>
        Missing your RMD deadline triggers a 25% IRS excise tax on the shortfall. Bob's Mutual Funds sends reminders in December, but you are responsible for taking the distribution on time.
      </div>
    </div>
  );
}
