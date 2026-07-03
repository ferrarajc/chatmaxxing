import { useState } from 'react';
import { AccessGate } from './AccessGate';
import { theme } from './theme';
import { WindowKey } from './types';
import { useStats } from './hooks/useStats';
import { useInsights } from './hooks/useInsights';
import { KpiHeader } from './components/KpiHeader';
import { DivisionBoard } from './components/DivisionBoard';
import { MixCharts } from './components/MixCharts';
import { AgentRoster } from './components/AgentRoster';
import { InsightsPanel } from './components/InsightsPanel';
import { RecentTable } from './components/RecentTable';

function Dashboard() {
  const [windowKey, setWindowKey] = useState<WindowKey>('all');
  const [division, setDivision] = useState<string | null>(null);
  const { stats, loading, error } = useStats(windowKey, division);
  const { insights, loading: insightsLoading, refresh } = useInsights(windowKey, division, !!stats);

  return (
    <div style={{ minHeight: '100vh', background: theme.color.bg, fontFamily: theme.font.sans }}>
      {/* Top bar */}
      <header style={{
        background: theme.color.primary, color: theme.color.textOnPrimary,
        padding: '14px 28px', display: 'flex', alignItems: 'baseline', gap: 12,
      }}>
        <span style={{ fontFamily: theme.font.serif, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em' }}>
          Bob's Mutual Funds
        </span>
        <span style={{ fontSize: 13, opacity: 0.75, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>
          Supervisor Console
        </span>
      </header>

      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '22px 24px 48px', display: 'grid', gap: 16 }}>
        {error && (
          <div style={{
            background: theme.color.dangerSoft, border: `1px solid ${theme.color.danger}`,
            borderRadius: theme.radius.md, padding: '12px 16px', fontSize: 13.5, color: theme.color.danger,
          }}>
            {error === 'not-seeded'
              ? 'The agent roster has not been seeded in this environment yet — run the reset-agents endpoint, then reload.'
              : `Couldn't load dashboard data: ${error}`}
          </div>
        )}

        {loading && !stats && (
          <div className="sup-shimmer" style={{ display: 'grid', gap: 12 }}>
            {[64, 220, 180].map((h, i) => (
              <div key={i} style={{ height: h, borderRadius: theme.radius.lg, background: theme.color.surfaceMuted }} />
            ))}
          </div>
        )}

        {stats && (
          <>
            <KpiHeader
              stats={stats} windowKey={windowKey} onWindow={setWindowKey}
              division={division} onDivision={setDivision}
            />

            <DivisionBoard divisions={stats.divisions} active={division} onSelect={setDivision} />

            <MixCharts stats={stats} />

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 16, alignItems: 'start' }}>
              <AgentRoster agents={stats.agents} agentThemes={insights?.agentThemes ?? {}} />
              <div style={{ display: 'grid', gap: 16 }}>
                <InsightsPanel insights={insights} loading={insightsLoading} onRefresh={refresh} />
                <RecentTable rows={stats.recent} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AccessGate>
      <Dashboard />
    </AccessGate>
  );
}
