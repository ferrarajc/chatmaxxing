import React from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useClientStore } from '../../../store/clientStore';
import { theme } from '../../../theme';

const COLORS = [
  theme.color.primary,
  theme.color.accent,
  theme.color.success,
  theme.color.warning,
  '#6B5B8E',
  '#3F7F87',
];

const cardStyle: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg,
  padding: 24, boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`,
};

const headingStyle: React.CSSProperties = {
  margin: '0 0 18px', fontSize: 18, fontWeight: 600, color: theme.color.text,
  fontFamily: theme.font.serif, letterSpacing: '-0.01em',
};

export function PortfolioPage() {
  const { activePersona } = useClientStore();
  const allocationData = activePersona.accounts.map(a => ({ name: a.type, value: a.balance }));

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{
        margin: '0 0 28px', fontSize: 32, fontWeight: 600, color: theme.color.text,
        fontFamily: theme.font.serif, letterSpacing: '-0.02em', lineHeight: 1.1,
      }}>My Portfolio</h1>

      {/* Account cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        {activePersona.accounts.map((acc) => (
          <Link key={acc.id} to={`/account/detail/${acc.id}`} style={{
            flex: '1 1 220px', background: theme.color.surface, borderRadius: theme.radius.lg,
            padding: '22px 24px', boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`,
            textDecoration: 'none', color: 'inherit', display: 'block', transition: 'box-shadow .15s, border-color .15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = theme.shadow.md; (e.currentTarget as HTMLElement).style.borderColor = theme.color.borderStrong; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = theme.shadow.sm; (e.currentTarget as HTMLElement).style.borderColor = theme.color.border; }}
          >
            <div style={{ fontSize: 11, color: theme.color.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{acc.type}</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: theme.color.text, fontFamily: theme.font.serif, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>${acc.balance.toLocaleString()}</div>
            <div style={{ fontSize: 13, color: acc.change > 0 ? theme.color.success : theme.color.danger, fontWeight: 600, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              {acc.change > 0 ? '▲' : '▼'} {Math.abs(acc.change)}% today
            </div>
            <div style={{ fontSize: 11, color: theme.color.accent, marginTop: 8, fontWeight: 600 }}>View details →</div>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, marginBottom: 32 }}>
        {/* Holdings table */}
        <div style={cardStyle}>
          <h2 style={headingStyle}>Holdings</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.color.borderStrong}` }}>
                {['Fund', 'Ticker', 'Shares', 'Price', 'Value', 'Change'].map(h => (
                  <th key={h} style={{ textAlign: ['Fund', 'Ticker'].includes(h) ? 'left' : 'right', padding: '10px 0', color: theme.color.textMuted, fontWeight: 600, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activePersona.holdings.map((h, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                  <td style={{ padding: '12px 0', fontWeight: 500, color: theme.color.text }}>{h.name}</td>
                  <td style={{ color: theme.color.textMuted, fontFamily: theme.font.mono, fontSize: 12 }}>{h.ticker}</td>
                  <td style={{ textAlign: 'right', color: theme.color.text }}>{h.shares.toFixed(1)}</td>
                  <td style={{ textAlign: 'right', color: theme.color.text }}>${h.price.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: theme.color.text }}>${h.value.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', color: h.change > 0 ? theme.color.success : theme.color.danger, fontWeight: 600 }}>
                    {h.change > 0 ? '+' : ''}{h.change}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Allocation chart */}
        <div style={cardStyle}>
          <h2 style={headingStyle}>Allocation</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={allocationData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke={theme.color.surface} strokeWidth={2}>
                {allocationData.map((_e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} contentStyle={{ background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, fontSize: 13, fontFamily: theme.font.sans }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {allocationData.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: theme.color.text, fontVariantNumeric: 'tabular-nums' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i] }} />
                  {d.name}
                </div>
                <span style={{ fontWeight: 600 }}>{((d.value / activePersona.totalBalance) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div style={cardStyle}>
        <h2 style={headingStyle}>Recent Transactions</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${theme.color.borderStrong}` }}>
              {['Date', 'Description', 'Account', 'Amount'].map(h => (
                <th key={h} style={{ textAlign: h === 'Amount' ? 'right' : 'left', padding: '10px 0', color: theme.color.textMuted, fontWeight: 600, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activePersona.transactions.map((t, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                <td style={{ padding: '12px 0', color: theme.color.textMuted }}>{t.date}</td>
                <td style={{ color: theme.color.text }}>{t.description}</td>
                <td style={{ color: theme.color.textMuted }}>{t.account}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: t.amount > 0 ? theme.color.success : theme.color.danger }}>
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
