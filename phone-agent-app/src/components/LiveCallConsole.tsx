import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import { theme } from '../theme';
import { Avatar, Button, Overlay, panel } from './ui';
import { initials } from '../util';
import { speak, stopSpeaking, prefetch } from '../voiceTts';
import { listenForSpeech, stopListening, speechSupported } from '../speech';
import { startRinging, stopRinging } from '../ringtone';
import { useVoiceSettings } from '../voiceSettings';
import * as flow from '../callFlow';

interface Line { who: 'system' | 'bob' | 'client'; text: string }

/**
 * The outbound-call OVERLAY: the simulated voicebot↔client interaction (`connecting`) and the
 * brief wrap-up (`wrapup`). The connected ("live") experience is NOT an overlay — it lives in the
 * base page's left column (see LiveCallPanel), since an agent handles one client at a time.
 */
export function LiveCallConsole() {
  const call = useStore(s => s.call);
  const phase = call?.phase;
  const endWithOutcome = useStore(s => s.endWithOutcome);
  const audioOn = useStore(s => s.audioOn);
  const setAudioOn = useStore(s => s.setAudioOn);
  const micOn = useStore(s => s.micOn);
  const setMicOn = useStore(s => s.setMicOn);
  const openVoicePanel = useVoiceSettings(s => s.openPanel);

  useEffect(() => () => { stopSpeaking(); stopListening(); stopRinging(); }, []);

  // Only the outbound voicebot call (connecting) is an overlay. ringing → IncomingCallOverlay;
  // live → LiveCallPanel (base page); wrapup → after-call work in the dossier (right column).
  if (!call || phase !== 'connecting') return null;
  const name = call.item.clientName || 'the client';

  return (
    <Overlay>
      <div style={{ ...panel, width: '100%', maxWidth: 560, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 22px', background: theme.color.primary, color: '#fff' }}>
          <Avatar initials={initials(name)} size={40} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, fontFamily: theme.font.serif }}>{name}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>Automated callback in progress…</div>
          </div>
          <button onClick={() => openVoicePanel(true)} title="Voice settings" style={hdrBtn(false)}>⚙</button>
          <button onClick={() => setAudioOn(!audioOn)} title="Toggle Bob's spoken lines" style={hdrBtn(false)}>{audioOn ? '🔊 Voice on' : '🔇 Voice off'}</button>
          <button onClick={() => setMicOn(!micOn)} title="Wait for your microphone on the client's turns" style={hdrBtn(micOn)}>{micOn ? '🎤 Mic on' : '🎤 Mic off'}</button>
          <button onClick={() => void endWithOutcome('☎️ Agent ended the call')} title="Hang up" style={{ ...hdrBtn(false), background: 'rgba(180,60,50,0.5)' }}>Hang up</button>
        </div>

        <CallSim name={name} />
      </div>
    </Overlay>
  );
}

function hdrBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? 'rgba(160,90,44,0.45)' : 'rgba(255,255,255,0.12)', color: '#fff', border: 'none',
    borderRadius: theme.radius.md, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  };
}

/**
 * The simulated outbound call. Starts on a ringing screen with a big "Answer phone" button; once
 * answered, runs a branching conversation that reacts to the agent's real recognized speech —
 * wrong-party / availability / re-identify, opt-out, identity verification (with retries), and a
 * good-time check — each leading to the happy connect or an honest non-happy outcome.
 */
function CallSim({ name }: { name: string }) {
  const firstName = name.split(' ')[0] || name;
  // The happy-path lines, defined once so prefetch and playback share the exact same text (and
  // therefore the same audio cache entry).
  const L = {
    greeting: `Hello! This is a scheduled callback from Bob's Mutual Funds. Am I speaking with ${name}?`,
    verify: `Great. For security, please confirm your identity by repeating this phrase: "At Bob's, my voice is my password."`,
    goodTime: `Thank you ${firstName}! Your identity is confirmed. And is now still a good time to talk?`,
    connect: `Wonderful — connecting you with a specialist now.`,
  };

  const [answered, setAnswered] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [listening, setListening] = useState(false);
  const [waitPutOn, setWaitPutOn] = useState(false);
  const putOnResolve = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); }, [lines, listening, waitPutOn]);

  // Warm the TTS cache for the happy-path lines while the phone is still ringing, so Bob starts
  // speaking near-instantly once the call connects.
  useEffect(() => {
    if (!useStore.getState().audioOn) return;
    [L.greeting, L.verify, L.goodTime, L.connect].forEach(prefetch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The whole conversation engine lives inside the effect with a per-run `alive` flag, so a
  // superseded run (e.g. React StrictMode's throwaway first mount) can't keep talking after its
  // mic listen is aborted — that bug made the opening "wait for Hello" skip straight to the greeting.
  useEffect(() => {
    if (!answered) return;
    let alive = true;

    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
    const push = (who: Line['who'], text: string) => setLines(l => [...l, { who, text }]);
    const sysLine = (text: string) => { push('system', text); useStore.getState().logLine('SYSTEM', text); };

    const sayBob = async (text: string) => {
      if (!alive) return;
      await wait(250); // a brief, natural beat before speaking
      if (!alive) return;
      push('bob', text);
      useStore.getState().logLine('BOT', text);
      if (useStore.getState().audioOn) await speak(text);
      else await wait(Math.min(2600, 700 + text.length * 22));
    };

    // Listen for the agent's spoken reply; returns the transcript ('' if nothing heard).
    const listen = async (): Promise<{ text: string; heard: boolean }> => {
      if (!alive) return { text: '', heard: false };
      if (!useStore.getState().micOn || !speechSupported()) { await wait(1500); return { text: '', heard: false }; }
      setListening(true);
      const r = await listenForSpeech();
      setListening(false);
      if (r.heard && r.transcript) { push('client', `“${r.transcript}”`); useStore.getState().logLine('CUSTOMER', r.transcript); }
      return { text: r.transcript, heard: r.heard };
    };

    const finish = (outcome: string) => { if (alive) void useStore.getState().endWithOutcome(outcome); };

    async function runScript() {
      // Wait for them to pick up and greet ("Hello?") before the automated line starts.
      const greeting = await listen();
      if (!alive) return;
      if (flow.isOptOut(greeting.text)) return optOut();
      await sayBob(L.greeting);
      let tries = 0;
      while (alive) {
        const { text, heard } = await listen();
        if (!alive) return;
        if (flow.isOptOut(text)) return optOut();
        if (flow.isQuestionWhy(text) && tries < 2) {
          tries++;
          await sayBob(`Of course — this is a callback you scheduled with Bob's Mutual Funds. For your security I just need to confirm I'm speaking with ${name}. Is that you?`);
          continue;
        }
        if (flow.isWrongParty(text, firstName)) return wrongParty();
        if (!heard && tries < 2) { tries++; await sayBob(`Sorry, I didn't quite catch that. Am I speaking with ${name}?`); continue; }
        if (!heard) return noResponse();
        if (flow.isAffirmative(text, firstName)) break;     // clear "yes / this is me" → verify
        if (flow.isNegative(text)) return wrongParty();      // clear "no / not me" → wrong party
        // Heard something ambiguous (neither a clear yes nor a known branch): confirm once more.
        if (tries < 2) { tries++; await sayBob(`Sorry — just to confirm, am I speaking with ${name}?`); continue; }
        break;                                               // still unclear → proceed to verify
      }
      if (alive) return verify();
    }

    async function wrongParty() {
      await sayBob(`OK, well is ${firstName} available to talk right now?`);
      let tries = 0;
      while (alive) {
        const { text, heard } = await listen();
        if (!alive) return;
        if (flow.isOptOut(text)) return optOut();
        if (flow.isAvailableNo(text) || flow.isWrongParty(text, firstName)) return unavailable();
        if (flow.isAvailableYes(text) || heard) return waitForClient(); // available → put them on
        if (tries < 1) { tries++; await sayBob(`No problem — is ${firstName} able to come to the phone?`); continue; }
        return unavailable();
      }
    }

    async function waitForClient() {
      await sayBob(`I'll hold, thank you!`);
      if (!alive) return;
      setWaitPutOn(true);
      await new Promise<void>(res => { putOnResolve.current = res; });
      setWaitPutOn(false);
      if (!alive) return;
      sysLine(`${firstName} has come to the phone.`);
      // Re-identify the new person. They may state their name, or just say "hello".
      const { text } = await listen();
      if (!alive) return;
      if (flow.isOptOut(text)) return optOut();
      if (flow.statesName(text, firstName)) return verify(); // stated identity → still run voice verification
      // Ambiguous greeting ("hello" / "yeah") → confirm before verifying.
      await sayBob(`Hi there — am I speaking with ${name}?`);
      const r2 = await listen();
      if (!alive) return;
      if (flow.isOptOut(r2.text)) return optOut();
      if (flow.isWrongParty(r2.text, firstName) || flow.isAvailableNo(r2.text)) return unavailable();
      return verify();
    }

    async function verify() {
      await sayBob(L.verify);
      let attempts = 0;
      while (alive) {
        const { text } = await listen();
        if (!alive) return;
        if (flow.isOptOut(text)) return optOut();
        if (flow.isPassphrase(text)) { sysLine('✓ Voice verified (simulated).'); return goodTime(); }
        attempts++;
        if (attempts >= 3) return failed();
        await sayBob(`I'm sorry, that didn't match. Once more, please repeat: "At Bob's, my voice is my password."`);
      }
    }

    async function goodTime() {
      await sayBob(L.goodTime);
      const { text } = await listen();
      if (!alive) return;
      if (flow.isOptOut(text)) return optOut();
      if (flow.isBadTime(text)) return reschedule();
      await sayBob(L.connect);
      if (alive) useStore.getState().connect();
    }

    async function optOut() {
      await sayBob(`Understood — I'll remove this number right away, and you won't receive further calls. Sorry for the interruption. Goodbye.`);
      finish('🚫 Opted out — number flagged do-not-call');
    }
    async function unavailable() {
      await sayBob(`No problem — we'll reach out to ${firstName} again later, and they can always call us at our main line. Thanks for your time. Goodbye.`);
      finish('👤 Client unavailable — will retry / advised call-in');
    }
    async function noResponse() {
      await sayBob(`I'm having trouble hearing you, so I'll try again another time. Goodbye.`);
      finish('🤫 No response — call ended');
    }
    async function failed() {
      await sayBob(`I'm sorry, I wasn't able to verify your identity. For your security, please call us directly at our main line. Goodbye.`);
      finish('🔒 Identity not verified — not connected');
    }
    async function reschedule() {
      await sayBob(`No problem at all — we'll reach back out at a better time. Take care!`);
      finish('📅 Reschedule requested');
    }

    void runScript();
    return () => {
      alive = false;
      stopSpeaking();
      stopListening();
      putOnResolve.current?.();
      putOnResolve.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered]);

  if (!answered) {
    return <AnswerScreen name={name} onAnswer={() => setAnswered(true)} onNoAnswer={() => void useStore.getState().endWithOutcome('📭 No answer — voicemail left')} />;
  }

  return (
    <div ref={scrollRef} style={{ flex: 1, minHeight: 340, padding: '18px 22px', overflowY: 'auto' }}>
      <Transcript lines={lines} listening={listening} />
      {waitPutOn && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button tone="success" big onClick={() => { putOnResolve.current?.(); putOnResolve.current = null; }}>
            📞 Put {firstName} on the line
          </Button>
        </div>
      )}
    </div>
  );
}

function AnswerScreen({ name, onAnswer, onNoAnswer }: { name: string; onAnswer: () => void; onNoAnswer: () => void }) {
  // Ring until the call is answered (or this screen unmounts).
  useEffect(() => { startRinging(); return () => stopRinging(); }, []);
  return (
    <div style={{ flex: 1, minHeight: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28 }}>
      <div className="pa-speaking"><Avatar initials={initials(name)} size={80} /></div>
      <div style={{ fontSize: 19, fontWeight: 700, fontFamily: theme.font.serif }}>Calling {name}…</div>
      <div style={{ fontSize: 13, color: theme.color.textMuted, letterSpacing: 1 }}>📞 Ringing</div>
      <button onClick={onAnswer} style={{
        marginTop: 6, background: theme.color.success, color: '#fff', border: 'none', borderRadius: 999,
        padding: '16px 40px', fontSize: 18, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 18px rgba(40,140,70,0.35)',
      }}>📞 Answer phone</button>
      <button onClick={onNoAnswer} style={{
        background: 'none', border: 'none', color: theme.color.textSubtle, fontSize: 12.5, cursor: 'pointer', marginTop: 2, textDecoration: 'underline',
      }}>Let it ring — no answer →</button>
    </div>
  );
}

function Transcript({ lines, listening }: { lines: Line[]; listening: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {lines.map((l, i) => {
        if (l.who === 'system') {
          return <div key={i} style={{ textAlign: 'center', fontSize: 12, color: theme.color.textSubtle }}>{l.text}</div>;
        }
        const isBob = l.who === 'bob';
        return (
          <div key={i} style={{ display: 'flex', justifyContent: isBob ? 'flex-start' : 'flex-end' }}>
            <Bubble isBob={isBob}>{l.text}</Bubble>
          </div>
        );
      })}
      {listening && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div className="pa-speaking" style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: theme.radius.lg, fontSize: 14, background: theme.color.accentSoft, color: theme.color.accent, fontWeight: 600 }}>
            🎤 Listening… go ahead and speak
            <div style={{ marginTop: 6 }}>
              <button onClick={stopListening} style={{ background: 'none', border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: theme.color.textMuted }}>Skip ▶</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({ isBob, children }: { isBob: boolean; children: ReactNode }) {
  return (
    <div style={{
      maxWidth: '80%', padding: '10px 14px', borderRadius: theme.radius.lg, fontSize: 14, lineHeight: 1.45,
      background: isBob ? theme.color.primarySoft : theme.color.surfaceMuted, color: theme.color.text,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: isBob ? theme.color.primary : theme.color.accent, marginBottom: 2 }}>
        {isBob ? "Bob's (automated)" : 'Client (you)'}
      </div>
      {children}
    </div>
  );
}

