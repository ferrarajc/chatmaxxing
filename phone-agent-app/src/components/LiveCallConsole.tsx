import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { theme } from '../theme';
import { Avatar, Button, SectionLabel, Overlay, panel, h2Style } from './ui';
import { initials } from '../util';
import { speak, stopSpeaking } from '../voiceTts';
import { useVoiceSettings } from '../voiceSettings';
import { DossierBody } from './DossierView';

type Who = 'system' | 'bob' | 'client';
interface Stage { who: Who; text: string }

function buildStages(name: string, phone: string): Stage[] {
  const display = phone && phone.length === 10 ? `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}` : phone;
  return [
    { who: 'system', text: `Placing call to ${display || name}…` },
    { who: 'system', text: 'Ringing…' },
    { who: 'client', text: '“Hello?”' },
    { who: 'bob', text: `Hi, this is a scheduled callback from Bob's Mutual Funds. Am I speaking with ${name}?` },
    { who: 'client', text: '“Yes, this is.”' },
    { who: 'bob', text: `Great. To confirm your identity, please repeat: "At Bob's, my voice is my password."` },
    { who: 'client', text: "“At Bob's, my voice is my password.”" },
    { who: 'system', text: '✓ Voice verified (simulated)' },
    { who: 'bob', text: 'Identity confirmed. Hang on one moment while I connect you.' },
  ];
}

export function LiveCallConsole() {
  const call = useStore(s => s.call);
  const phase = call?.phase;
  const vvStage = useStore(s => s.vvStage);
  const setVvStage = useStore(s => s.setVvStage);
  const connect = useStore(s => s.connect);
  const endCall = useStore(s => s.endCall);
  const dismissCall = useStore(s => s.dismissCall);
  const audioOn = useStore(s => s.audioOn);
  const setAudioOn = useStore(s => s.setAudioOn);
  const openVoicePanel = useVoiceSettings(s => s.openPanel);

  const name = call?.item.clientName || 'the client';
  const stages = useMemo(() => buildStages(name, call?.item.phoneNumber || ''), [name, call?.item.phoneNumber]);

  // Drive the mock voice-verification while connecting.
  useEffect(() => {
    if (phase !== 'connecting') return;
    if (vvStage >= stages.length) { const t = setTimeout(() => connect(), 500); return () => clearTimeout(t); }
    let cancelled = false;
    const stage = stages[vvStage];
    (async () => {
      if (stage.who === 'bob' && audioOn) await speak(stage.text);
      else await new Promise(r => setTimeout(r, stage.who === 'system' ? 1100 : 1500));
      if (!cancelled) setVvStage(vvStage + 1);
    })();
    return () => { cancelled = true; };
  }, [phase, vvStage, stages, audioOn, setVvStage, connect]);

  useEffect(() => () => stopSpeaking(), []);

  if (!call || !phase || phase === 'ringing') return null;

  return (
    <Overlay>
      <div style={{ ...panel, width: '100%', maxWidth: phase === 'live' ? 1000 : 560, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', background: theme.color.primary, color: '#fff' }}>
          <Avatar initials={initials(name)} size={40} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, fontFamily: theme.font.serif }}>{name}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {phase === 'connecting' ? 'Verifying identity…' : phase === 'live' ? 'On the call' : 'Call complete'}
            </div>
          </div>
          <button onClick={() => openVoicePanel(true)} title="Voice settings" style={{
            background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: theme.radius.md,
            padding: '6px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>⚙</button>
          <button onClick={() => setAudioOn(!audioOn)} title="Toggle voice" style={{
            background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: theme.radius.md,
            padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{audioOn ? '🔊 Voice on' : '🔇 Voice off'}</button>
        </div>

        {phase === 'connecting' && <Connecting stages={stages} vvStage={vvStage} />}
        {phase === 'live' && <LiveBody name={name} onEnd={() => void endCall()} />}
        {phase === 'wrapup' && <WrapUp name={name} onDone={dismissCall} />}
      </div>
    </Overlay>
  );
}

function Connecting({ stages, vvStage }: { stages: Stage[]; vvStage: number }) {
  const visible = stages.slice(0, Math.min(vvStage + 1, stages.length));
  return (
    <div style={{ flex: 1, minHeight: 320, padding: '20px 22px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((s, i) => {
          const speaking = i === vvStage && i === visible.length - 1 && s.who === 'bob';
          if (s.who === 'system') {
            return <div key={i} style={{ textAlign: 'center', fontSize: 12, color: theme.color.textSubtle }}>{s.text}</div>;
          }
          const isBob = s.who === 'bob';
          return (
            <div key={i} style={{ display: 'flex', justifyContent: isBob ? 'flex-start' : 'flex-end' }}>
              <div className={speaking ? 'pa-speaking' : ''} style={{
                maxWidth: '80%', padding: '10px 14px', borderRadius: theme.radius.lg, fontSize: 14, lineHeight: 1.45,
                background: isBob ? theme.color.primarySoft : theme.color.surfaceMuted, color: theme.color.text,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isBob ? theme.color.primary : theme.color.textMuted, marginBottom: 2 }}>
                  {isBob ? "Bob's (automated)" : 'Client'}
                </div>
                {s.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiveBody({ name, onEnd }: { name: string; onEnd: () => void }) {
  const dossier = useStore(s => s.call?.dossier);
  const [done, setDone] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setDone(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, padding: '18px 20px', overflowY: 'auto', borderRight: `1px solid ${theme.color.border}` }}>
          <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: theme.radius.md, padding: '8px 12px', fontSize: 13, color: theme.color.success, fontWeight: 600, marginBottom: 14 }}>
            ✓ Identity verified — you're connected with {name}.
          </div>
          <SectionLabel>Your script — tick as you go</SectionLabel>
          {dossier && (
            <>
              <div style={{ fontStyle: 'italic', fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>“{dossier.script.opening}”</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dossier.script.talkingPoints.map((p, i) => (
                  <label key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, cursor: 'pointer', opacity: done.has(i) ? 0.5 : 1 }}>
                    <input type="checkbox" checked={done.has(i)} onChange={() => toggle(i)} style={{ marginTop: 3 }} />
                    <span style={{ textDecoration: done.has(i) ? 'line-through' : 'none' }}>{p}</span>
                  </label>
                ))}
              </div>
              {dossier.research.openItems.length > 0 && (
                <div style={{ marginTop: 16, background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}`, borderRadius: theme.radius.md, padding: '10px 12px' }}>
                  <SectionLabel>Don't forget — open items</SectionLabel>
                  {dossier.research.openItems.map((o, i) => <div key={i} style={{ fontSize: 13, marginTop: i ? 6 : 2, fontWeight: 600 }}>{o.question}</div>)}
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ flex: 1, padding: '18px 20px', overflowY: 'auto', background: theme.color.bg }}>
          {dossier && <DossierBody d={dossier} compact />}
        </div>
      </div>
      <div style={{ padding: '14px 22px', borderTop: `1px solid ${theme.color.border}`, display: 'flex', justifyContent: 'flex-end' }}>
        <Button tone="danger" big onClick={onEnd}>End call</Button>
      </div>
    </>
  );
}

function WrapUp({ name, onDone }: { name: string; onDone: () => void }) {
  return (
    <div style={{ padding: '34px 26px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, color: theme.color.success }}>✓</div>
      <div style={{ ...h2Style(), fontSize: 20, marginTop: 6 }}>Call complete</div>
      <div style={{ fontSize: 14, color: theme.color.textMuted, margin: '8px 0 20px' }}>
        Your call with {name} is wrapped up and removed from the board.
      </div>
      <Button onClick={onDone} big>Back to board</Button>
    </div>
  );
}
