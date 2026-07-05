import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { theme } from '../theme';
import { AgentStats } from '../types';
import { fmtDuration, fmtNumber, tenure } from '../util';

type SortKey = 'volume' | 'name' | 'division' | 'avgHandleMs' | 'qaScore';

function LicenseBadges({ licenses }: { licenses: string[] }) {
  if (!licenses.length) {
    return <span style={{ fontSize: 11, color: theme.color.textSubtle }}>Non-licensed</span>;
  }
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {licenses.map(l => (
        <span key={l} style={{
          fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: theme.radius.pill,
          background: theme.color.accentSoft, color: theme.color.accent, border: `1px solid ${theme.color.warningBorder}`,
          whiteSpace: 'nowrap',
        }}>{l}</span>
      ))}
    </span>
  );
}

function AgentDrawer({ agent, theme_, themeLine, onClose }: {
  agent: AgentStats; theme_: typeof theme; themeLine: string | undefined; onClose: () => void;
}) {
  const trendData = agent.trend.map(t => ({ label: t.weekStart.slice(5), total: t.chats + t.calls }));
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(8,20,41,0.35)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 400, maxWidth: '92vw', height: '100%', background: theme_.color.surface,
          boxShadow: theme_.shadow.xl, padding: '22px 24px', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: theme_.font.serif, fontSize: 21, fontWeight: 700, color: theme_.color.primary }}>{agent.name}</div>
            <div style={{ fontSize: 13, color: theme_.color.textMuted, marginTop: 2 }}>{agent.title} · {agent.division}</div>
            <div style={{ fontSize: 12, color: theme_.color.textSubtle, marginTop: 2 }}>
              {agent.location} · {tenure(agent.hireDate)} tenure{agent.status === 'leave' ? ' · on leave' : ''}
            </div>
          </div>
          <button onClick={onClose} style={{
            border: 'none', background: theme_.color.surfaceMuted, borderRadius: theme_.radius.pill,
            width: 30, height: 30, cursor: 'pointer', fontSize: 15, color: theme_.color.textMuted,
          }}>×</button>
        </div>

        <div style={{ marginTop: 12 }}><LicenseBadges licenses={agent.licenses} /></div>

        {themeLine && (
          <div style={{
            marginTop: 14, padding: '10px 12px', background: theme_.color.primarySoft,
            border: `1px solid ${theme_.color.primarySoftBorder}`, borderRadius: theme_.radius.md,
            fontSize: 12.5, color: theme_.color.primary, lineHeight: 1.5,
          }}>
            <span style={{ fontWeight: 700 }}>AI-observed: </span>{themeLine}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          {[
            ['Conversations', fmtNumber(agent.chats + agent.calls)],
            ['Avg handle', fmtDuration(agent.avgHandleMs)],
            ['QA score', agent.qaScore != null ? `${agent.qaScore}` : '—'],
            ['Escalations', fmtNumber(agent.escalations)],
          ].map(([label, value]) => (
            <div key={label} style={{
              flex: '1 1 40%', background: theme_.color.surfaceWell, borderRadius: theme_.radius.md,
              padding: '10px 12px', border: `1px solid ${theme_.color.border}`,
            }}>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme_.color.textSubtle, fontWeight: 600 }}>{label}</div>
              <div style={{ fontFamily: theme_.font.serif, fontSize: 19, fontWeight: 700, color: theme_.color.primary, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700, color: theme_.color.primary, fontFamily: theme_.font.serif }}>
          Weekly volume (last 12 weeks)
        </div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={trendData} margin={{ top: 8, right: 0, left: -24, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: theme_.color.textMuted }} tickLine={false} axisLine={{ stroke: theme_.color.border }} interval={1} />
            <YAxis tick={{ fontSize: 9.5, fill: theme_.color.textMuted }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${theme_.color.border}` }} />
            <Bar dataKey="total" name="Conversations" fill={theme_.color.primary} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: theme_.color.primary, fontFamily: theme_.font.serif }}>
          Top wrap-ups in window
        </div>
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          {agent.topWrapUps.length ? agent.topWrapUps.map(w => (
            <div key={w.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: theme.color.text }}>
              <span>{w.code}</span>
              <span style={{ color: theme.color.textMuted, fontVariantNumeric: 'tabular-nums' }}>{fmtNumber(w.count)}</span>
            </div>
          )) : <div style={{ fontSize: 12.5, color: theme.color.textSubtle }}>No activity in this window.</div>}
        </div>
      </div>
    </div>
  );
}

export function AgentRoster({ agents, agentThemes }: {
  agents: AgentStats[];
  agentThemes: Record<string, string>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [asc, setAsc] = useState(false);
  const [selected, setSelected] = useState<AgentStats | null>(null);
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    const arr = [...agents];
    const dir = asc ? 1 : -1;
    arr.sort((x, y) => {
      switch (sortKey) {
        case 'name': return dir * x.name.localeCompare(y.name);
        case 'division': return dir * (x.division.localeCompare(y.division) || x.name.localeCompare(y.name));
        case 'avgHandleMs': return dir * (x.avgHandleMs - y.avgHandleMs);
        case 'qaScore': return dir * ((x.qaScore ?? -1) - (y.qaScore ?? -1));
        default: return dir * ((x.chats + x.calls) - (y.chats + y.calls));
      }
    });
    return arr;
  }, [agents, sortKey, asc]);

  const visible = showAll ? sorted : sorted.slice(0, 15);

  const header = (label: string, key: SortKey, align: 'left' | 'right' = 'left') => (
    <th
      onClick={() => { if (sortKey === key) setAsc(!asc); else { setSortKey(key); setAsc(key === 'name' || key === 'division'); } }}
      style={{
        textAlign: align, padding: '8px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
        textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.color.textSubtle,
        borderBottom: `1px solid ${theme.color.border}`, whiteSpace: 'nowrap', userSelect: 'none',
      }}
    >
      {label}{sortKey === key ? (asc ? ' ▲' : ' ▼') : ''}
    </th>
  );

  const td = (align: 'left' | 'right' | 'center' = 'left'): CSSProperties => ({
    padding: '9px 10px', fontSize: 12.5, textAlign: align,
    borderBottom: `1px solid ${theme.color.surfaceMuted}`, verticalAlign: 'middle',
  });

  return (
    <div style={{
      background: theme.color.surface, border: `1px solid ${theme.color.border}`,
      borderRadius: theme.radius.lg, boxShadow: theme.shadow.sm, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px 6px', fontFamily: theme.font.serif, fontSize: 15, fontWeight: 700, color: theme.color.primary }}>
        Agent roster
        <span style={{ fontFamily: theme.font.sans, fontSize: 12, fontWeight: 500, color: theme.color.textMuted, marginLeft: 8 }}>
          {agents.length} agents · click a row for detail
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {header('Agent', 'name')}
              {header('Division', 'division')}
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.color.textSubtle, borderBottom: `1px solid ${theme.color.border}` }}>Licenses</th>
              {header('Volume', 'volume', 'right')}
              {header('Avg handle', 'avgHandleMs', 'right')}
              {header('QA', 'qaScore', 'right')}
            </tr>
          </thead>
          <tbody>
            {visible.map(ag => (
              <tr
                key={ag.agentUsername}
                onClick={() => setSelected(ag)}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = theme.color.surfaceWell; }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
              >
                <td style={td()}>
                  <div style={{ fontWeight: 600, color: theme.color.text }}>
                    {ag.name}
                    {ag.realCount > 0 && (
                      <span title="Includes live recorded conversations" style={{
                        marginLeft: 6, fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: theme.radius.pill,
                        background: theme.color.successSoft, color: theme.color.success, border: `1px solid ${theme.color.successBorder}`,
                      }}>LIVE</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: theme.color.textSubtle }}>{ag.title}</div>
                </td>
                <td style={td()}>{ag.division}</td>
                <td style={td()}><LicenseBadges licenses={ag.licenses} /></td>
                <td style={{ ...td('right'), fontVariantNumeric: 'tabular-nums' }}>
                  {fmtNumber(ag.chats + ag.calls)}
                  <div style={{ fontSize: 10.5, color: theme.color.textSubtle }}>{fmtNumber(ag.chats)}c / {fmtNumber(ag.calls)}p</div>
                </td>
                <td style={{ ...td('right'), fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(ag.avgHandleMs)}</td>
                <td style={{ ...td('right'), fontVariantNumeric: 'tabular-nums' }}>{ag.qaScore ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > 15 && (
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            width: '100%', border: 'none', borderTop: `1px solid ${theme.color.border}`,
            background: theme.color.surfaceWell, padding: '9px 0', fontSize: 12.5, fontWeight: 600,
            color: theme.color.primary, cursor: 'pointer',
          }}
        >
          {showAll ? 'Show top 15' : `Show all ${sorted.length} agents`}
        </button>
      )}

      {selected && (
        <AgentDrawer
          agent={selected}
          theme_={theme}
          themeLine={agentThemes[selected.agentUsername]}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
