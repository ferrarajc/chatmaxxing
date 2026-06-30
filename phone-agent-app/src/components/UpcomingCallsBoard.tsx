import { useState } from 'react';
import { useUpcomingCallbacks } from '../hooks/useUpcomingCallbacks';
import { useStore } from '../store';
import { useNow, fmtCountdown, fmtScheduled, initials } from '../util';
import { theme } from '../theme';
import { card, Chip, Button, Avatar, SectionLabel } from './ui';
import { post } from '../api/client';

export function UpcomingCallsBoard() {
  const { callbacks, loading, refresh } = useUpcomingCallbacks();
  const now = useNow(1000);
  const selectedId = useStore(s => s.selectedId);
  const select = useStore(s => s.select);
  const ring = useStore(s => s.ring);
  const [seeding, setSeeding] = useState(false);

  const addDemo = async () => {
    setSeeding(true);
    try { await post('/agent-callbacks', { action: 'seed-demo' }); await refresh(); }
    catch { /* ignore */ } finally { setSeeding(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <SectionLabel>Upcoming Calls</SectionLabel>
          <div style={{ fontSize: 13, color: theme.color.textMuted }}>{callbacks.length} scheduled</div>
        </div>
        <Button tone="ghost" onClick={addDemo} disabled={seeding}>{seeding ? 'Adding…' : '+ Demo call'}</Button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
        {loading && callbacks.length === 0 && <div style={{ fontSize: 13, color: theme.color.textSubtle }}>Loading…</div>}
        {!loading && callbacks.length === 0 && (
          <div style={{ ...card, padding: 20, fontSize: 13, color: theme.color.textMuted, textAlign: 'center' }}>
            No upcoming calls. Add a demo call to see the cockpit in action.
          </div>
        )}
        {callbacks.map(cb => {
          const ready = cb.dossierStatus === 'ready';
          const isSel = cb.callbackId === selectedId;
          const soon = new Date(cb.scheduledTime).getTime() - now < 60_000;
          return (
            <div key={cb.callbackId} data-testid="call-card" onClick={() => select(cb.callbackId)} style={{
              ...card, padding: '14px 16px', cursor: 'pointer',
              borderColor: isSel ? theme.color.primary : theme.color.border,
              boxShadow: isSel ? theme.shadow.md : theme.shadow.sm,
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <Avatar initials={initials(cb.clientName || '?')} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{cb.clientName || 'Client'}</span>
                    {ready
                      ? <Chip tone={cb.answeredFully ? 'success' : 'primary'}>{cb.answeredFully ? '✓ Researched' : 'Prepped'}</Chip>
                      : <Chip tone="warning">⏳ Researching…</Chip>}
                  </div>
                  <div style={{ fontSize: 13, color: theme.color.textMuted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cb.intentSummary}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: theme.color.textSubtle }}>{fmtScheduled(cb.scheduledTime)}</span>
                    <Chip tone={soon ? 'accent' : 'neutral'}>rings in {fmtCountdown(cb.scheduledTime, now)}</Chip>
                    <button onClick={e => { e.stopPropagation(); void ring(cb); }} style={{
                      marginLeft: 'auto', background: theme.color.primary, color: '#fff', border: 'none',
                      borderRadius: theme.radius.md, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>▶ Simulate</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
