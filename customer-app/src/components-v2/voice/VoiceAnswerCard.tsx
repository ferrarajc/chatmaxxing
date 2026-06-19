import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { theme } from '../../theme';
import { fmtMoney } from '../tools/format';
import { VoiceCard } from './voiceCards';

// A white card that floats on the dark voice overlay, showing the answer's data while Bob
// speaks it. Derived entirely client-side from the persona (see voiceCards.ts).

const PIE = [theme.color.primary, theme.color.accent, theme.color.success, '#4A6FA5', theme.color.warning, '#7A6F5D'];

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: theme.color.textMuted,
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
};
const bigStyle: React.CSSProperties = {
  fontSize: 30, fontWeight: 800, fontFamily: theme.font.serif, color: theme.color.primary, lineHeight: 1,
};

export function VoiceAnswerCard({ card }: { card: VoiceCard }) {
  return (
    <div style={{
      background: theme.color.surface, color: theme.color.text,
      borderRadius: theme.radius.xl, boxShadow: theme.shadow.lg,
      padding: '18px 22px', width: 'min(440px, 90vw)',
    }}>
      {card.kind === 'balance' && (
        <>
          <div style={labelStyle}>Total balance</div>
          <div style={bigStyle}>{fmtMoney(card.total)}</div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {card.accounts.map(a => (
              <div key={a.type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: theme.color.textMuted }}>{a.type}</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(a.balance)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {card.kind === 'holding' && (
        <>
          <div style={labelStyle}>{card.label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ ...bigStyle, color: theme.color.accent, fontFamily: theme.font.mono }}>{card.ticker}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: card.change >= 0 ? theme.color.success : theme.color.danger }}>
              {card.change >= 0 ? '▲' : '▼'} {Math.abs(card.change).toFixed(1)}%
            </div>
          </div>
          <div style={{ fontSize: 14, color: theme.color.textMuted, marginTop: 6 }}>
            {card.name} · {fmtMoney(card.value)}
          </div>
        </>
      )}

      {card.kind === 'allocation' && (
        <>
          <div style={labelStyle}>Your holdings</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={card.slices} cx="50%" cy="50%" innerRadius={48} outerRadius={78} dataKey="value" nameKey="name" stroke={theme.color.surface} strokeWidth={2}>
                {card.slices.map((_s, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip
                formatter={(v: unknown) => fmtMoney(Number(v))}
                contentStyle={{ background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, fontSize: 13, fontFamily: theme.font.sans }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', justifyContent: 'center', marginTop: 4 }}>
            {card.slices.map((s, i) => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.color.textMuted }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: PIE[i % PIE.length] }} />
                {s.name}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
