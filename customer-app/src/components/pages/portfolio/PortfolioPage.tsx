import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { MOCK_CLIENT } from '../../../data/mock-client';

const COLORS = ['#1a56db', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function PortfolioPage() {
  const allocationData = MOCK_CLIENT.accounts.map(a => ({
    name: a.type, value: a.balance,
  }));

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 24px', fontSize: 28, fontWeight: 800 }}>My Portfolio</h1>

      {/* Account cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        {MOCK_CLIENT.accounts.map((acc, i) => (
          <div key={acc.id} style={{
            flex: '1 1 220px', background: '#fff', borderRadius: 14,
            padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,.07)',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{acc.type}</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>${acc.balance.toLocaleString()}</div>
            <div style={{ fontSize: 13, color: acc.change > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
              {acc.change > 0 ? '▲' : '▼'} {Math.abs(acc.change)}% today
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, marginBottom: 32 }}>
        {/* Holdings table */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Holdings</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 600 }}>
                {['Fund', 'Ticker', 'Shares', 'Price', 'Value', 'Change'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Fund' ? 'left' : 'right', padding: '8px 0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_CLIENT.holdings.map((h, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 0', fontWeight: 500 }}>{h.name}</td>
                  <td style={{ textAlign: 'right', color: '#6b7280' }}>{h.ticker}</td>
                  <td style={{ textAlign: 'right' }}>{h.shares.toFixed(1)}</td>
                  <td style={{ textAlign: 'right' }}>${h.price.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${h.value.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', color: h.change > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    {h.change > 0 ? '+' : ''}{h.change}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Allocation chart */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Allocation</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={allocationData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                {allocationData.map((_e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {allocationData.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i] }} />
                  {d.name}
                </div>
                <span style={{ fontWeight: 600 }}>{((d.value / MOCK_CLIENT.totalBalance) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Recent Transactions</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 600 }}>
              {['Date', 'Description', 'Account', 'Amount'].map(h => (
                <th key={h} style={{ textAlign: h === 'Amount' ? 'right' : 'left', padding: '8px 0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_CLIENT.transactions.map((t, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 0', color: '#6b7280' }}>{t.date}</td>
                <td>{t.description}</td>
                <td style={{ color: '#6b7280' }}>{t.account}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: t.amount > 0 ? '#10b981' : '#ef4444' }}>
                  {t.amount > 0 ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
