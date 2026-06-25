import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { theme } from '../theme';
import { Avatar, Button, Chip, SectionLabel, Overlay, panel } from './ui';
import { initials } from '../util';

const RING_SECONDS = 30;

export function IncomingCallOverlay() {
  const call = useStore(s => s.call);
  const accept = useStore(s => s.accept);
  const decline = useStore(s => s.decline);
  const [left, setLeft] = useState(RING_SECONDS);

  const ringing = call?.phase === 'ringing';
  const callbackId = call?.item.callbackId;

  useEffect(() => {
    if (!ringing) return;
    setLeft(RING_SECONDS);
    const t = setInterval(() => {
      setLeft(l => { if (l <= 1) { clearInterval(t); decline(); return 0; } return l - 1; });
    }, 1000);
    return () => clearInterval(t);
  }, [ringing, callbackId, decline]);

  if (!ringing || !call) return null;
  const d = call.dossier;
  const previewBullets = d ? (d.coaching.length ? d.coaching : [d.research.summary]).slice(0, 3) : [];

  return (
    <Overlay>
      <div style={{ ...panel, width: '100%', maxWidth: 460, textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.color.accent }}>
          Incoming scheduled callback
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0 12px' }}>
          <span className="pa-pulse"><Avatar initials={initials(call.item.clientName || '?')} size={72} /></span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: theme.font.serif, color: theme.color.text }}>{call.item.clientName}</div>
        <div style={{ fontSize: 14, color: theme.color.textMuted, marginTop: 4 }}>{call.item.intentSummary}</div>

        <div style={{ textAlign: 'left', background: theme.color.surfaceMuted, borderRadius: theme.radius.md, padding: '12px 14px', margin: '16px 0' }}>
          <SectionLabel>Before you pick up</SectionLabel>
          {d ? (
            <>
              <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {previewBullets.map((c, i) => <li key={i} style={{ fontSize: 13, lineHeight: 1.45 }}>{c}</li>)}
              </ul>
              {!d.research.answeredFully && <div style={{ marginTop: 8 }}><Chip tone="warning">Has open items — review the dossier</Chip></div>}
            </>
          ) : <div style={{ fontSize: 13, color: theme.color.textSubtle }}>Loading context…</div>}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button tone="ghost" onClick={decline}>Decline</Button>
          <Button tone="success" big onClick={accept}>Accept&nbsp;·&nbsp;{left}s</Button>
        </div>
      </div>
    </Overlay>
  );
}
