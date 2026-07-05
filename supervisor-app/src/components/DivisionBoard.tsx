import { theme } from '../theme';
import { DivisionRollup } from '../types';
import { fmtDuration, fmtNumber } from '../util';

export function DivisionBoard({
  divisions, active, onSelect,
}: {
  divisions: DivisionRollup[];
  active: string | null;
  onSelect: (d: string | null) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {divisions.map(d => {
        const selected = active === d.division;
        return (
          <button
            key={d.division}
            onClick={() => onSelect(selected ? null : d.division)}
            style={{
              flex: '1 1 150px', minWidth: 150, textAlign: 'left', cursor: 'pointer',
              background: selected ? theme.color.primarySoft : theme.color.surface,
              border: `1px solid ${selected ? theme.color.primarySoftBorder : theme.color.border}`,
              borderRadius: theme.radius.lg, padding: '12px 14px', boxShadow: theme.shadow.sm,
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.color.primary, marginBottom: 6, lineHeight: 1.25 }}>
              {d.division}
            </div>
            <div style={{ fontSize: 12, color: theme.color.textMuted, display: 'grid', gap: 2 }}>
              <span>{fmtNumber(d.conversations)} conversations</span>
              <span>{d.headcount} agents · {d.licensedCount} licensed</span>
              <span>avg handle {fmtDuration(d.avgHandleMs)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
