import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import { post } from '../api/client';
import { theme } from '../theme';
import { ACTOR } from '../actors';
import { Avatar, Button, Overlay, panel, h2Style } from './ui';
import { initials } from '../util';
import { speak, stopSpeaking, prefetch } from '../voiceTts';
import { listenForSpeech, stopListening, speechSupported, startLiveTranscription } from '../speech';
import { startRinging, stopRinging } from '../ringtone';
import { useVoiceSettings } from '../voiceSettings';
import { DossierBody } from './DossierView';
import { OriginalTranscriptCard } from './TranscriptFlipper';
import { AGENT_NAME } from '../dossier';
import type { GuidedScript as GuidedScriptT, ScriptStep, ScriptBranch } from '../types';
import * as flow from '../callFlow';

interface Line { who: 'system' | 'bob' | 'client'; text: string }

export function LiveCallConsole() {
  const call = useStore(s => s.call);
  const phase = call?.phase;
  const endCall = useStore(s => s.endCall);
  const endWithOutcome = useStore(s => s.endWithOutcome);
  const dismissCall = useStore(s => s.dismissCall);
  const audioOn = useStore(s => s.audioOn);
  const setAudioOn = useStore(s => s.setAudioOn);
  const micOn = useStore(s => s.micOn);
  const setMicOn = useStore(s => s.setMicOn);
  const liveMic = useStore(s => s.liveMic);
  const setLiveMic = useStore(s => s.setLiveMic);
  const openVoicePanel = useVoiceSettings(s => s.openPanel);

  useEffect(() => () => { stopSpeaking(); stopListening(); stopRinging(); }, []);

  if (!call || !phase || phase === 'ringing') return null;
  const name = call.item.clientName || 'the client';
  const verified = call.identityVerified !== false;

  return (
    <Overlay>
      <div style={{ ...panel, width: '100%', maxWidth: phase === 'live' ? 1000 : 560, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 22px', background: theme.color.primary, color: '#fff' }}>
          <Avatar initials={initials(name)} size={40} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, fontFamily: theme.font.serif }}>{name}</div>
            {phase === 'live'
              ? <IdentityChip verified={verified} />
              : <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{phase === 'connecting' ? 'Automated callback in progress…' : 'Call ended'}</div>}
          </div>
          {phase === 'connecting' && (
            <>
              <button onClick={() => openVoicePanel(true)} title="Voice settings" style={hdrBtn(false)}>⚙</button>
              <button onClick={() => setAudioOn(!audioOn)} title="Toggle Bob's spoken lines" style={hdrBtn(false)}>{audioOn ? '🔊 Voice on' : '🔇 Voice off'}</button>
              <button onClick={() => setMicOn(!micOn)} title="Wait for your microphone on the client's turns" style={hdrBtn(micOn)}>{micOn ? '🎤 Mic on' : '🎤 Mic off'}</button>
              <button onClick={() => void endWithOutcome('☎️ Agent ended the call')} title="Hang up" style={{ ...hdrBtn(false), background: 'rgba(180,60,50,0.5)' }}>Hang up</button>
            </>
          )}
          {phase === 'live' && (
            <>
              <MicSegmented value={liveMic} onChange={setLiveMic} />
              <button onClick={() => void endCall()} style={{ background: theme.color.danger, color: '#fff', border: 'none', borderRadius: theme.radius.md, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>End call</button>
            </>
          )}
        </div>

        {phase === 'connecting' && <CallSim name={name} />}
        {phase === 'live' && <LiveBody name={name} />}
        {phase === 'wrapup' && <WrapUp name={name} onDone={dismissCall} />}
      </div>
    </Overlay>
  );
}

function MicSegmented({ value, onChange }: { value: 'agent' | 'client' | 'off'; onChange: (v: 'agent' | 'client' | 'off') => void }) {
  const seg = (v: 'agent' | 'client' | 'off', label: string) => {
    const active = value === v;
    return (
      <button onClick={() => onChange(v)} title={`Mic input is the ${v === 'off' ? 'muted' : v}`} style={{
        background: active ? (v === 'off' ? 'rgba(255,255,255,0.28)' : v === 'client' ? theme.color.accent : 'rgba(34,160,94,0.95)') : 'rgba(255,255,255,0.12)',
        color: '#fff', border: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
      }}>{label}</button>
    );
  };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span aria-hidden style={{ fontSize: 15 }}>🎤</span>
      <div style={{ display: 'inline-flex', borderRadius: theme.radius.md, overflow: 'hidden' }}>
        {seg('client', 'Client')}
        {seg('agent', 'Agent')}
        {seg('off', 'Off')}
      </div>
    </div>
  );
}

function IdentityChip({ verified }: { verified: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4,
      fontSize: 11.5, fontWeight: 700, padding: '2px 10px', borderRadius: theme.radius.pill,
      background: verified ? 'rgba(34,160,94,0.95)' : 'rgba(201,58,48,0.95)', color: '#fff',
    }}>
      {verified ? '✓ Identity verified' : '⚠ Identity not verified'}
    </span>
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

function LiveBody({ name }: { name: string }) {
  const dossier = useStore(s => s.call?.dossier);
  const verified = useStore(s => s.call?.identityVerified) !== false;
  const transcript = dossier?.originTranscript;

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* LEFT — drive the call: fixed summary, scrolling transcript, pinned teleprompter */}
      <div style={{ flex: 1.15, display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: `1px solid ${theme.color.border}` }}>
        {dossier && (
          <div style={{ padding: '15px 20px 13px', borderBottom: `1px solid ${theme.color.border}`, flexShrink: 0 }}>
            <div style={{ fontFamily: theme.font.serif, fontSize: 18, fontWeight: 800, lineHeight: 1.3, color: theme.color.text, letterSpacing: '-0.01em' }}>
              {dossier.intent.headline}
            </div>
          </div>
        )}
        {dossier && <LiveScript gs={dossier.guidedScript} verified={verified} />}
      </div>
      {/* RIGHT — background & context (plain scroll block; a flex column would shrink the card) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px', background: theme.color.bg }}>
        {transcript && <div style={{ marginBottom: 14 }}><OriginalTranscriptCard transcript={transcript} /></div>}
        {dossier && <DossierBody d={dossier} compact />}
      </div>
    </div>
  );
}

type FeedItem = { speaker: 'agent' | 'client'; text: string };
type Card =
  | { kind: 'say'; text: string; generated?: boolean }
  | { kind: 'ask'; text: string; options: ScriptBranch[]; chosen?: number };

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'your', 'you', 'is', 'it', 'this', 'i', 'at', 'on', 'for', 'that', 'my', 'me', 'we', 'are', 'be', 'in', 'with', 'so', 'do', 'can', 'if', 'as', 'am', 'was', 'will', 'would', 'about', 'have', 'has', 'how', 'what', 'our', 'us', 'they', 'their', 'just', 'now', 'any']);
function sigWords(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
}
/** Fraction of the target line's significant words present in the spoken text. */
function coverage(spoken: string, target: string): number {
  const t = sigWords(target);
  if (!t.length) return 1;
  const sp = new Set(sigWords(spoken));
  return t.filter(w => sp.has(w)).length / t.length;
}

const normWord = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
function fuzzyEq(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 4 && b.length >= 4 && (a.startsWith(b.slice(0, 4)) || b.startsWith(a.slice(0, 4)));
}
/** How many leading DISPLAY words of `line` the `spoken` text has reached — drives the gray-out. */
function spokenWordCount(line: string, spoken: string): number {
  const dw = line.split(/\s+/).filter(Boolean);
  const sw = spoken.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  let li = 0;
  for (let si = 0; si < sw.length && li < dw.length; si++) {
    while (li < dw.length && !normWord(dw[li])) li++;        // skip pure-punctuation display tokens
    if (li >= dw.length) break;
    if (fuzzyEq(sw[si], normWord(dw[li]))) li++;
    else if (li + 1 < dw.length && fuzzyEq(sw[si], normWord(dw[li + 1]))) li += 2;
  }
  return li;
}
/** Best-effort branch pick from the client's spoken answer (keyword overlap + a yes/no shortcut). */
function bestOption(options: ScriptBranch[], spoken: string): ScriptBranch | null {
  const yes = /\b(yes|yeah|yep|correct|sure|i have|i did|already)\b/i.test(spoken);
  const no = /\b(no|nope|nah|haven'?t|didn'?t|none|never|nothing)\b/i.test(spoken);
  let best: ScriptBranch | null = null, score = 0;
  for (const op of options) {
    let sc = coverage(spoken, op.label);
    const lab = op.label.toLowerCase();
    if (no && /^(no|none|not)\b/.test(lab)) sc = Math.max(sc, 0.6);
    if (yes && /^(yes|yeah|sure|i have|i did)\b/.test(lab)) sc = Math.max(sc, 0.6);
    if (sc > score) { score = sc; best = op; }
  }
  return score >= 0.45 ? best : null;
}

/**
 * The live left column: a scrolling speech-to-text transcript on top, and a PINNED "Teleprompter"
 * docked at the bottom. The teleprompter holds a HISTORY of cards (planned from the dossier, then
 * LLM-generated past the script); the agent pages through them with the prev/next control, and
 * (when Auto is on) it advances off the live transcription — graying out each word as it's spoken,
 * and on an ask card the client's answer picks the branch. Identity-unverified leads with a verify card.
 */
function LiveScript({ gs, verified }: { gs: GuidedScriptT; verified: boolean }) {
  const liveMic = useStore(s => s.liveMic);
  const autoAdvance = useStore(s => s.autoAdvance);
  const setAutoAdvance = useStore(s => s.setAutoAdvance);
  const sttSupported = speechSupported();
  const micOff = liveMic === 'off';

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [interim, setInterim] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [cursor, setCursor] = useState(0);
  const [generating, setGenerating] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);
  const speakerRef = useRef<'agent' | 'client'>(liveMic === 'client' ? 'client' : 'agent');
  const clientBuf = useRef('');
  const cardStartLen = useRef(0);     // feed length when the active card became current
  const advancedRef = useRef(-1);     // cursor we already auto-advanced from (no double-fire)

  // Planner over the guided script, in refs so handlers can advance synchronously.
  const pStage = useRef<'verify' | 'greeting' | 'steps' | 'awaiting' | 'done'>(verified ? 'greeting' : 'verify');
  const pSteps = useRef<ScriptStep[]>(gs.steps);
  const pSi = useRef(0);

  const greetingText = `This is ${AGENT_NAME} at Bob's Mutual Funds, speaking on a recorded line — and I understand that you want ${gs.confirmAsk}. Is that correct?`;
  const verifyText = `Before we go further, I need to confirm your identity. Could you please verify your full name and the date of birth on your account?`;

  const hasNextPlanned = (): boolean => {
    const s = pStage.current;
    if (s === 'verify' || s === 'greeting') return true;
    if (s === 'steps') return pSi.current < pSteps.current.length;
    return false;
  };
  const nextPlanned = (): Card | null => {
    if (pStage.current === 'verify') { pStage.current = 'greeting'; return { kind: 'say', text: verifyText }; }
    if (pStage.current === 'greeting') { pStage.current = 'steps'; pSi.current = 0; return { kind: 'say', text: greetingText }; }
    if (pStage.current === 'steps') {
      if (pSi.current >= pSteps.current.length) { pStage.current = 'done'; return null; }
      const step = pSteps.current[pSi.current];
      if (step.kind === 'ask') { pStage.current = 'awaiting'; return { kind: 'ask', text: step.text, options: step.options }; }
      pSi.current += 1;
      return { kind: 'say', text: step.text };
    }
    return null;
  };

  useEffect(() => {
    // Reset the planner BEFORE producing the first card — these refs persist across React
    // StrictMode's double-mount, so without this the second run would advance past the greeting
    // and drop it. (This is why the standard greeting had disappeared.)
    pStage.current = verified ? 'greeting' : 'verify';
    pSteps.current = gs.steps;
    pSi.current = 0;
    const first = nextPlanned();
    setCards(first ? [first] : []);
    setCursor(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (liveMic !== 'off') speakerRef.current = liveMic; }, [liveMic]);
  useEffect(() => { feedRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); }, [feed, interim]);
  // Reset per-card tracking whenever the active card changes.
  useEffect(() => { cardStartLen.current = feed.length; clientBuf.current = ''; advancedRef.current = -1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  useEffect(() => {
    if (micOff || !sttSupported) return;
    const stop = startLiveTranscription(
      (final) => {
        setFeed(f => [...f, { speaker: speakerRef.current, text: final }]);
        useStore.getState().logLine(speakerRef.current === 'agent' ? 'AGENT' : 'CUSTOMER', final);
      },
      (txt) => setInterim(txt),
    );
    return () => { stop(); setInterim(''); };
  }, [micOff, sttSupported]);

  const card = cards[cursor] ?? null;
  const atEnd = cursor >= cards.length - 1;
  const isUnansweredAsk = card?.kind === 'ask' && card.chosen == null;

  const agentSpoken = (withInterim: boolean): string => {
    const parts = feed.slice(cardStartLen.current).filter(f => f.speaker === 'agent').map(f => f.text);
    if (withInterim && interim && speakerRef.current === 'agent') parts.push(interim);
    return parts.join(' ');
  };
  // Words of the active say card already spoken (for the live gray-out).
  const progress = (card && atEnd && card.kind === 'say') ? spokenWordCount(card.text, agentSpoken(true)) : 0;

  const generateNext = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const c = useStore.getState().call;
      const conversation = useStore.getState().transcriptLog.slice(-14).map(m => ({ role: m.role, content: m.content }));
      let text = '';
      try {
        const res = await post<{ text: string }>('/agent-callbacks', { action: 'suggest', callbackId: c?.item.callbackId, conversation });
        text = (res.text || '').trim();
      } catch { /* ignore */ }
      if (text) { setCards(cs => [...cs, { kind: 'say', text, generated: true }]); setCursor(i => i + 1); }
    } finally { setGenerating(false); }
  };

  const goForward = async () => {
    if (cursor < cards.length - 1) { setCursor(c => c + 1); return; }
    if (isUnansweredAsk || generating) return;
    if (hasNextPlanned()) { const next = nextPlanned(); if (next) { setCards(c => [...c, next]); setCursor(c => c + 1); return; } }
    await generateNext();
  };
  const goBack = () => { if (cursor > 0) setCursor(c => c - 1); };
  const pickOption = (k: number) => {
    const cur = cards[cursor];
    if (!cur || cur.kind !== 'ask') return;
    const opt = cur.options[k];
    pSteps.current = opt.then; pSi.current = 0; pStage.current = 'steps';
    const next = nextPlanned();
    setCards(cs => {
      const marked = cs.map((cd, i) => (i === cursor && cd.kind === 'ask') ? { ...cd, chosen: k } : cd);
      return next ? [...marked, next] : marked;
    });
    if (next) setCursor(c => c + 1);
  };

  // Auto-advance off the live transcription (when enabled), only on the active latest card.
  useEffect(() => {
    if (!feed.length || !autoAdvance) return;
    const cur = cards[cursor];
    if (!cur || cursor !== cards.length - 1) return;
    const last = feed[feed.length - 1];
    if (cur.kind === 'ask') {
      if (cur.chosen == null && last.speaker === 'client') {
        clientBuf.current = (clientBuf.current + ' ' + last.text).slice(-220);
        const pick = bestOption(cur.options, clientBuf.current);
        if (pick) { const k = cur.options.indexOf(pick); if (k >= 0) pickOption(k); }
      }
    } else if (last.speaker === 'agent' && advancedRef.current !== cursor) {
      if (coverage(agentSpoken(false), cur.text) >= 0.8) { advancedRef.current = cursor; void goForward(); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed]);

  const rightMode: 'chevron' | 'triangle' | 'none' =
    !atEnd ? 'chevron'
    : isUnansweredAsk ? 'none'
    : hasNextPlanned() ? 'chevron'
    : 'triangle';

  return (
    <>
      <div ref={feedRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {feed.length === 0 && !interim && (
          <div style={{ fontSize: 11.5, color: theme.color.textSubtle, fontStyle: 'italic' }}>
            {!micOff && sttSupported
              ? "🎤 Listening — pick who's speaking in the header; the transcript builds here."
              : 'Mic is off — choose 🎤 Client or Agent in the header to transcribe.'}
          </div>
        )}
        {feed.map((it, i) => <SttBubble key={i} actor={it.speaker} text={it.text} />)}
        {interim && <SttBubble actor={speakerRef.current} text={interim} interim />}
      </div>
      <div style={{ flexShrink: 0, borderTop: `1px solid ${theme.color.border}`, background: ACTOR.agent.bg, padding: '11px 16px 12px' }}>
        {!verified && (
          <div style={{ fontSize: 11.5, color: theme.color.danger, fontWeight: 600, marginBottom: 8 }}>Identity not verified — confirm it before discussing the account.</div>
        )}
        <Teleprompter
          card={card} progress={progress} generating={generating}
          rightMode={rightMode} canBack={cursor > 0}
          autoAdvance={autoAdvance} onToggleAuto={() => setAutoAdvance(!autoAdvance)}
          onBack={goBack} onForward={() => void goForward()} onPick={pickOption}
        />
      </div>
    </>
  );
}

function Teleprompter({ card, progress, generating, rightMode, canBack, autoAdvance, onToggleAuto, onBack, onForward, onPick }: {
  card: Card | null; progress: number; generating: boolean;
  rightMode: 'chevron' | 'triangle' | 'none'; canBack: boolean;
  autoAdvance: boolean; onToggleAuto: () => void;
  onBack: () => void; onForward: () => void; onPick: (k: number) => void;
}) {
  const isAsk = card?.kind === 'ask';
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.color.success, marginBottom: 6 }}>
        📣 Teleprompter
      </div>

      {generating ? (
        <div className="pa-speaking" style={{ fontSize: 14, color: theme.color.textMuted, fontStyle: 'italic', padding: '4px 0' }}>✍️ Writing the next thing to say…</div>
      ) : !card ? (
        <div style={{ textAlign: 'center', fontSize: 12.5, color: theme.color.textMuted, padding: '4px 0' }}>— End of script. Wrap up and end the call when you're done. —</div>
      ) : isAsk ? (
        <>
          <div style={{ fontSize: 15, lineHeight: 1.5, color: theme.color.text, fontWeight: 500 }}>{card.text}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {card.options.map((op, i) => {
              const chosen = card.chosen === i;
              const answered = card.chosen != null;
              return (
                <button key={i} disabled={answered} onClick={() => onPick(i)} style={{
                  background: chosen ? theme.color.success : theme.color.surface,
                  color: chosen ? '#fff' : theme.color.text,
                  border: `1px solid ${chosen ? theme.color.success : theme.color.borderStrong}`,
                  borderRadius: theme.radius.md, padding: '7px 14px', fontSize: 13, fontWeight: 700,
                  cursor: answered ? 'default' : 'pointer', opacity: answered && !chosen ? 0.5 : 1,
                }}>{op.label}</button>
              );
            })}
          </div>
        </>
      ) : (
        <SayText text={card.text} progress={progress} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, marginTop: 12 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: theme.color.textMuted, cursor: 'pointer' }}>
          <input type="checkbox" checked={autoAdvance} onChange={onToggleAuto} />
          Auto ›
        </label>
        <Pager canBack={canBack} rightMode={rightMode} disabled={generating} onBack={onBack} onForward={onForward} />
      </div>
    </div>
  );
}

function SayText({ text, progress }: { text: string; progress: number }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <div style={{ fontSize: 15, lineHeight: 1.5, fontWeight: 500 }}>
      “{words.map((w, i) => (
        <span key={i} style={{ color: i < progress ? '#C2BBAF' : theme.color.text }}>{w}{i < words.length - 1 ? ' ' : ''}</span>
      ))}”
    </div>
  );
}

function Pager({ canBack, rightMode, disabled, onBack, onForward }: {
  canBack: boolean; rightMode: 'chevron' | 'triangle' | 'none'; disabled: boolean; onBack: () => void; onForward: () => void;
}) {
  // Both buttons are ALWAYS rendered. An inapplicable direction (no earlier card / can't go forward
  // yet) is shown light-gray and inert rather than removed. Left = one card earlier, right = later.
  const btn: React.CSSProperties = { border: 'none', padding: '5px 13px', fontSize: 15, fontWeight: 700, lineHeight: 1 };
  const rightInert = disabled || rightMode === 'none';
  return (
    <div style={{ display: 'inline-flex', borderRadius: theme.radius.md, overflow: 'hidden', border: `1px solid ${theme.color.borderStrong}` }}>
      <button onClick={canBack ? onBack : undefined} disabled={!canBack} title="Earlier card" style={{
        ...btn,
        borderRight: `1px solid ${theme.color.borderStrong}`,
        color: canBack ? theme.color.text : theme.color.textSubtle,
        background: canBack ? theme.color.surface : theme.color.surfaceMuted,
        cursor: canBack ? 'pointer' : 'default',
      }}>‹</button>
      <button onClick={rightInert ? undefined : onForward} disabled={rightInert}
        title={rightMode === 'triangle' ? 'Generate the next line' : rightMode === 'none' ? '' : 'Later card'} style={{
        ...btn,
        color: rightInert ? theme.color.textSubtle : (rightMode === 'triangle' ? theme.color.success : theme.color.text),
        background: rightInert ? theme.color.surfaceMuted : theme.color.surface,
        cursor: rightInert ? 'default' : 'pointer',
      }}>{rightMode === 'triangle' ? '▶' : '›'}</button>
    </div>
  );
}

function SttBubble({ actor, text, interim }: { actor: 'agent' | 'client'; text: string; interim?: boolean }) {
  const a = ACTOR[actor];
  return (
    <div style={{ display: 'flex', justifyContent: a.side === 'right' ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '85%', padding: '8px 12px', borderRadius: theme.radius.lg, fontSize: 13.5, lineHeight: 1.45,
        background: a.bg, color: theme.color.text, opacity: interim ? 0.6 : 1,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: a.fg, marginBottom: 2 }}>
          {actor === 'agent' ? 'You (agent)' : 'Client'}{interim ? ' · …' : ''}
        </div>
        {text}
      </div>
    </div>
  );
}

function WrapUp({ name, onDone }: { name: string; onDone: () => void }) {
  const outcome = useStore(s => s.callOutcome);
  const connected = outcome.startsWith('✅');
  return (
    <div style={{ padding: '34px 26px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, color: connected ? theme.color.success : theme.color.primary }}>{connected ? '✓' : '📞'}</div>
      <div style={{ ...h2Style(), fontSize: 20, marginTop: 6 }}>Call ended</div>
      {outcome && (
        <div style={{ display: 'inline-block', marginTop: 12, background: theme.color.surfaceMuted, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.pill, padding: '7px 18px', fontSize: 13.5, fontWeight: 600 }}>
          {outcome}
        </div>
      )}
      <div style={{ fontSize: 14, color: theme.color.textMuted, margin: '16px 0 20px' }}>
        {connected
          ? `Your call with ${name} is wrapped up and removed from the board.`
          : `This callback has been logged and removed from the board.`}
      </div>
      <Button onClick={onDone} big>Back to board</Button>
    </div>
  );
}
