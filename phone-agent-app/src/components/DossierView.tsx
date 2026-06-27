import React, { useState } from 'react';
import { useStore } from '../store';
import { useNow, fmtCountdown, fmtScheduled, fmtMoney, initials } from '../util';
import { theme } from '../theme';
import { card, Chip, Button, Avatar, SectionLabel, h2Style } from './ui';
import { IntentHeader, GuidedScript } from './GuidedScript';
import { TranscriptButton, TranscriptPanel } from './TranscriptFlipper';
import type { Dossier } from '../types';

function Empty({ text }: { text: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.color.textSubtle, fontSize: 14 }}>
      {text}
    </div>
  );
}

export function DossierView() {
  const selected = useStore(s => s.selected);
  const loading = useStore(s => s.selectedLoading);
  const selectedId = useStore(s => s.selectedId);
  const ring = useStore(s => s.ring);
  const now = useNow(1000);
  const [showTx, setShowTx] = useState(false);

  if (!selectedId) return <Empty text="Select a call from the board to open its dossier." />;
  if (loading && !selected) return <Empty text="Loading dossier…" />;
  if (!selected) return <Empty text="Could not load this call." />;

  const d = selected.dossier;
  const researching = !d || selected.dossierStatus !== 'ready';
  const transcript = d?.originTranscript;

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingRight: 6 }}>
      <div style={{ ...card, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Avatar initials={initials(selected.clientName || '?')} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...h2Style(), fontSize: 20 }}>{selected.clientName}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: theme.color.textSubtle }}>{fmtScheduled(selected.scheduledTime)}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: theme.color.accent, fontVariantNumeric: 'tabular-nums' }}>
              {fmtCountdown(selected.scheduledTime, now)}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button onClick={() => void ring(selected)} big>▶ Simulate this call</Button>
          {transcript && !showTx && <TranscriptButton transcript={transcript} onClick={() => setShowTx(true)} />}
        </div>
      </div>

      {showTx && transcript ? (
        <TranscriptPanel transcript={transcript} onBack={() => setShowTx(false)} />
      ) : researching ? (
        <div style={{ ...card, padding: '30px 20px', textAlign: 'center', color: theme.color.textMuted }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>⏳ Researching the client's ask…</div>
          <div style={{ fontSize: 13 }}>Bob's AI is pulling the account data and working out the answer — it'll be ready before the call.</div>
        </div>
      ) : (
        <>
          <IntentHeader intent={d!.intent} />
          <DossierBody d={d!} />
          <div style={{ marginTop: 16 }}>
            <GuidedScript gs={d!.guidedScript} />
          </div>
        </>
      )}
    </div>
  );
}

/** The dossier content — reused on the dossier pane and inside the live-call console. */
export function DossierBody({ d, compact }: { d: Dossier; compact?: boolean }) {
  const snap = d.clientSnapshot;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* What we worked out */}
      <div style={{ ...card, padding: '16px 18px', borderLeft: `3px solid ${theme.color.success}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <SectionLabel>What we worked out</SectionLabel>
          <Chip tone={d.research.answeredFully ? 'success' : 'warning'}>
            {d.research.answeredFully ? '✓ Fully answered' : 'Partially answered'}
          </Chip>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.55, color: theme.color.text }}>{d.research.summary}</p>
        {d.research.findings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.research.findings.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span style={{ color: theme.color.success, fontSize: 13, lineHeight: 1.5 }}>●</span>
                <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700 }}>{f.point}:</span> {f.detail}
                  {f.source && <span style={{ marginLeft: 6, fontSize: 11, color: theme.color.textSubtle, fontFamily: theme.font.mono }}>[{f.source}]</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Still open / needs you */}
      {d.research.openItems.length > 0 && (
        <div style={{ ...card, padding: '16px 18px', background: theme.color.warningSoft, borderColor: theme.color.warningBorder }}>
          <SectionLabel>Still open · needs you</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 2 }}>
            {d.research.openItems.map((o, i) => (
              <div key={i} style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, color: theme.color.text }}>{o.question}</div>
                <div style={{ color: theme.color.textMuted }}>{o.why}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client snapshot */}
      <div style={{ ...card, padding: '16px 18px' }}>
        <SectionLabel>Client snapshot</SectionLabel>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <Stat label="Total portfolio" value={fmtMoney(snap.totalBalance)} />
          {snap.riskProfile && <Stat label="Risk profile" value={snap.riskProfile} />}
          {snap.memberSince && <Stat label="Member since" value={snap.memberSince.slice(0, 4)} />}
        </div>
        <div style={{ fontSize: 13, color: theme.color.textMuted, marginTop: 10 }}>{snap.accountsSummary}</div>
      </div>

      {/* Coaching */}
      {d.coaching.length > 0 && (
        <div style={{ ...card, padding: '16px 18px' }}>
          <SectionLabel>Coaching for this call</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.coaching.map((c, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.5, color: theme.color.text }}>{c}</li>)}
          </ul>
        </div>
      )}

      {/* Resources */}
      {!compact && d.resources.length > 0 && (
        <div style={{ ...card, padding: '16px 18px' }}>
          <SectionLabel>Resources on hand</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.resources.map(r => (
              <a key={r.id} href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 13.5, color: theme.color.primary, textDecoration: 'none' }}>
                ↗ {r.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: theme.color.text }}>{value}</div>
    </div>
  );
}
