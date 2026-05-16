import React, { useState } from 'react';
import { FUNDS } from '../../../data/mock-client';

const CATEGORIES = ['All', 'Large Cap Blend', 'Large Cap Growth', 'Intermediate Bond', 'International Blend', 'Large Cap ESG', 'Short-Term Bond'];

export function ResearchPage() {
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = activeCategory === 'All' ? FUNDS : FUNDS.filter(f => f.category === activeCategory);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800 }}>Fund Research</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 15 }}>
        Explore our full lineup of low-cost mutual funds.
      </p>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              border: '1.5px solid',
              borderColor: activeCategory === cat ? '#1a56db' : '#d1d5db',
              background: activeCategory === cat ? '#eff6ff' : '#fff',
              color: activeCategory === cat ? '#1a56db' : '#374151',
              cursor: 'pointer',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Fund cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 20 }}>
        {filtered.map(fund => (
          <div key={fund.ticker} style={{
            background: '#fff', borderRadius: 16, padding: '24px',
            boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{fund.name}</div>
                <span style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '2px 6px' }}>{fund.category}</span>
              </div>
              <span style={{ fontWeight: 800, fontSize: 18, color: '#1a56db' }}>{fund.ticker}</span>
            </div>

            <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 16px', lineHeight: 1.5 }}>{fund.description}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'YTD', value: fund.returns.ytd },
                { label: '1-Year', value: fund.returns.oneYear },
                { label: '3-Year', value: fund.returns.threeYear },
                { label: '5-Year', value: fund.returns.fiveYear },
              ].map(r => (
                <div key={r.label} style={{ textAlign: 'center', background: '#f9fafb', borderRadius: 8, padding: '8px 4px' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: r.value > 0 ? '#10b981' : '#ef4444' }}>
                    {r.value > 0 ? '+' : ''}{r.value}%
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280' }}>
              <span>Expense ratio: <strong style={{ color: '#111' }}>{fund.expenseRatio}%</strong></span>
              <span>Min investment: <strong style={{ color: '#111' }}>${fund.minInvestment}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
