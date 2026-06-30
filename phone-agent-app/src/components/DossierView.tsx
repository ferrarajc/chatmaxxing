import React, { useState } from 'react';
import { useStore } from '../store';
import { useNow, fmtCountdown, fmtScheduled, fmtMoney, initials } from '../util';
import { theme } from '../theme';
import { card, Chip, Avatar, SectionLabel, h2Style } from './ui';
import { ScriptPreview } from './GuidedScript';
import { OriginalTranscriptCard, FlipperRow } from './TranscriptFlipper';
import { AfterCallWork } from './AfterCallWork';
import type { Dossier, IntentBrief, OriginTranscript } from '../types';

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
  const call = useStore(s => s.call);
  const ring = useStore(s => s.ring);
  const now = useNow(1000);

  // A finished call shows after-call work in the dossier (not the prep view, which would let you
  // re-simulate a completed call).
  if (call?.phase === 'wrapup') return <AfterCallWork />;

  // During a live call the board is gone, so the right column tracks the active call's dossier;
  // otherwise it tracks the board selection being prepped.
  const live = call?.phase === 'live';
  const item = live ? call!.item : selected;
  const dossier = live ? call!.dossier : selected?.dossier;
  const callbackId = item?.callbackId ?? '';

  if (!live) {
    if (!selectedId) return <Empty text="Select a call from the board to open its dossier." />;
    if (loading && !selected) return <Empty text="Loading dossier…" />;
    if (!selected) return <Empty text="Could not load this call." />;
  }
  if (!item) return <Empty text="Loading…" />;

  const researching = !dossier || (!live && selected!.dossierStatus !== 'ready');
  const due = new Date(item.scheduledTime).getTime() - now < 1000;

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingRight: 6 }}>
      {/* Top card — name; countdown + Simulate top-right; Client snapshot flipper below */}
      <div style={{ ...card, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Avatar initials={initials(item.clientName || '?')} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...h2Style(), fontSize: 20 }}>{item.clientName}</div>
          </div>
          {live ? (
            <div style={{ fontSize: 13.5, fontWeight: 800, color: theme.color.success, display: 'flex', alignItems: 'center', gap: 7 }}>
              <span className="pa-speaking" style={{ width: 9, height: 9, borderRadius: '50%', background: theme.color.success, display: 'inline-block' }} />
              On call now
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
                <div style={{ fontSize: 12, color: theme.color.textSubtle }}>{fmtScheduled(item.scheduledTime)}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: due ? theme.color.accent : theme.color.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                  {due ? 'Now' : `rings in ${fmtCountdown(item.scheduledTime, now)}`}
                </div>
              </div>
              <SimulateButton due={due} onClick={() => void ring(selected!)} />
            </>
          )}
        </div>

        {!researching && dossier && (
          <div style={{ marginTop: 14, borderTop: `1px solid ${theme.color.border}`, paddingTop: 14 }}>
            <FlipperRow label="Client snapshot" embedded right={<span style={{ fontSize: 12, color: theme.color.textMuted }}>{fmtMoney(dossier.clientSnapshot.totalBalance)}</span>}>
              <SnapshotBody snap={dossier.clientSnapshot} />
            </FlipperRow>
          </div>
        )}
      </div>

      {researching ? (
        <div style={{ ...card, padding: '30px 20px', textAlign: 'center', color: theme.color.textMuted }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>⏳ Researching the client's ask…</div>
          <div style={{ fontSize: 13 }}>Bob's AI is pulling the account data and working out the answer — it'll be ready before the call.</div>
        </div>
      ) : (
        <>
          <IntentTranscriptCard intent={dossier!.intent} transcript={dossier!.originTranscript} />
          <DossierBody d={dossier!} />
          <div style={{ marginTop: 16 }}>
            <ScriptPreview callbackId={callbackId} gs={dossier!.guidedScript} />
          </div>
        </>
      )}
    </div>
  );
}

/** Looks disabled until the call is due, but stays clickable so demos can simulate at will. */
function SimulateButton({ due, onClick }: { due: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={due ? 'Start the call' : 'In production this unlocks when the call is due — enabled now for the demo'}
      style={{
        flexShrink: 0, whiteSpace: 'nowrap',
        background: due ? theme.color.primary : '#DCDCDC',
        color: due ? '#fff' : '#AEAEAE',
        border: due ? 'none' : '1px solid #D2D2D2',
        borderRadius: theme.radius.md, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
      }}
    >▶ Simulate this call</button>
  );
}

/** The client's objective with the originating transcript flipper attached below a divider. */
function IntentTranscriptCard({ intent, transcript }: { intent: IntentBrief; transcript?: OriginTranscript }) {
  const detail = (intent.detail ?? []).filter(Boolean);
  return (
    <div style={{ ...card, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontFamily: theme.font.serif, fontSize: 27, fontWeight: 800, lineHeight: 1.25, color: theme.color.text, letterSpacing: '-0.01em' }}>
        {intent.headline}
      </div>
      {detail.length === 1 && <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.55, color: theme.color.textMuted }}>{detail[0]}</p>}
      {detail.length > 1 && (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {detail.map((d, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.5, color: theme.color.textMuted }}>{d}</li>)}
        </ul>
      )}
      {transcript && (
        <>
          <div style={{ borderTop: `1px solid ${theme.color.border}`, margin: '14px -18px 0' }} />
          <div style={{ paddingTop: 12 }}>
            <OriginalTranscriptCard transcript={transcript} embedded />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The research brief, all in one card: summary + findings, then "Still open" (a card-in-card), then
 * Recommended resources laid out horizontally, a divider, and finally Coaching.
 */
export function DossierBody({ d }: { d: Dossier }) {
  return (
    <div style={{ ...card, padding: '16px 18px', borderLeft: `3px solid ${theme.color.success}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.color.textMuted }}>What I found for you</span>
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

      {/* Still open — a card within the card */}
      {d.research.openItems.length > 0 && (
        <div style={{ marginTop: 14, background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}`, borderRadius: theme.radius.md, padding: '12px 14px' }}>
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

      {/* Recommended resources — horizontal, wrapping */}
      {d.resources.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <SectionLabel>Recommended resources</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {d.resources.map(r => (
              <div key={r.id} style={{ flex: '1 1 210px', maxWidth: 320, minWidth: 0 }}>
                <ResourceTile title={r.title} url={r.url} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coaching */}
      {d.coaching.length > 0 && (
        <>
          <div style={{ borderTop: `1px solid ${theme.color.border}`, margin: '16px -18px 12px' }} />
          <SectionLabel>Coaching for this call</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.coaching.map((c, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.5, color: theme.color.text }}>{c}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}

/** Roomy stat grid + accounts line — used inside the Client snapshot flipper. */
function SnapshotBody({ snap }: { snap: Dossier['clientSnapshot'] }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 16px' }}>
        <Stat label="Total portfolio" value={fmtMoney(snap.totalBalance)} />
        {snap.accountCount != null && <Stat label="Accounts" value={String(snap.accountCount)} />}
        {snap.riskProfile && <Stat label="Risk profile" value={snap.riskProfile} />}
        {snap.timeHorizon && <Stat label="Time horizon" value={snap.timeHorizon} />}
        {snap.investmentExperience && <Stat label="Experience" value={snap.investmentExperience} />}
        {snap.memberSince && <Stat label="Member since" value={snap.memberSince.slice(0, 4)} />}
      </div>
      <div style={{ fontSize: 13, color: theme.color.textMuted, marginTop: 12 }}>{snap.accountsSummary}</div>
    </div>
  );
}

/** A tactile, obviously-clickable resource tile (whole row links out in a new tab). */
function ResourceTile({ title, url }: { title: string; url: string }) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={url} target="_blank" rel="noreferrer"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', width: '100%', boxSizing: 'border-box',
        background: hover ? theme.color.primarySoft : theme.color.surfaceWell,
        border: `1px solid ${hover ? theme.color.primarySoftBorder : theme.color.border}`,
        borderRadius: theme.radius.md, padding: '10px 12px',
        boxShadow: hover ? theme.shadow.md : 'none', transform: hover ? 'translateY(-1px)' : 'none',
        transition: 'transform .12s, box-shadow .12s, background .12s',
      }}
    >
      <div style={{
        width: 30, height: 30, flexShrink: 0, borderRadius: theme.radius.md, background: theme.color.primary, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
      }}>📄</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: 11, color: theme.color.textMuted }}>Reference · new tab</div>
      </div>
      <span style={{ fontSize: 14, color: theme.color.primary, fontWeight: 700 }}>↗</span>
    </a>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: theme.color.text, marginTop: 3 }}>{value}</div>
    </div>
  );
}
