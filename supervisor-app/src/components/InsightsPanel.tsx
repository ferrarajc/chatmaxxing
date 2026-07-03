import { theme } from '../theme';
import { InsightsPayload } from '../types';

function TrendGlyph({ trend }: { trend: string }) {
  const map: Record<string, [string, string]> = {
    rising: ['↑', theme.color.success],
    new: ['●', theme.color.accent],
    steady: ['→', theme.color.textSubtle],
  };
  const [glyph, color] = map[trend] ?? map.steady;
  return <span style={{ color, fontWeight: 700, marginRight: 4 }}>{glyph}</span>;
}

export function InsightsPanel({ insights, loading, onRefresh }: {
  insights: InsightsPayload | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div style={{
      background: theme.color.primaryDeep, borderRadius: theme.radius.lg,
      padding: '16px 18px', color: theme.color.textOnPrimary, boxShadow: theme.shadow.md,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: theme.font.serif, fontSize: 15, fontWeight: 700 }}>
          ✦ AI operations digest
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Regenerate insights"
          style={{
            border: '1px solid rgba(251,249,244,0.3)', background: 'transparent', color: theme.color.textOnPrimary,
            borderRadius: theme.radius.pill, padding: '3px 12px', fontSize: 12, cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >⟳ Refresh</button>
      </div>

      {loading && (
        <div className="sup-shimmer" style={{ display: 'grid', gap: 8 }}>
          {[92, 100, 84, 60].map((w, i) => (
            <div key={i} style={{ height: 11, width: `${w}%`, borderRadius: 6, background: 'rgba(251,249,244,0.18)' }} />
          ))}
          <div style={{ fontSize: 11.5, color: 'rgba(251,249,244,0.55)', marginTop: 4 }}>Analyzing the window's conversations…</div>
        </div>
      )}

      {!loading && !insights?.digest && (
        <div style={{ fontSize: 12.5, color: 'rgba(251,249,244,0.6)' }}>
          AI insights are unavailable right now — the numbers above are unaffected.
        </div>
      )}

      {!loading && insights?.digest && (
        <>
          <div style={{ fontSize: 13, lineHeight: 1.65, color: 'rgba(251,249,244,0.92)' }}>{insights.digest}</div>

          {insights.topics.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(251,249,244,0.55)', margin: '14px 0 8px' }}>
                Emerging topics
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {insights.topics.map(t => (
                  <span key={t.theme} title={t.example} style={{
                    fontSize: 11.5, padding: '4px 11px', borderRadius: theme.radius.pill,
                    background: 'rgba(251,249,244,0.1)', border: '1px solid rgba(251,249,244,0.22)',
                  }}>
                    <TrendGlyph trend={t.trend} />{t.theme} <span style={{ opacity: 0.65 }}>({t.count})</span>
                  </span>
                ))}
              </div>
            </>
          )}

          <div style={{ fontSize: 10.5, color: 'rgba(251,249,244,0.4)', marginTop: 12 }}>
            Based on {insights.basedOnRealRows} recorded conversation{insights.basedOnRealRows === 1 ? '' : 's'} + workforce aggregates.
          </div>
        </>
      )}
    </div>
  );
}
