import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { post } from '../api/client';
import { theme } from '../theme';
import { ACTOR } from '../actors';
import { Avatar } from './ui';
import { initials } from '../util';
import { stopSpeaking } from '../voiceTts';
import { stopListening, speechSupported, startLiveTranscription } from '../speech';
import { AGENT_NAME } from '../dossier';
import type { GuidedScript as GuidedScriptT, ScriptStep, ScriptBranch } from '../types';

/**
 * The connected-call experience, shown in the base page's LEFT column (replacing the Upcoming
 * Calls board) once the agent is live with a client — a phone agent handles one client at a time.
 * Header: client name + identity chip + mic Client/Agent/Off + End call. Body: the live speech-to-
 * text transcript over a pinned, paging Teleprompter that executes the agent's (possibly edited)
 * script. The right column keeps showing the dossier.
 */
export function LiveCallPanel() {
  const call = useStore(s => s.call);
  const liveMic = useStore(s => s.liveMic);
  const setLiveMic = useStore(s => s.setLiveMic);
  const endCall = useStore(s => s.endCall);
  const draft = useStore(s => (call ? s.scriptDrafts[call.item.callbackId] : undefined));

  useEffect(() => () => { stopSpeaking(); stopListening(); }, []);

  // Stays mounted through after-call work (frozen) so the transcript persists for reference while
  // the agent fills out ACW on the right; it only unmounts when the call is dismissed.
  if (!call || (call.phase !== 'live' && call.phase !== 'wrapup') || !call.dossier) return null;
  const frozen = call.phase === 'wrapup';
  const name = call.item.clientName || 'the client';
  const verified = call.identityVerified !== false;
  const gs = draft ?? call.dossier.guidedScript;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: theme.radius.xl, overflow: 'hidden', boxShadow: theme.shadow.md, background: theme.color.surface }}>
      <div style={{ background: theme.color.primary, color: '#fff', padding: '12px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar initials={initials(name)} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, fontFamily: theme.font.serif }}>{name}</div>
            {frozen
              ? <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 3 }}>Call ended — complete after-call work →</div>
              : <IdentityChip verified={verified} />}
          </div>
          {!frozen && (
            <button onClick={() => void endCall()} style={{ background: theme.color.danger, color: '#fff', border: 'none', borderRadius: theme.radius.md, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              End call
            </button>
          )}
        </div>
        {!frozen && (
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
            <MicSegmented value={liveMic} onChange={setLiveMic} />
          </div>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <LiveScript gs={gs} verified={verified} frozen={frozen} />
      </div>
    </div>
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
 * The scrolling speech-to-text transcript over a PINNED, paging Teleprompter. The teleprompter holds
 * a history of cards (planned from the script, then LLM-generated past the script); the agent pages
 * with the prev/next control, and (when Auto is on) it advances off the live transcription — graying
 * out each word as spoken, and on an ask card the client's answer picks the branch.
 */
function LiveScript({ gs, verified, frozen }: { gs: GuidedScriptT; verified: boolean; frozen: boolean }) {
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
  const feedLen = useRef(0);          // running feed length (synchronous; feed only ever grows)
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
    // StrictMode's double-mount, so without this the second run would advance past the greeting.
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
  // Reset the per-card auto-advance guard when the active card changes. (cardStartLen is set
  // synchronously the moment each new latest card is created, so it isn't reset here.)
  useEffect(() => { clientBuf.current = ''; advancedRef.current = -1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  useEffect(() => {
    if (frozen || micOff || !sttSupported) return;   // ACW: stop listening, keep the transcript
    const stop = startLiveTranscription(
      (final) => {
        feedLen.current += 1;
        setFeed(f => [...f, { speaker: speakerRef.current, text: final }]);
        useStore.getState().logLine(speakerRef.current === 'agent' ? 'AGENT' : 'CUSTOMER', final);
      },
      (txt) => setInterim(txt),
    );
    return () => { stop(); setInterim(''); };
  }, [frozen, micOff, sttSupported]);

  const card = cards[cursor] ?? null;
  const atEnd = cursor >= cards.length - 1;
  const isUnansweredAsk = card?.kind === 'ask' && card.chosen == null;

  // On a teleprompter card it's the agent reading aloud — so count ALL speech since this card became
  // active, regardless of which party the mic toggle is attributing bubbles to.
  const spokenForCard = (withInterim: boolean): string => {
    const parts = feed.slice(cardStartLen.current).map(f => f.text);
    if (withInterim && interim) parts.push(interim);
    return parts.join(' ');
  };
  const progress = (card && atEnd && card.kind === 'say') ? spokenWordCount(card.text, spokenForCard(true)) : 0;

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
      if (text) { cardStartLen.current = feedLen.current; setCards(cs => [...cs, { kind: 'say', text, generated: true }]); setCursor(i => i + 1); }
    } finally { setGenerating(false); }
  };

  const goForward = async () => {
    if (cursor < cards.length - 1) { setCursor(c => c + 1); return; }
    if (isUnansweredAsk || generating) return;
    if (hasNextPlanned()) { const next = nextPlanned(); if (next) { cardStartLen.current = feedLen.current; setCards(c => [...c, next]); setCursor(c => c + 1); return; } }
    await generateNext();
  };
  const goBack = () => { if (cursor > 0) setCursor(c => c - 1); };
  const pickOption = (k: number) => {
    const cur = cards[cursor];
    if (!cur || cur.kind !== 'ask') return;
    const opt = cur.options[k];
    pSteps.current = opt.then; pSi.current = 0; pStage.current = 'steps';
    const next = nextPlanned();
    if (next) cardStartLen.current = feedLen.current;
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
    } else if (advancedRef.current !== cursor) {
      if (coverage(spokenForCard(false), cur.text) >= 0.8) { advancedRef.current = cursor; void goForward(); }
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
      <div ref={feedRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {feed.length === 0 && !interim && (
          <div style={{ fontSize: 11.5, color: theme.color.textSubtle, fontStyle: 'italic' }}>
            {frozen
              ? 'No live transcript was captured during this call.'
              : !micOff && sttSupported
                ? "🎤 Listening — pick who's speaking in the header; the transcript builds here."
                : 'Mic is off — choose 🎤 Client or Agent in the header to transcribe.'}
          </div>
        )}
        {feed.map((it, i) => <SttBubble key={i} actor={it.speaker} text={it.text} />)}
        {interim && !frozen && <SttBubble actor={speakerRef.current} text={interim} interim />}
      </div>
      {frozen ? (
        <div style={{ flexShrink: 0, borderTop: `1px solid ${theme.color.border}`, background: theme.color.surfaceWell, padding: '12px 14px', textAlign: 'center', fontSize: 12, color: theme.color.textMuted }}>
          Call transcript · kept for your after-call work
        </div>
      ) : (
        <div style={{ flexShrink: 0, borderTop: `1px solid ${theme.color.border}`, background: ACTOR.agent.bg, padding: '11px 14px 12px' }}>
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
      )}
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
        <div className="pa-speaking" style={{ fontSize: 15, color: theme.color.textMuted, fontStyle: 'italic', padding: '4px 0' }}>✍️ Writing the next thing to say…</div>
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
        maxWidth: '88%', padding: '8px 12px', borderRadius: theme.radius.lg, fontSize: 13.5, lineHeight: 1.45,
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
