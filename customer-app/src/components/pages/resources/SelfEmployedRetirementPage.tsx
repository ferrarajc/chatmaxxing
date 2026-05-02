import React from 'react';

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '24px',
  boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb', marginBottom: 20,
};

export function SelfEmployedRetirementPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800 }}>Self-Employed Retirement Options</h1>
      <p style={{ margin: '0 0 32px', color: '#6b7280', fontSize: 14 }}>
        A complete comparison of retirement accounts available to freelancers, sole proprietors, and small business owners.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Plan Comparison (2025)</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                {['', 'SEP-IRA', 'Solo 401(k)', 'SIMPLE IRA', 'Roth IRA'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px 10px', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: '2025 Contribution Limit', sep: '$70,000', solo: '$70,000', simple: '$16,500 (+$3,500 if 50+)', roth: '$7,000 ($8,000 if 50+)' },
                { label: 'Tax treatment', sep: 'Pre-tax (deductible)', solo: 'Pre-tax or Roth', simple: 'Pre-tax', roth: 'After-tax (tax-free growth)' },
                { label: 'Employer required?', sep: 'No', solo: 'No', simple: 'Yes (2–3% match)', roth: 'N/A' },
                { label: 'Can have employees?', sep: 'Yes', solo: 'No (spouse only)', simple: 'Yes', roth: 'N/A' },
                { label: 'Annual IRS filing', sep: 'None', solo: 'Form 5500-EZ (>$250k)', simple: 'None', roth: 'None' },
                { label: 'Loan provision', sep: 'No', solo: 'Plan option', simple: 'Yes', roth: 'No' },
                { label: 'Establishment deadline', sep: 'Tax deadline+ext.', solo: 'Dec 31', simple: 'Oct 1', roth: 'Tax deadline' },
              ].map(r => (
                <tr key={r.label} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 8px', fontWeight: 600, color: '#374151' }}>{r.label}</td>
                  <td style={{ padding: '10px 8px' }}>{r.sep}</td>
                  <td style={{ padding: '10px 8px' }}>{r.solo}</td>
                  <td style={{ padding: '10px 8px' }}>{r.simple}</td>
                  <td style={{ padding: '10px 8px' }}>{r.roth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Most Popular for Self-Employed: SEP-IRA</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          The SEP-IRA is the most popular choice for sole proprietors and freelancers because it is:
        </p>
        <ul style={{ margin: '0 0 14px', paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
          <li>Simple to set up — can be done in minutes online</li>
          <li>Has very high limits ($70,000/year)</li>
          <li>Fully tax-deductible contributions</li>
          <li>No annual IRS filings required</li>
          <li>Can be established up to tax filing deadline (with extensions)</li>
        </ul>
        <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          The main limitation: all contributions are pre-tax (no Roth option). Consider a solo 401(k) if Roth contributions or loans are important to you.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Can I Have a SEP-IRA AND a Day Job 401(k)?</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          Yes. If you have a W-2 job with a 401(k) AND self-employment income, you can:
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
          <li>Max out your employer's 401(k) ($23,500 employee deferral in 2025)</li>
          <li>Also contribute to a SEP-IRA based on your self-employment net income</li>
          <li>Also contribute $7,000 to a Roth IRA (if income-eligible)</li>
        </ul>
      </div>

      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#065f46' }}>
        Bob's Mutual Funds offers SEP-IRA accounts with no minimum balance and no maintenance fees. Call us or open online to get started.
      </div>
    </div>
  );
}
