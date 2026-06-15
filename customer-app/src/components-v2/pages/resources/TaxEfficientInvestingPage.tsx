import React, { useMemo } from 'react';
import { theme } from '../../../theme';
import { useFunds } from '../../../hooks/useFunds';
import { FundGroup } from '../../../data/funds';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

// Tax-efficiency guidance keyed by asset-class family, so it covers the whole lineup (all 36
// funds) instead of naming a stale subset. Order matches the Research screener.
const FAMILY_TAX: { group: FundGroup; efficiency: string; best: string }[] = [
  { group: 'US Equity',     efficiency: 'High — broad index funds have low turnover and few capital gains', best: 'Taxable or any' },
  { group: 'Sector Equity', efficiency: 'Medium — narrower funds can distribute more capital gains',        best: 'Roth IRA or taxable' },
  { group: 'International',  efficiency: 'Medium — foreign tax credit benefits a taxable account',            best: 'Taxable' },
  { group: 'Fixed Income',  efficiency: 'Low — interest is taxed as ordinary income',                         best: 'IRA / SEP-IRA' },
];

export function TaxEfficientInvestingPage() {
  const { funds } = useFunds();
  const countByGroup = useMemo(() => {
    const m = new Map<FundGroup, number>();
    for (const f of funds) m.set(f.group, (m.get(f.group) ?? 0) + 1);
    return m;
  }, [funds]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Tax-Efficient Investing</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Strategies to minimize your tax drag and maximize after-tax returns across your portfolio.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Asset Location: Where to Hold Each Fund</h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          "Asset location" means placing tax-efficient funds in taxable accounts and tax-inefficient funds in tax-advantaged accounts (IRA, SEP-IRA, Roth IRA) to minimize annual tax bills. Bob's {funds.length} funds fall into four asset-class families, each with a different tax profile:
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.color.border}` }}>
              {['Fund Family', 'Tax Efficiency', 'Best Account'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px 10px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FAMILY_TAX.map(r => {
              const n = countByGroup.get(r.group) ?? 0;
              return (
                <tr key={r.group} style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                  <td style={{ padding: '10px 8px', fontWeight: 500 }}>{r.group}{n ? <span style={{ color: theme.color.textMuted, fontWeight: 400 }}> ({n} funds)</span> : null}</td>
                  <td style={{ padding: '10px 8px', color: theme.color.textMuted }}>{r.efficiency}</td>
                  <td style={{ padding: '10px 8px', color: theme.color.primary, fontWeight: 500 }}>{r.best}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Tax-Loss Harvesting</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: theme.color.text, lineHeight: 1.6 }}>
          In a taxable account, when a holding drops below your purchase price, you can sell it to realize a capital loss. That loss offsets capital gains elsewhere, reducing your tax bill.
        </p>
        <div style={{ background: theme.color.surfaceMuted, borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
          <strong style={{ fontSize: 13 }}>Example:</strong>
          <div style={{ fontSize: 13, color: theme.color.text, marginTop: 6, lineHeight: 1.6 }}>
            You sell BFIN at a $2,000 loss. You immediately buy a similar (but not identical) international fund. The $2,000 loss offsets $2,000 of capital gains from selling appreciated BF500 shares — saving you ~$440 in taxes at the 22% rate.
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: theme.color.textMuted }}>
          Wash-sale rule: you cannot repurchase a "substantially identical" security within 30 days before or after the sale or the loss is disallowed.
        </p>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Dividend Tax Rates (2025)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.color.border}` }}>
              {['Dividend Type', 'Tax Rate', 'Notes'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px 10px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>{h}</th>
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
              <tr key={r.type} style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                <td style={{ padding: '10px 8px', fontWeight: 500, fontSize: 13 }}>{r.type}</td>
                <td style={{ padding: '10px 8px', color: theme.color.primary }}>{r.rate}</td>
                <td style={{ padding: '10px 8px', color: theme.color.textMuted, fontSize: 13 }}>{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: theme.color.success }}>
        <strong>Quick Rule:</strong> Hold tax-inefficient assets (bonds, high-yield funds) inside IRAs. Hold tax-efficient assets (index funds) in your taxable account. This simple reallocation can add meaningful after-tax returns over decades.
      </div>
    </div>
  );
}
