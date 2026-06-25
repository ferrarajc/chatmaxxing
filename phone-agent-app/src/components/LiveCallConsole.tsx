import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { theme } from '../theme';
import { Avatar, Button, SectionLabel, Overlay, panel, h2Style } from './ui';
import { initials } from '../util';
import { speak, stopSpeaking } from '../voiceTts';
import { listenForSpeech, stopListening, speechSupported } from '../speech';
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
  const micOn = useStore(s => s.micOn);
  const setMicOn = useStore(s => s.setMicOn);
  const openVoicePanel = useVoiceSettings(s => s.openPanel);

  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<Record<number, string>>({});

  const name = call?.item.clientName || 'the client';
  const stages = useMemo(() => buildStages(name, call?.item.phoneNumber || ''), [name, call?.item.phoneNumber]);

  // Fresh call → clear any prior recognized speech.
  useEffect(() => { setHeard({}); setListening(false); }, [call?.item.callbackId]);

  // Drive the mock voice-verification while connecting. On "client" turns, wait for the agent's
  // real microphone input (if mic is on + supported); otherwise fall back to the scripted timing.
  useEffect(() => {
    if (phase !== 'connecting') return;
    if (vvStage >= stages.length) { const t = setTimeout(() => connect(), 500); return () => clearTimeout(t); }
    let cancelled = false;
    const stage = stages[vvStage];
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
    (async () => {
      if (stage.who === 'bob') {
        if (audioOn) await speak(stage.text); else await wait(1500);
      } else if (stage.who === 'client' && micOn && speechSupported()) {
        setListening(true);
        const r = await listenForSpeech();
        if (cancelled) return;
        setListening(false);
        if (r.heard && r.transcript) setHeard(h => ({ ...h, [vvStage]: r.transcript }));
      } else {
        await wait(stage.who === 'system' ? 1100 : 1500);
      }
      if (!cancelled) setVvStage(vvStage + 1);
    })();
    return () => { cancelled = true; setListening(false); stopListening(); };
  }, [phase, vvStage, stages, audioOn, micOn, setVvStage, connect]);

  useEffect(() => () => { stopSpeaking(); stopListening(); }, []);

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
          <button onClick={() => setAudioOn(!audioOn)} title="Toggle Bob's spoken lines" style={{
            background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: theme.radius.md,
            padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{audioOn ? '🔊 Voice on' : '🔇 Voice off'}</button>
          <button onClick={() => setMicOn(!micOn)} title="Wait for your microphone on the client's turns" style={{
            background: micOn ? 'rgba(160,90,44,0.45)' : 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: theme.radius.md,
            padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{micOn ? '🎤 Mic on' : '🎤 Mic off'}</button>
        </div>

        {phase === 'connecting' && <Connecting stages={stages} vvStage={vvStage} listening={listening} heard={heard} />}
        {phase === 'live' && <LiveBody name={name} onEnd={() => void endCall()} />}
        {phase === 'wrapup' && <WrapUp name={name} onDone={dismissCall} />}
      </div>
    </Overlay>
  );
}

function Connecting({ stages, vvStage, listening, heard }: { stages: Stage[]; vvStage: number; listening: boolean; heard: Record<number, string> }) {
  const visible = stages.slice(0, Math.min(vvStage + 1, stages.length));
  return (
    <div style={{ flex: 1, minHeight: 320, padding: '20px 22px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((s, i) => {
          if (s.who === 'system') {
            return <div key={i} style={{ textAlign: 'center', fontSize: 12, color: theme.color.textSubtle }}>{s.text}</div>;
          }
          const isBob = s.who === 'bob';
          const isActive = i === vvStage && i === visible.length - 1;
          const isListeningHere = !isBob && isActive && listening && !heard[i];
          const speaking = (isActive && isBob) || isListeningHere;

          // Client bubble: prefer what was actually heard; else show the live listening prompt; else the scripted line.
          let content: React.ReactNode = s.text;
          if (!isBob) {
            if (heard[i]) content = `“${heard[i]}”`;
            else if (isListeningHere) content = '🎤 Listening… go ahead and speak';
          }

          return (
            <div key={i} style={{ display: 'flex', justifyContent: isBob ? 'flex-start' : 'flex-end' }}>
              <div className={speaking ? 'pa-speaking' : ''} style={{
                maxWidth: '80%', padding: '10px 14px', borderRadius: theme.radius.lg, fontSize: 14, lineHeight: 1.45,
                background: isBob ? theme.color.primarySoft : (isListeningHere ? theme.color.accentSoft : theme.color.surfaceMuted),
                color: theme.color.text,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isBob ? theme.color.primary : theme.color.accent, marginBottom: 2 }}>
                  {isBob ? "Bob's (automated)" : 'Client (you)'}
                </div>
                {content}
                {isListeningHere && (
                  <div style={{ marginTop: 6 }}>
                    <button onClick={stopListening} style={{ background: 'none', border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: theme.color.textMuted }}>Skip ▶</button>
                  </div>
                )}
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
