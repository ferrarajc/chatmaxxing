import React from 'react';

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '24px',
  boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb', marginBottom: 20,
};

export function SepIraVsSoloPage() {
  const rows = [
    { feature: '2025 max contribution', sep: '$70,000', solo: '$70,000 (same cap)' },
    { feature: 'Contribution at low income', sep: 'Lower (employer-only)', solo: 'Higher (includes $23,500 employee deferral)' },
    { feature: 'Roth option', sep: 'No', solo: 'Yes (Roth deferrals available)' },
    { feature: 'Annual IRS filing', sep: 'None required', solo: 'Form 5500-EZ once assets > $250k' },
    { feature: 'Can cover employees', sep: 'Yes (must match %)', solo: 'No (owner + spouse only)' },
    { feature: 'Loan provision', sep: 'No', solo: 'Yes (plan-level option)' },
    { feature: 'Establishment deadline', sep: 'Tax filing deadline', solo: 'December 31 of tax year' },
    { feature: 'Administrative complexity', sep: 'Very low', solo: 'Moderate' },
  ];

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800 }}>SEP-IRA vs. Solo 401(k)</h1>
      <p style={{ margin: '0 0 32px', color: '#6b7280', fontSize: 14 }}>
        Both plans are excellent for self-employed individuals. Here's how to decide which fits your situation.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Side-by-Side Comparison</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px 10px', color: '#6b7280', fontWeight: 600, fontSize: 12, width: '34%' }}>Feature</th>
              <th style={{ textAlign: 'left', padding: '6px 8px 10px', color: '#f59e0b', fontWeight: 600, fontSize: 12, width: '33%' }}>SEP-IRA</th>
              <th style={{ textAlign: 'left', padding: '6px 8px 10px', color: '#1a56db', fontWeight: 600, fontSize: 12, width: '33%' }}>Solo 401(k)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.feature} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 8px', fontWeight: 500 }}>{r.feature}</td>
                <td style={{ padding: '10px 8px', color: '#374151' }}>{r.sep}</td>
                <td style={{ padding: '10px 8px', color: '#374151' }}>{r.solo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ ...card, marginBottom: 0, background: '#fefce8', border: '1px solid #fde68a' }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#92400e' }}>Choose SEP-IRA if…</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
            <li>You have eligible employees (or may hire them soon)</li>
            <li>You prefer minimal paperwork and administration</li>
            <li>Your income is high enough that 25% of compensation already hits $70k</li>
            <li>You want to establish the plan after year-end (up to tax deadline)</li>
          </ul>
        </div>
        <div style={{ ...card, marginBottom: 0, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#1e40af' }}>Choose Solo 401(k) if…</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
            <li>You are self-employed with no employees (other than a spouse)</li>
            <li>You want a Roth contribution option</li>
            <li>Your income is lower and you want to maximize via employee deferrals</li>
            <li>You want the option to take a plan loan</li>
          </ul>
        </div>
      </div>

      <div style={{ ...card, marginTop: 20 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Contribution Comparison at Various Income Levels</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              {['Net Self-Employment Income', 'SEP-IRA Max', 'Solo 401(k) Max (under 50)'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px 10px', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { income: '$30,000', sep: '$5,576', solo: '$23,500 + $5,576 = $29,076' },
              { income: '$60,000', sep: '$11,152', solo: '$23,500 + $11,152 = $34,652' },
              { income: '$100,000', sep: '$18,587', solo: '$23,500 + $18,587 = $42,087' },
              { income: '$200,000', sep: '$37,174', solo: '$23,500 + $37,174 = $60,674' },
              { income: '$280,000+', sep: '$70,000', solo: '$70,000 (cap)' },
            ].map(r => (
              <tr key={r.income} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 8px', fontWeight: 500 }}>{r.income}</td>
                <td style={{ padding: '10px 8px' }}>{r.sep}</td>
                <td style={{ padding: '10px 8px', color: '#1a56db' }}>{r.solo}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#9ca3af' }}>Solo 401(k) employee deferral is $23,500 for 2025 (+$7,500 if 50+). Employer contribution = same formula as SEP-IRA.</p>
      </div>
    </div>
  );
}
