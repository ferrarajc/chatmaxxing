import React from 'react';
import { FUNDS, MARKET_DATA, MOCK_CLIENT } from '../../../data/mock-client';

export function HomePage() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #0f2d5e 0%, #1a56db 100%)',
        borderRadius: 20, padding: '48px 48px', color: '#fff', marginBottom: 32,
      }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 36, fontWeight: 800 }}>
          Welcome back, {MOCK_CLIENT.name.split(' ')[0]}.
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 18, opacity: 0.9 }}>
          Your total portfolio value
        </p>
        <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-1px' }}>
          ${MOCK_CLIENT.totalBalance.toLocaleString()}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 14, opacity: 0.75 }}>
          Across {MOCK_CLIENT.accounts.length} accounts
        </p>
      </div>

      {/* Market ticker */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap',
      }}>
        {MARKET_DATA.map(m => (
          <div key={m.name} style={{
            flex: '1 1 150px', background: '#fff', borderRadius: 12, padding: '16px 20px',
            boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb',
          }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{m.name}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{m.value}</div>
            <div style={{ color: m.up ? '#10b981' : '#ef4444', fontSize: 13, fontWeight: 600 }}>
              {m.change}
            </div>
          </div>
        ))}
      </div>

      {/* Featured funds */}
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Featured Funds</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
        {FUNDS.slice(0, 3).map(fund => (
          <div key={fund.ticker} style={{
            background: '#fff', borderRadius: 14, padding: '20px 24px',
            boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{fund.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{fund.category}</div>
              </div>
              <span style={{
                background: '#eff6ff', color: '#1a56db', borderRadius: 6,
                padding: '3px 8px', fontSize: 12, fontWeight: 600,
              }}>{fund.ticker}</span>
            </div>
            <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 12px' }}>{fund.description}</p>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: fund.returns.oneYear > 0 ? '#10b981' : '#ef4444' }}>
                  {fund.returns.oneYear > 0 ? '+' : ''}{fund.returns.oneYear}%
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>1-year</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#374151' }}>{fund.expenseRatio}%</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Expense ratio</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Phone redirect notice */}
      <div style={{
        marginTop: 40, background: '#f0f9ff', borderRadius: 12, padding: '20px 24px',
        border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ fontSize: 28 }}>💬</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            Need help? Chat is our front door.
          </div>
          <div style={{ fontSize: 14, color: '#374151' }}>
            Our chat support team is available 24/7. Click the chat bubble in the corner to get started.
            If you call our 800 number, you'll be directed here for the fastest service.
          </div>
        </div>
      </div>
    </div>
  );
}
