import { theme } from '../theme';
import { RecentRow } from '../types';
import { fmtDate, fmtDuration, transcriptUrl } from '../util';

export function RecentTable({ rows }: { rows: RecentRow[] }) {
  return (
    <div style={{
      background: theme.color.surface, border: `1px solid ${theme.color.border}`,
      borderRadius: theme.radius.lg, boxShadow: theme.shadow.sm, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px 6px', fontFamily: theme.font.serif, fontSize: 15, fontWeight: 700, color: theme.color.primary }}>
        Recent conversations
        <span style={{ fontFamily: theme.font.sans, fontSize: 12, fontWeight: 500, color: theme.color.textMuted, marginLeft: 8 }}>
          live recordings · opens Transcript Review
        </span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '10px 16px 16px', fontSize: 12.5, color: theme.color.textSubtle }}>
          No recorded conversations in this window.
        </div>
      ) : (
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {rows.map(r => (
            <a
              key={r.transcriptId}
              href={transcriptUrl(r.transcriptId)}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block', padding: '10px 16px', textDecoration: 'none',
                borderBottom: `1px solid ${theme.color.surfaceMuted}`,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = theme.color.surfaceWell; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: theme.color.text }}>
                  {r.transcriptType === 'phone' ? '📞' : '💬'} {r.clientName ?? 'Client'}
                </span>
                <span style={{ fontSize: 11, color: theme.color.textSubtle, whiteSpace: 'nowrap' }}>{fmtDate(r.savedAt)}</span>
              </div>
              <div style={{
                fontSize: 12, color: theme.color.textMuted, marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {r.intentSummary ?? '—'}
              </div>
              <div style={{ fontSize: 11, color: theme.color.textSubtle, marginTop: 2 }}>
                {r.agentName ?? 'Unassigned'}{r.wrapUpCode ? ` · ${r.wrapUpCode}` : ''}{r.durationMs ? ` · ${fmtDuration(r.durationMs)}` : ''}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
