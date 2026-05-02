import React from 'react';

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '24px',
  boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb', marginBottom: 20,
};

export function TaxEfficientInvestingPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800 }}>Tax-Efficient Investing</h1>
      <p style={{ margin: '0 0 32px', color: '#6b7280', fontSize: 14 }}>
        Strategies to minimize your tax drag and maximize after-tax returns across your portfolio.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Asset Location: Where to Hold Each Fund</h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          "Asset location" means placing tax-efficient funds in taxable accounts and tax-inefficient funds in tax-advantaged accounts (IRA, SEP-IRA, Roth IRA) to minimize annual tax bills.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              {['Fund', 'Tax Efficiency', 'Best Account'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px 10px', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { fund: 'BobsFunds 500 Index (BF500)', efficiency: 'High — low turnover, few capital gains', best: 'Taxable or any' },
              { fund: 'BobsFunds Bond Income (BFBI)', efficiency: 'Low — interest taxed as ordinary income', best: 'IRA / SEP-IRA' },
              { fund: 'BobsFunds Short-Term Treasury (BFST)', efficiency: 'Low — interest taxed as ordinary income', best: 'IRA / SEP-IRA' },
              { fund: 'BobsFunds Growth (BFGR)', efficiency: 'Medium — some capital gains distributions', best: 'Roth IRA (tax-free growth)' },
              { fund: 'BobsFunds ESG Leaders (BFESG)', efficiency: 'Medium — moderate turnover', best: 'Roth IRA or taxable' },
              { fund: 'BobsFunds International (BFIN)', efficiency: 'Medium — foreign tax credit benefit in taxable', best: 'Taxable' },
            ].map(r => (
              <tr key={r.fund} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 8px', fontWeight: 500 }}>{r.fund}</td>
                <td style={{ padding: '10px 8px', color: '#6b7280' }}>{r.efficiency}</td>
                <td style={{ padding: '10px 8px', color: '#1a56db', fontWeight: 500 }}>{r.best}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Tax-Loss Harvesting</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          In a taxable account, when a holding drops below your purchase price, you can sell it to realize a capital loss. That loss offsets capital gains elsewhere, reducing your tax bill.
        </p>
        <div style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
          <strong style={{ fontSize: 13 }}>Example:</strong>
          <div style={{ fontSize: 13, color: '#374151', marginTop: 6, lineHeight: 1.6 }}>
            You sell BFIN at a $2,000 loss. You immediately buy a similar (but not identical) international fund. The $2,000 loss offsets $2,000 of capital gains from selling appreciated BF500 shares — saving you ~$440 in taxes at the 22% rate.
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
          Wash-sale rule: you cannot repurchase a "substantially identical" security within 30 days before or after the sale or the loss is disallowed.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Dividend Tax Rates (2025)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              {['Dividend Type', 'Tax Rate', 'Notes'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px 10px', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { type: 'Qualified dividends (stocks held >60 days)', rate: '0%, 15%, or 20%', notes: 'Based on your taxable income bracket' },
              { type: 'Ordinary dividends', rate: 'Your marginal rate (up to 37%)', notes: 'Short-term dividends, REIT dividends, money market' },
              { type: 'Bond interest income', rate: 'Your marginal rate (up to 37%)', notes: 'BFBI, BFST distributions — hold in IRA if possible' },
              { type: 'Dividends in IRA/SEP-IRA', rate: 'Deferred until withdrawal', notes: 'Not taxed annually — grows tax-deferred' },
              { type: 'Dividends in Roth IRA', rate: '0% always (qualified withdrawals)', notes: 'Tax-free growth for life' },
            ].map(r => (
              <tr key={r.type} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 8px', fontWeight: 500, fontSize: 13 }}>{r.type}</td>
                <td style={{ padding: '10px 8px', color: '#1a56db' }}>{r.rate}</td>
                <td style={{ padding: '10px 8px', color: '#6b7280', fontSize: 13 }}>{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#065f46' }}>
        <strong>Quick Rule:</strong> Hold tax-inefficient assets (bonds, high-yield funds) inside IRAs. Hold tax-efficient assets (index funds) in your taxable account. This simple reallocation can add meaningful after-tax returns over decades.
      </div>
    </div>
  );
}
