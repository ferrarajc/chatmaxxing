import React from 'react';

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '24px',
  boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb', marginBottom: 20,
};

export function SepIraPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800 }}>SEP-IRA Guide 2025</h1>
      <p style={{ margin: '0 0 32px', color: '#6b7280', fontSize: 14 }}>
        Complete reference for SEP-IRA contribution limits, calculation methods, and deadlines for self-employed individuals.
      </p>

      <div style={{ ...card, background: '#fefce8', border: '1px solid #fde68a' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#92400e' }}>2025 SEP-IRA Limit: $70,000</h2>
        <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          You can contribute the lesser of <strong>$70,000</strong> or <strong>25% of net self-employment compensation</strong> to a SEP-IRA. For most self-employed individuals, this is far more than any IRA — making the SEP-IRA the most powerful retirement vehicle available without a full employer plan.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>How to Calculate Your Limit</h2>
        <div style={{ background: '#f9fafb', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontFamily: 'monospace', lineHeight: 2.2, color: '#374151' }}>
            Schedule C Net Profit:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; $150,000<br />
            Less: SE tax deduction (½ × SE tax):&nbsp; − $10,597<br />
            Net self-employment income:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; = $139,403<br />
            SEP-IRA limit (20% of above):&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; = $27,881
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
          Note: the IRS caps the contribution at 25% of compensation, but after the SE tax deduction math works out to approximately 20% of net profit. Have your accountant compute the exact figure.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Key Facts</h2>
        {[
          { title: 'Contribution deadline', body: 'Tax filing deadline including extensions — October 15, 2026 for tax year 2025. No need to fund by December 31.' },
          { title: 'Tax deductibility', body: 'Contributions are fully deductible as a business expense, regardless of whether you itemize.' },
          { title: 'Roth option', body: 'SEP-IRAs are pre-tax only. No Roth SEP-IRA option exists — consider a solo 401(k) if you want Roth contributions.' },
          { title: 'Employee rules', body: 'If you have eligible employees, you must contribute the same % of their compensation as you contribute for yourself.' },
          { title: 'Annual IRS filing', body: 'No annual Form 5500 filing required for SEP-IRAs with one participant. Simpler than a 401(k).' },
          { title: 'Combined with Roth IRA', body: 'You can contribute to both a SEP-IRA and a Roth IRA in the same year — they have completely separate limits.' },
        ].map(item => (
          <div key={item.title} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{item.title}</div>
            <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>{item.body}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Contribution Limit by Income Level (2025)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              {['Schedule C Net Profit', 'Approx. SEP-IRA Limit', '% of Profit'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px 10px', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { profit: '$50,000', limit: '$9,293', pct: '18.6%' },
              { profit: '$100,000', limit: '$18,587', pct: '18.6%' },
              { profit: '$150,000', limit: '$27,881', pct: '18.6%' },
              { profit: '$200,000', limit: '$37,174', pct: '18.6%' },
              { profit: '$280,000+', limit: '$70,000 (cap)', pct: '25% of comp.' },
            ].map(r => (
              <tr key={r.profit} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 8px', fontWeight: 500 }}>{r.profit}</td>
                <td style={{ padding: '10px 8px' }}>{r.limit}</td>
                <td style={{ padding: '10px 8px', color: '#6b7280' }}>{r.pct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400e' }}>
        These figures are estimates. The exact limit depends on your specific SE tax calculation. Always confirm your contribution limit with a CPA before making contributions.
      </div>
    </div>
  );
}
