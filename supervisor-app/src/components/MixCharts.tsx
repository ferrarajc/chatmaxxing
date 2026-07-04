import type { ReactNode } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { theme, CHART_COLORS } from '../theme';
import { StatsPayload } from '../types';

const CHAT_COLOR = theme.color.primary;
const PHONE_COLOR = theme.color.accent;

function Card({ title, children, flex = 1 }: { title: string; children: ReactNode; flex?: number }) {
  return (
    <div style={{
      flex, minWidth: 220, background: theme.color.surface, border: `1px solid ${theme.color.border}`,
      borderRadius: theme.radius.lg, padding: '14px 16px', boxShadow: theme.shadow.sm,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: theme.color.primary, marginBottom: 8, fontFamily: theme.font.serif }}>{title}</div>
      {children}
    </div>
  );
}

export function MixCharts({ stats }: { stats: StatsPayload }) {
  const points = stats.volume.points;
  // Thin x-axis labels: show at most ~10 ticks.
  const tickInterval = Math.max(0, Math.ceil(points.length / 10) - 1);
  const shortLabel = (label: string) =>
    stats.volume.granularity === 'week'
      ? label.slice(5) // MM-DD of the Monday
      : label.slice(5);

  const wrapTop = stats.wrapUpMix.slice(0, 8);
  const wrapOther = stats.wrapUpMix.slice(8).reduce((s, w) => s + w.count, 0);
  const wrapData = wrapOther > 0 ? [...wrapTop, { code: 'Other', count: wrapOther }] : wrapTop;

  const channelData = [
    { name: 'Chat', value: stats.channelMix.chat },
    { name: 'Phone', value: stats.channelMix.phone },
  ];

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <Card title={`Volume by ${stats.volume.granularity}`} flex={2.2}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={points} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <XAxis dataKey="label" tickFormatter={shortLabel} interval={tickInterval}
              tick={{ fontSize: 10.5, fill: theme.color.textMuted }} tickLine={false} axisLine={{ stroke: theme.color.border }} />
            <YAxis tick={{ fontSize: 10.5, fill: theme.color.textMuted }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${theme.color.border}` }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="chat" name="Chat" stackId="v" fill={CHAT_COLOR} />
            <Bar dataKey="phone" name="Phone" stackId="v" fill={PHONE_COLOR} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Wrap-up mix">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ResponsiveContainer width={160} height={220}>
            <PieChart>
              <Pie data={wrapData} dataKey="count" nameKey="code" cx="50%" innerRadius={45} outerRadius={72} paddingAngle={1}>
                {wrapData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${theme.color.border}` }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'grid', gap: 4, fontSize: 11, color: theme.color.textMuted, minWidth: 0 }}>
            {wrapData.map((w, i) => (
              <div key={w.code} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.code}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Channel mix">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={channelData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={2}>
              <Cell fill={CHAT_COLOR} />
              <Cell fill={PHONE_COLOR} />
            </Pie>
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${theme.color.border}` }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
