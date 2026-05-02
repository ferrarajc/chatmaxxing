import React from 'react';

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '24px',
  boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb', marginBottom: 20,
};

export function IraContributionLimitsPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800 }}>IRA Contribution Limits 2025</h1>
      <p style={{ margin: '0 0 32px', color: '#6b7280', fontSize: 14 }}>
        Complete guide to Roth IRA and Traditional IRA contribution rules for the 2025 tax year.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700 }}>2025 Annual Limits at a Glance</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              {['Account Type', 'Under 50', 'Age 50+', 'Income Limit'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px 10px', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { type: 'Roth IRA', under50: '$7,000', over50: '$8,000', income: 'Phase-out: $146k–$161k (single) / $230k–$240k (joint)' },
              { type: 'Traditional IRA', under50: '$7,000', over50: '$8,000', income: 'No income limit to contribute (deductibility may be limited)' },
              { type: 'Combined IRA limit', under50: '$7,000', over50: '$8,000', income: 'Total across ALL IRAs — Roth + Traditional combined' },
            ].map(r => (
              <tr key={r.type} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 8px', fontWeight: 600 }}>{r.type}</td>
                <td style={{ padding: '10px 8px' }}>{r.under50}</td>
                <td style={{ padding: '10px 8px' }}>{r.over50}</td>
                <td style={{ padding: '10px 8px', color: '#6b7280', fontSize: 13 }}>{r.income}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Combined Limit Rule</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          The $7,000 (or $8,000) limit applies across all your IRAs combined. You cannot contribute $7,000 to a Roth IRA and another $7,000 to a Traditional IRA in the same year.
        </p>
        <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          Example: if you're under 50, you could put $4,000 in a Roth IRA and $3,000 in a Traditional IRA — but the total must not exceed $7,000.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Roth IRA Income Limits 2025</h2>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                {['Filing Status', 'Full Contribution', 'Phase-out Range', 'No Contribution'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px 10px', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { status: 'Single / Head of Household', full: 'Under $146,000', range: '$146,000–$161,000', none: 'Over $161,000' },
                { status: 'Married Filing Jointly', full: 'Under $230,000', range: '$230,000–$240,000', none: 'Over $240,000' },
                { status: 'Married Filing Separately', full: '$0', range: '$0–$10,000', none: 'Over $10,000' },
              ].map(r => (
                <tr key={r.status} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 8px', fontWeight: 500 }}>{r.status}</td>
                  <td style={{ padding: '10px 8px', color: '#065f46' }}>{r.full}</td>
                  <td style={{ padding: '10px 8px', color: '#b45309' }}>{r.range}</td>
                  <td style={{ padding: '10px 8px', color: '#dc2626' }}>{r.none}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Excess Contribution Penalty</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          Contributing more than the annual limit results in a <strong>6% IRS excise tax per year</strong> on the excess amount, for every year it remains in the account.
        </p>
        <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          To correct an excess: withdraw the excess plus any attributable earnings before your tax filing deadline (including extensions). Contact Bob's Mutual Funds to process a corrective withdrawal.
        </p>
      </div>

      <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400e' }}>
        Limits shown are for 2025. IRS adjusts these limits periodically for inflation. Earned income must equal or exceed your contribution amount — you cannot contribute to an IRA without earned income.
      </div>
    </div>
  );
}
