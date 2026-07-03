import { theme } from '../theme';
import { StatsPayload, WindowKey, WINDOW_LABELS, DIVISIONS } from '../types';
import { fmtDuration, fmtNumber, fmtDate } from '../util';

const WINDOWS: WindowKey[] = ['today', '7d', '30d', 'all'];

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      flex: '1 1 130px', background: theme.color.surface, border: `1px solid ${theme.color.border}`,
      borderRadius: theme.radius.lg, padding: '14px 18px', boxShadow: theme.shadow.sm, minWidth: 130,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.color.textSubtle }}>{label}</div>
      <div style={{ fontFamily: theme.font.serif, fontSize: 26, fontWeight: 700, color: theme.color.primary, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: theme.color.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function KpiHeader({
  stats, windowKey, onWindow, division, onDivision,
}: {
  stats: StatsPayload;
  windowKey: WindowKey;
  onWindow: (w: WindowKey) => void;
  division: string | null;
  onDivision: (d: string | null) => void;
}) {
  const t = stats.totals;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {/* Window pills */}
        <div style={{ display: 'flex', background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.pill, padding: 3 }}>
          {WINDOWS.map(w => (
            <button
              key={w}
              onClick={() => onWindow(w)}
              style={{
                border: 'none', cursor: 'pointer', padding: '6px 16px', fontSize: 13, fontWeight: 600,
                borderRadius: theme.radius.pill,
                background: w === windowKey ? theme.color.primary : 'transparent',
                color: w === windowKey ? theme.color.textOnPrimary : theme.color.textMuted,
              }}
            >
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>

        {/* Division filter */}
        <select
          value={division ?? ''}
          onChange={e => onDivision(e.target.value || null)}
          style={{
            padding: '8px 12px', fontSize: 13, fontWeight: 500, fontFamily: theme.font.sans,
            border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md,
            background: theme.color.surface, color: theme.color.text, cursor: 'pointer',
          }}
        >
          <option value="">All divisions</option>
          {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: theme.color.textSubtle, maxWidth: 480, textAlign: 'right' }}>
          {stats.note}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiTile label="Conversations" value={fmtNumber(t.conversations)} sub={`${fmtNumber(t.chats)} chats · ${fmtNumber(t.phones)} calls`} />
        <KpiTile label="Avg handle" value={fmtDuration(t.avgHandleMs)} sub={`median ${fmtDuration(t.medianHandleMs)}`} />
        <KpiTile label="Agents active" value={`${t.activeAgents}`} sub={`of ${t.headcount} rostered`} />
        <KpiTile label="Escalations" value={fmtNumber(t.escalations)} />
        <KpiTile
          label="Callbacks upcoming"
          value={fmtNumber(t.callbacksUpcoming)}
          sub={t.nextCallback?.scheduledTime
            ? `next ${fmtDate(Date.parse(t.nextCallback.scheduledTime))}${t.nextCallback.clientName ? ` — ${t.nextCallback.clientName}` : ''}`
            : undefined}
        />
        <KpiTile label="Live conversations recorded" value={fmtNumber(t.realConversations)} sub="in this window" />
      </div>
    </div>
  );
}
