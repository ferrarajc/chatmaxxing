import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import { theme } from '../theme';
import { Avatar, Button, Overlay, panel, h2Style, card } from './ui';
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
              <button onClick={() => setMicOn(!micOn)} title="Live transcription of your mic" style={hdrBtn(micOn)}>{micOn ? '🎤 Live' : '🎤 Off'}</button>
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
    goodTime: `Thank you, ${firstName} — your identity is confirmed. And is now still a good time to talk?`,
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
    const sysLine = (text: string) => push('system', text);

    const sayBob = async (text: string) => {
      if (!alive) return;
      await wait(250); // a brief, natural beat before speaking
      if (!alive) return;
      push('bob', text);
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
      if (r.heard && r.transcript) push('client', `“${r.transcript}”`);
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
      await sayBob(`My apologies for the confusion. Is ${name} available?`);
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
      await sayBob(`Thank you — I'll hold while you put ${firstName} on the line.`);
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
      {/* LEFT — drive the call: fixed summary, then a scrolling teleprompter + live transcription */}
      <div style={{ flex: 1.15, display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: `1px solid ${theme.color.border}` }}>
        {dossier && (
          <div style={{ padding: '15px 20px 13px', borderBottom: `1px solid ${theme.color.border}`, flexShrink: 0 }}>
            <div style={{ fontFamily: theme.font.serif, fontSize: 18, fontWeight: 800, lineHeight: 1.3, color: theme.color.text, letterSpacing: '-0.01em' }}>
              {dossier.intent.headline}
            </div>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {dossier && <LiveScript gs={dossier.guidedScript} verified={verified} clientName={name} />}
        </div>
      </div>
      {/* RIGHT — background & context */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px', background: theme.color.bg, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {transcript && <OriginalTranscriptCard transcript={transcript} />}
        {dossier && <DossierBody d={dossier} compact />}
      </div>
    </div>
  );
}

type FeedItem = { kind: 'said'; text: string } | { kind: 'stt'; speaker: 'agent' | 'client'; text: string };
type ScriptStage = 'verify' | 'greeting' | 'steps' | 'done';

/**
 * The live teleprompter. Shows ONE "say/ask next" suggestion at a time, advancing as the agent
 * marks each line said (or picks a branch), while free browser speech-to-text streams the agent's
 * actual words into the feed as bubbles. If identity isn't verified, it leads with a verify step.
 */
function LiveScript({ gs, verified, clientName }: { gs: GuidedScriptT; verified: boolean; clientName: string }) {
  void clientName;
  const micOn = useStore(s => s.micOn);
  const sttSupported = speechSupported();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [interim, setInterim] = useState('');
  const [stage, setStage] = useState<ScriptStage>(verified ? 'greeting' : 'verify');
  const [activeSteps, setActiveSteps] = useState<ScriptStep[]>(gs.steps);
  const [si, setSi] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [feed, interim, stage, si]);

  // Free, continuous transcription of the agent's microphone → feed bubbles.
  useEffect(() => {
    if (!micOn || !sttSupported) return;
    const stop = startLiveTranscription(
      (final) => setFeed(f => [...f, { kind: 'stt', speaker: 'agent', text: final }]),
      (txt) => setInterim(txt),
    );
    return () => { stop(); setInterim(''); };
  }, [micOn, sttSupported]);

  const greetingText = `This is ${AGENT_NAME} at Bob's Mutual Funds, speaking on a recorded line — and I understand that you want ${gs.confirmAsk}. Is that correct?`;
  const verifyText = `Before we go further, I need to confirm your identity. Could you please verify your full name and the date of birth on your account?`;

  const current: ScriptStep | null =
    stage === 'verify' ? { kind: 'say', text: verifyText }
    : stage === 'greeting' ? { kind: 'say', text: greetingText }
    : stage === 'steps' && si < activeSteps.length ? activeSteps[si]
    : null;

  const advanceSay = (text: string) => {
    setFeed(f => [...f, { kind: 'said', text }]);
    if (stage === 'verify') setStage('greeting');
    else if (stage === 'greeting') { setStage('steps'); setSi(0); }
    else { const next = si + 1; setSi(next); if (next >= activeSteps.length) setStage('done'); }
  };

  const pickOption = (question: string, opt: ScriptBranch) => {
    setFeed(f => [...f, { kind: 'said', text: `${question} — ${opt.label}` }]);
    if (opt.then.length) { setActiveSteps(opt.then); setSi(0); setStage('steps'); }
    else setStage('done');
  };

  return (
    <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!verified && stage !== 'done' && (
        <div style={{ fontSize: 12, color: theme.color.danger, fontWeight: 600 }}>Identity not verified — confirm it before discussing the account.</div>
      )}
      {feed.map((it, i) => it.kind === 'said'
        ? <SaidLine key={i} text={it.text} />
        : <SttBubble key={i} speaker={it.speaker} text={it.text} />)}
      {interim && <SttBubble speaker="agent" text={interim} interim />}
      {current && <SuggestionCard step={current} onSaid={() => advanceSay(current.text)} onPick={(opt) => pickOption(current.text, opt)} />}
      {stage === 'done' && (
        <div style={{ textAlign: 'center', fontSize: 12.5, color: theme.color.textSubtle, padding: '8px 0' }}>
          — End of script. Wrap up and end the call when you're done. —
        </div>
      )}
      {micOn && sttSupported && feed.length === 0 && !interim && (
        <div style={{ fontSize: 11.5, color: theme.color.textSubtle, fontStyle: 'italic' }}>🎤 Live transcription on — your words will appear here as you speak.</div>
      )}
      <div ref={endRef} />
    </div>
  );
}

function SuggestionCard({ step, onSaid, onPick }: { step: ScriptStep; onSaid: () => void; onPick: (opt: ScriptBranch) => void }) {
  const isAsk = step.kind === 'ask';
  return (
    <div style={{ ...card, borderLeft: `3px solid ${theme.color.primary}`, background: theme.color.primarySoft, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: theme.color.primary, marginBottom: 6 }}>
        {isAsk ? 'Ask next' : 'Say next'}
      </div>
      <div style={{ fontSize: 14.5, lineHeight: 1.5, color: theme.color.text }}>{isAsk ? step.text : `“${step.text}”`}</div>
      {isAsk ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {step.options.map((op, i) => (
            <button key={i} onClick={() => onPick(op)} style={{
              background: theme.color.surface, color: theme.color.text, border: `1px solid ${theme.color.borderStrong}`,
              borderRadius: theme.radius.md, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>{op.label}</button>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <button onClick={onSaid} style={{
            background: theme.color.primary, color: '#fff', border: 'none', borderRadius: theme.radius.md,
            padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>Said it ›</button>
        </div>
      )}
    </div>
  );
}

function SaidLine({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, opacity: 0.65, fontSize: 12.5, lineHeight: 1.45, color: theme.color.textMuted }}>
      <span style={{ color: theme.color.success }}>✓</span>
      <span>{text}</span>
    </div>
  );
}

function SttBubble({ speaker, text, interim }: { speaker: 'agent' | 'client'; text: string; interim?: boolean }) {
  const isAgent = speaker === 'agent';
  return (
    <div style={{ display: 'flex', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '85%', padding: '8px 12px', borderRadius: theme.radius.lg, fontSize: 13.5, lineHeight: 1.45,
        background: isAgent ? theme.color.accentSoft : theme.color.surfaceMuted, color: theme.color.text, opacity: interim ? 0.6 : 1,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: isAgent ? theme.color.accent : theme.color.textMuted, marginBottom: 2 }}>
          {isAgent ? 'You (agent)' : 'Client'}{interim ? ' · …' : ''}
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
