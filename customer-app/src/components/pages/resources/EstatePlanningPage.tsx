import React from 'react';

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '24px',
  boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb', marginBottom: 20,
};

export function EstatePlanningPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800 }}>Estate Planning & IRAs</h1>
      <p style={{ margin: '0 0 32px', color: '#6b7280', fontSize: 14 }}>
        What happens to your IRA when you pass away, and how to ensure your assets go to the right people.
      </p>

      <div style={{ ...card, background: '#fff7ed', border: '1px solid #fed7aa' }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: '#c2410c' }}>Most Important Step: Update Your Beneficiaries</h2>
        <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          Your beneficiary designation <strong>overrides your will</strong>. If your will leaves your IRA to your children but your beneficiary form still names an ex-spouse, the ex-spouse gets the money. Review designations after every major life event.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Beneficiary Rules by Account Type</h2>
        {[
          {
            type: 'Traditional IRA',
            rules: [
              'Passes to named beneficiary — no probate if designation is on file',
              'Surviving spouse: can roll into own IRA, defer RMDs to 73',
              'Non-spouse beneficiary: must withdraw all funds within 10 years (SECURE Act 10-year rule)',
              'Withdrawals are taxable as ordinary income to the beneficiary',
            ],
          },
          {
            type: 'Roth IRA',
            rules: [
              'Passes to named beneficiary — no probate',
              'Surviving spouse: can treat as own Roth IRA (no RMD, tax-free growth)',
              'Non-spouse beneficiary: 10-year rule applies, but withdrawals are tax-free',
              'Best account to inherit — tax-free for 10 years of growth',
            ],
          },
          {
            type: 'SEP-IRA',
            rules: [
              'Same rules as Traditional IRA for beneficiaries',
              'Surviving spouse rollover and 10-year rule for non-spouse beneficiaries apply',
              'All distributions are taxable as ordinary income',
            ],
          },
        ].map(item => (
          <div key={item.type} style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>{item.type}</h3>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 14, color: '#374151' }}>
              {item.rules.map(r => <li key={r}>{r}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>The 10-Year Rule (SECURE Act 2019)</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          The SECURE Act eliminated the "stretch IRA" for most non-spouse beneficiaries. Now, most beneficiaries must withdraw the entire inherited IRA balance within 10 years of the original owner's death.
        </p>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          <strong>Exceptions</strong> — the following "eligible designated beneficiaries" are exempt from the 10-year rule and can still stretch distributions:
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
          <li>Surviving spouse</li>
          <li>Minor children of the deceased (until they reach majority, then 10 years)</li>
          <li>Individuals not more than 10 years younger than the deceased</li>
          <li>Disabled individuals (as defined by IRS)</li>
          <li>Chronically ill individuals</li>
        </ul>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Using a Trust as Beneficiary</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          You can name a trust as your IRA beneficiary. This is useful for controlling how assets are distributed to minor children or protecting assets from creditors. However, it is complex:
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
          <li>The trust must be a "see-through" (conduit or accumulation) trust meeting specific IRS requirements</li>
          <li>An improperly drafted trust can result in the entire IRA being taxed within 5 years</li>
          <li>Work with an estate planning attorney — not a standard will template</li>
        </ul>
      </div>

      <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400e' }}>
        Estate planning decisions have significant tax and legal consequences. Bob's Mutual Funds recommends consulting an estate planning attorney and tax professional for personalized advice.
      </div>
    </div>
  );
}
