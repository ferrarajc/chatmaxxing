import React, { useEffect, useRef, useState } from 'react';
import { ContactSlot, ChatMessage, AutopilotScope, ACWData, EvidenceSpan } from '../types';
import { useAgentStore } from '../store/agentStore';
import { renderHighlighted } from '../utils/evidenceHighlight';
import { post } from '../api/client';
import { logReplyEvent } from '../api/replyLog';
import { log } from '../api/logger';
import { IntentLabel } from './IntentLabel';
import { IncomingAlert } from './IncomingAlert';
import { ResponseTimer } from './ResponseTimer';
import { AISupport } from './AISupport';
import { AfterCallWork } from './AfterCallWork';
import { CLIENT_PROFILES, DEFAULT_PROFILE } from '../data/clientProfiles';


const DEFAULT_AI_HEIGHT = 250;
const MIN_AI_HEIGHT = 100;
const MAX_AI_HEIGHT = 700;

// ── Transcript save (fire-and-forget, never throws) ────────────────────────

function saveTranscript(slot: ContactSlot, acwData?: ACWData | null) {
  const msgs = slot.messages;
  const acw = acwData ?? slot.acwData;
  const now = Date.now();
  const { agentUsername, agentName } = useAgentStore.getState();
  post('/save-transcript', {
    transcriptId: slot.contactId,
    clientId: slot.clientId,
    clientName: slot.clientName,
    intentSummary: slot.intentSummary,
    startTime: msgs[0]?.timestamp ?? now,
    endTime: msgs[msgs.length - 1]?.timestamp ?? now,
    wrapUpCode: acw?.wrapUpCode ?? null,
    acwSummary: acw?.summary ?? null,
    agentUsername,
    agentName,
    messages: msgs.map(m => ({ id: m.id, ts: m.timestamp, role: m.role, content: m.content })),
  }).catch(() => {});
}

interface Props {
  slotIndex: number;
  slot: ContactSlot | null;
}

// ── Autopilot helpers ──────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// Throttle outgoing typing events so a burst of keystrokes emits at most one per interval.
const TYPING_THROTTLE_MS = 3000;
// Control message that tells the customer to immediately drop the typing ellipsis when
// autopilot is cancelled mid-compose. Must match the customer app's sentinel exactly.
const TYPING_STOP_SENTINEL = '__BOBS_TYPING_STOP__';

// Tell the customer the agent is typing (drives the ellipsis in the client chat layer).
function sendCustomerTypingEvent(connectionToken: string): void {
  post<{ ok: boolean }>('/send-agent-message', { connectionToken, event: 'typing' }).catch(() => {});
}
// Immediately clear the customer's typing ellipsis (used when autopilot is cancelled).
function sendCustomerTypingStop(connectionToken: string): void {
  post<{ ok: boolean }>('/send-agent-message', { connectionToken, message: TYPING_STOP_SENTINEL }).catch(() => {});
}

interface AutopilotTurnResult {
  response: string;
  shouldExitAutopilot: boolean;
  suggestedScope?: string | null;
  closeChat?: boolean;
  scheduleCallback?: {
    clientId: string;
    clientName: string;
    phoneNumber: string;
    scheduledTimeISO: string;
    intentSummary: string;
  } | null;
  exitMessage?: string | null;
  taskIdentified?: string | null;
  proposedAction?: {
    taskId: string;
    taskName: string;
    summary: string;
    fields: Array<{ key: string; label: string; value: string }>;
    submissionType?: 'agent' | 'licensed-agent' | 'client';
  } | null;
}

const RESEARCHING_MSGS = [
  'Still working on this for you — thank you for your patience.',
  "Just checking in — I'm still here and working on this for you.",
  'Thank you for your patience, I still need a little more time.',
  "I haven't forgotten about you — still working on it!",
];

// ── Component ──────────────────────────────────────────────────────────────

export function ChatColumn({ slotIndex, slot }: Props) {
  const store = useAgentStore();
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  // Message id currently flashing after an evidence jump (cleared after ~1.5 s)
  const [flashMessageId, setFlashMessageId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMsgCount = useRef(0);
  // Last time we emitted a typing event to the customer (throttling manual keystrokes)
  const lastTypingSentRef = useRef(0);

  const [aiHeight, setAiHeight] = useState(() => {
    try {
      const saved = localStorage.getItem(`bobs:aiHeight:${slotIndex}`);
      const n = saved ? parseInt(saved, 10) : NaN;
      if (!isNaN(n) && n >= MIN_AI_HEIGHT && n <= MAX_AI_HEIGHT) return n;
    } catch {}
    return DEFAULT_AI_HEIGHT;
  });

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = aiHeight;
    let lastHeight = startHeight;

    const onMove = (ev: MouseEvent) => {
      lastHeight = Math.max(MIN_AI_HEIGHT, Math.min(MAX_AI_HEIGHT, startHeight - (ev.clientY - startY)));
      setAiHeight(lastHeight);
    };
    const onUp = () => {
      try { localStorage.setItem(`bobs:aiHeight:${slotIndex}`, String(lastHeight)); } catch {}
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Greeting tracking
  const greetedContacts = useRef<Set<string>>(new Set());

  // Autopilot timers
  const researchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimer1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fires if no customer reply within 2 min after an autopilot message
  const autopilotIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fires if customer doesn't reply within 3 min after agent poses a question
  const agentQuestionIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prevent double-running the initial autopilot turn for a given contact+scope
  const initRunRef = useRef<Set<string>>(new Set());
  // Track previous scope to detect changes
  const prevScopeRef = useRef<AutopilotScope | null>(null);
  // Per-contact "send generation" — each autopilotSend bumps it and captures its own number;
  // a later send (e.g. a customer reply arriving mid-edit) supersedes older loops, which then
  // abort silently instead of double-sending. Ref (not store) so it never triggers a re-render.
  const autopilotGenRef = useRef<Map<string, number>>(new Map());

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (slot && slot.messages.length !== prevMsgCount.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      prevMsgCount.current = slot.messages.length;
    }
  }, [slot?.messages.length]);

  // Keep the client typing ellipsis in view when it appears.
  useEffect(() => {
    if (slot?.customerTyping) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [slot?.customerTyping]);

  // ── Effect: evidence jump (locate button on the Proposed Action card) ──
  // Scrolls this column's transcript to the message holding a field's evidence
  // span and flashes it. The lookup is scoped to this column's container because
  // message ids like `pre-0` repeat across columns; the clientWidth guard skips
  // the hidden 0×0 ChatColumns that focusing mode keeps mounted for effects.
  useEffect(() => {
    const cid = slot?.contactId;
    if (!cid) return;
    const onJump = (e: Event) => {
      const detail = (e as CustomEvent).detail as { contactId?: string; messageId?: string } | undefined;
      if (!detail || detail.contactId !== cid || !detail.messageId) return;
      const container = chatContainerRef.current;
      if (!container || container.clientWidth === 0) return;
      container.querySelector(`[data-mid="${CSS.escape(detail.messageId)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashMessageId(detail.messageId);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashMessageId(null), 1500);
    };
    window.addEventListener('bobs:evidenceJump', onJump);
    return () => {
      window.removeEventListener('bobs:evidenceJump', onJump);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [slot?.contactId]);

  // ── sendText: append locally + POST to Connect ─────────────────────────
  const sendText = (text: string) => {
    if (!slot) return;
    store.appendMessage(slot.contactId, { role: 'AGENT', content: text });
    // A manual send re-enables suggestion auto-advance (so the next suggestion leapfrogs to newest).
    store.patchSlot(slot.contactId, { lastAgentMessageAt: Date.now(), suggestionAutoAdvance: true });

    // Start 3-min idle-check timer when agent poses a question; cancel on any non-question send
    if (agentQuestionIdleRef.current) clearTimeout(agentQuestionIdleRef.current);
    if (text.includes('?')) {
      const cidForTimer = slot.contactId;
      agentQuestionIdleRef.current = setTimeout(() => {
        const s = store.getSlot(cidForTimer);
        if (!s || s.autopilotScope !== null || s.status !== 'active') return;
        store.patchSlot(cidForTimer, { autopilotScope: 'idle-check' });
      }, 3 * 60 * 1000);
    }

    if (!slot.connectionToken) {
      log.warn('ChatColumn:send:noConnectionToken', { contactId: slot.contactId });
      store.appendMessage(slot.contactId, {
        role: 'SYSTEM', content: '⚠ Agent token not ready — try again in a moment',
      });
      return;
    }

    post<{ ok: boolean }>('/send-agent-message', {
      connectionToken: slot.connectionToken,
      message: text,
    })
      .then(() => log.info('ChatColumn:sendMessage:ok', { contactId: slot.contactId }))
      .catch((e: unknown) => {
        log.error('ChatColumn:sendMessage:failed', e);
        let detail: string;
        try { detail = JSON.stringify(e, Object.getOwnPropertyNames(e as object)); }
        catch { detail = String(e); }
        store.appendMessage(slot.contactId, {
          role: 'SYSTEM', content: `⚠ Send error: ${detail.slice(0, 300)}`,
        });
      });
  };

  // ── Autopilot: human-like wait helper ──────────────────────────────────
  // Waits `ms` while autopilot is composing, polling frequently so cancellation and
  // pause are detected promptly. When showEllipsis is true the customer's typing
  // ellipsis is kept alive via heartbeats (throttled) and cleared immediately if
  // autopilot is cancelled. Honors slot.autopilotPaused: while paused the countdown
  // freezes (the send deadline does not advance); on resume both the internal deadline
  // and the display deadline (autopilotSendAt) shift forward by the paused span, so the
  // total wait time is preserved exactly. Returns false if the wait was aborted (scope
  // cancelled or chat ended).
  const autopilotDelay = async (
    ms: number, contactId: string, scope: AutopilotScope, showEllipsis: boolean, myGen: number,
  ): Promise<boolean> => {
    const POLL_MS = 250;
    const TYPING_HEARTBEAT_MS = 8000;
    const startToken = store.getSlot(contactId)?.connectionToken;
    let deadline = Date.now() + ms;
    let pauseStart = 0;               // 0 = running; else Date.now() when the pause began
    let lastHeartbeat = Date.now();   // autopilotSend already emitted one before phase 2
    for (;;) {
      await sleep(POLL_MS);
      const cur = store.getSlot(contactId);
      // Superseded by a newer send loop for this contact (e.g. a customer reply started a fresh
      // turn while this one was paused mid-edit) — bail WITHOUT touching shared state, since
      // autopilotPending / the countdown now belong to the newer loop. Checked first so an
      // older loop can never double-send or clobber the newer staged reply.
      if (autopilotGenRef.current.get(contactId) !== myGen) return false;
      // Abort if scope was cancelled while waiting, or if the chat already ended.
      // (Checked before the pause branch so Exit-while-paused aborts immediately.)
      if (!cur || cur.autopilotScope !== scope || cur.status === 'acw') {
        store.patchSlot(contactId, {
          autopilotPending: null, autopilotSendAt: null, autopilotPausedRemainingMs: null,
        });
        // Cancelled (not ended) → tell the customer to drop the ellipsis immediately.
        const stopToken = cur?.connectionToken ?? startToken;
        if (showEllipsis && cur && cur.status !== 'acw' && stopToken) sendCustomerTypingStop(stopToken);
        return false;
      }
      // "Send now" — the agent asked to fire the currently displayed reply immediately.
      // Return true so the caller sends the live autopilotPending right away (bypassing any
      // remaining countdown). Checked before the pause branch so it also fires while paused;
      // the flag is cleared at the actual send point. Left set across the reading→typing phase
      // boundary so a Send-now during the reading delay skips straight through the typing delay.
      if (cur.autopilotSendNow) return true;
      // Paused — freeze the countdown; capture the remaining time once.
      if (cur.autopilotPaused) {
        if (pauseStart === 0) {
          pauseStart = Date.now();
          store.patchSlot(contactId, {
            autopilotPausedRemainingMs: Math.max(0, (cur.autopilotSendAt ?? deadline) - Date.now()),
          });
        }
        continue;
      }
      // Just resumed — shift both deadlines forward by however long we were paused.
      // Leave lastHeartbeat untouched: if the pause outlasted the heartbeat interval the
      // customer's typing ellipsis has expired, so the check below re-sends one promptly.
      if (pauseStart !== 0) {
        const pausedFor = Date.now() - pauseStart;
        pauseStart = 0;
        deadline += pausedFor;
        const running = store.getSlot(contactId);
        store.patchSlot(contactId, {
          autopilotSendAt: (running?.autopilotSendAt ?? deadline) + pausedFor,
          autopilotPausedRemainingMs: null,
        });
      }
      if (Date.now() >= deadline) return true;
      // Still composing — keep the customer's ellipsis alive (throttled).
      if (showEllipsis && cur.connectionToken && Date.now() - lastHeartbeat >= TYPING_HEARTBEAT_MS) {
        sendCustomerTypingEvent(cur.connectionToken);
        lastHeartbeat = Date.now();
      }
    }
  };

  // ── Autopilot: send with human-like delay ──────────────────────────────
  // Two phases mimic a human agent. (1) Reading delay — before the typing ellipsis
  // appears, pause for the time it would take to read the client's most recent
  // message: a minimum of 2000 ms covering the first 200 characters they wrote, plus
  // 10 ms for every character beyond that. (2) Typing delay — the existing
  // chars/15-seconds compose delay, during which the ellipsis is shown. The typing
  // delay only starts once the reading delay has fully elapsed.
  const autopilotSend = async (text: string, contactId: string, scope: AutopilotScope): Promise<boolean> => {
    // Claim the latest send generation for this contact. Any older in-flight send loop will see
    // this bump on its next poll and abort silently — so a customer reply that starts a new turn
    // while a prior staged send is still pending (e.g. paused mid-edit) can't cause a double-send
    // or clobber the newer staged reply.
    const myGen = (autopilotGenRef.current.get(contactId) ?? 0) + 1;
    autopilotGenRef.current.set(contactId, myGen);
    // Start a fresh candidate deck for this staged send. autopilotPending mirrors the shown
    // candidate, so the existing send path (which reads autopilotPending) is unchanged; the
    // deck only comes into play if the agent pauses and pages / Changes to / Magics the reply.
    store.initAutopilotDeck(contactId, text, 'nbr');

    // Phase 1 — reading delay. No ellipsis yet (the agent is "reading", not typing).
    const slotForRead = store.getSlot(contactId);
    const lastClientMsg = slotForRead?.messages.slice().reverse().find(m => m.role === 'CUSTOMER');
    const clientLen = lastClientMsg?.content.length ?? 0;
    const readingDelayMs = clientLen > 0 ? 2000 + Math.max(0, clientLen - 200) * 10 : 0;
    // Phase 2 typing delay (chars/15 s) — computed up front so the visible countdown can
    // show the full time until send. The delay timing itself is unchanged.
    const delaySecs = Math.max(1, Math.floor(text.length / 15));
    // Total time-until-send drives the countdown. Deliberately does NOT touch
    // autopilotPaused: if the agent paused before this turn resolved, the staged send
    // starts frozen (autopilotDelay freezes it on its first poll).
    store.patchSlot(contactId, {
      autopilotSendAt: Date.now() + readingDelayMs + delaySecs * 1000,
      autopilotPausedRemainingMs: null,
    });
    if (!(await autopilotDelay(readingDelayMs, contactId, scope, false, myGen))) return false;

    // Phase 2 — typing delay. Show the ellipsis now and keep it alive until send.
    const typingToken = store.getSlot(contactId)?.connectionToken;
    if (typingToken) sendCustomerTypingEvent(typingToken);
    if (!(await autopilotDelay(delaySecs * 1000, contactId, scope, true, myGen))) return false;

    const fresh = store.getSlot(contactId);
    // Superseded by a newer send while we finished the delay — leave all shared state to that
    // loop (don't null autopilotPending: the newer loop's staged reply is what should stand).
    if (autopilotGenRef.current.get(contactId) !== myGen) return false;
    if (!fresh || fresh.autopilotScope !== scope || fresh.status === 'acw') {
      store.patchSlot(contactId, {
        autopilotPending: null, autopilotSendAt: null, autopilotPausedRemainingMs: null,
      });
      const stopToken = fresh?.connectionToken ?? typingToken;
      if (fresh && fresh.status !== 'acw' && stopToken) sendCustomerTypingStop(stopToken);
      return false;
    }
    // Read fresh connectionToken at send time
    const token = fresh.connectionToken;
    // Send the live staged text so an agent edit to the pending reply is what goes out
    // (falls back to the original if the box was cleared to empty).
    const outgoing = fresh.autopilotPending && fresh.autopilotPending.trim() ? fresh.autopilotPending : text;
    store.appendMessage(contactId, { role: 'AGENT', content: outgoing });
    logReplyEvent({
      contactId, clientId: fresh.clientId,
      agentUsername: store.agentUsername, agentName: store.agentName,
      path: 'autopilot-send', originalText: text, sentText: outgoing, wasEdited: outgoing !== text,
    });
    store.patchSlot(contactId, {
      lastAgentMessageAt: Date.now(),
      autopilotPending: null, autopilotSendAt: null, autopilotPausedRemainingMs: null,
      autopilotSendNow: false,
    });
    if (token) {
      post<{ ok: boolean }>('/send-agent-message', { connectionToken: token, message: outgoing })
        .catch((e: unknown) => {
          log.error('ChatColumn:autopilot:sendFailed', e);
          store.appendMessage(contactId, {
            role: 'SYSTEM', content: `⚠ Autopilot send error: ${String(e).slice(0, 120)}`,
          });
        });
    }
    // Start 2-min idle timer — if no customer reply, switch to idle-check
    const WAITING_SCOPES: AutopilotScope[] = ['get-intent', 'full-auto', 'callback'];
    if (WAITING_SCOPES.includes(scope)) {
      if (autopilotIdleRef.current) clearTimeout(autopilotIdleRef.current);
      autopilotIdleRef.current = setTimeout(() => {
        const s = store.getSlot(contactId);
        if (s && WAITING_SCOPES.includes(s.autopilotScope as AutopilotScope)) {
          store.patchSlot(contactId, { autopilotScope: 'idle-check' });
        }
      }, 2 * 60 * 1000);
    }
    return true;
  };

  // ── Autopilot: exit with flash ─────────────────────────────────────────
  const exitAutopilot = (contactId: string, message?: string | null) => {
    clearAutopilotTimers();
    // If a reply was staged (customer is seeing a typing ellipsis), drop it immediately.
    const exiting = store.getSlot(contactId);
    if (exiting?.autopilotPending && exiting.connectionToken && exiting.status !== 'acw') {
      sendCustomerTypingStop(exiting.connectionToken);
    }
    store.patchSlot(contactId, {
      autopilotScope: null,
      autopilotFlash: true,
      autopilotPending: null,
      autopilotPaused: false,
      autopilotSendAt: null,
      autopilotPausedRemainingMs: null,
      autopilotExitMessage: message ?? null,
    });
    setTimeout(() => store.patchSlot(contactId, { autopilotFlash: false }), 100);
  };

  const clearAutopilotTimers = () => {
    if (researchIntervalRef.current) { clearInterval(researchIntervalRef.current); researchIntervalRef.current = null; }
    if (idleTimer1Ref.current) { clearTimeout(idleTimer1Ref.current); idleTimer1Ref.current = null; }
    if (idleTimer2Ref.current) { clearTimeout(idleTimer2Ref.current); idleTimer2Ref.current = null; }
    if (autopilotIdleRef.current) { clearTimeout(autopilotIdleRef.current); autopilotIdleRef.current = null; }
    if (agentQuestionIdleRef.current) { clearTimeout(agentQuestionIdleRef.current); agentQuestionIdleRef.current = null; }
  };

  // ── Autopilot: call Lambda and handle result ───────────────────────────
  const runAutopilotTurn = async (contactId: string, scope: AutopilotScope) => {
    const currentSlot = store.getSlot(contactId);
    if (!currentSlot || currentSlot.autopilotScope !== scope) return;

    const clientProfile = CLIENT_PROFILES[currentSlot.clientId] ?? DEFAULT_PROFILE;
    let result: AutopilotTurnResult;
    try {
      result = await post<AutopilotTurnResult>('/autopilot-turn', {
        transcript: currentSlot.messages,
        clientProfile,
        scope,
        currentIntent: currentSlot.intentSummary,
      });
    } catch (e) {
      // Don't hard-exit on a single transient failure (heavy Change-to/Magic/NBR traffic makes one
      // more likely). Retry once; only give up if it fails again — and then exit with a clear,
      // resumable message (re-activating autopilot now works — see the initRunRef reset on exit).
      console.warn('Autopilot turn failed, retrying once', e);
      await sleep(1200);
      if (store.getSlot(contactId)?.autopilotScope !== scope) return;   // exited/changed meanwhile
      try {
        const s = store.getSlot(contactId);
        result = await post<AutopilotTurnResult>('/autopilot-turn', {
          transcript: s!.messages, clientProfile, scope, currentIntent: s!.intentSummary,
        });
      } catch (e2) {
        console.warn('Autopilot turn failed after retry', e2);
        exitAutopilot(contactId, 'Autopilot paused after a temporary error — click ✈ to resume.');
        return;
      }
    }

    // Scope may have changed while the Lambda call was in flight (agent Exited, an idle-check fired,
    // or the agent re-activated). Bail so a stale turn can't stage a reply, pop a proposed action,
    // or send under a new activation.
    if (store.getSlot(contactId)?.autopilotScope !== scope) return;

    // Kick off the evidence locator in parallel with the human-like send delay —
    // by the time the proposedAction card renders, the spans are usually ready.
    // Failures resolve to null: the card simply renders without highlights.
    const evidencePromise = result.proposedAction
      ? post<{ evidence: EvidenceSpan[] }>('/autopilot-turn', {
          scope: 'locate-evidence',
          transcript: currentSlot.messages,
          proposedAction: result.proposedAction,
        }).catch(() => null)
      : null;

    // Update suggested scope if Lambda returned one
    if (result.suggestedScope !== undefined) {
      store.patchSlot(contactId, { suggestedScope: result.suggestedScope as AutopilotScope | null });
    }

    // Send the response with delay
    if (result.response) {
      const sent = await autopilotSend(result.response, contactId, scope);
      if (!sent) return; // cancelled while waiting
    }

    // Schedule callback if Lambda decided we have enough info
    if (result.scheduleCallback) {
      try {
        const cbResult = await post<{ displayTime: string; message: string }>('/schedule-callback', {
          clientId: result.scheduleCallback.clientId,
          clientName: result.scheduleCallback.clientName,
          phoneNumber: result.scheduleCallback.phoneNumber,
          scheduledTime: result.scheduleCallback.scheduledTimeISO,
          intentSummary: result.scheduleCallback.intentSummary,
          // Link the callback to THIS conversation so the phone cockpit shows the real
          // originating transcript (not a fabricated one). Captured here because the messages
          // exist now, before the transcript is persisted at chat end.
          originTranscriptId: contactId,
          originMessages: currentSlot.messages.map(m => ({ role: m.role, content: m.content })),
        });
        // Append system note so next Lambda turn (triggered by customer reply) knows callback was scheduled
        store.appendMessage(contactId, {
          role: 'SYSTEM',
          content: `[CALLBACK_SCHEDULED] ${cbResult.displayTime} → ${result.scheduleCallback.phoneNumber}`,
        });
        // Do NOT fire another Lambda turn here — the agent already sent the confirmation.
        // Wait for the customer to reply; the lastCustomerMsg effect will call runAutopilotTurn
        // and the Lambda will proceed to "Is there anything else?" (Step 6 of CALLBACK_PROMPT).
        return;
      } catch (e) {
        console.warn('Schedule callback failed', e);
        store.appendMessage(contactId, {
          role: 'SYSTEM', content: '⚠ Callback scheduling failed — please try manually.',
        });
      }
    }

    // Insert [TASK: id] system message when task is identified (phase 1)
    if (result.taskIdentified) {
      store.appendMessage(contactId, {
        role: 'SYSTEM',
        content: `[TASK: ${result.taskIdentified}]`,
      });
    }

    // Handle proposed action — store it and exit autopilot
    if (result.proposedAction) {
      clearAutopilotTimers();
      store.patchSlot(contactId, {
        proposedAction: result.proposedAction,
        proposedActionEvidence: null,
        autopilotScope: null,
        autopilotFlash: true,
        autopilotPending: null,
        autopilotPaused: false,
        autopilotSendAt: null,
        autopilotPausedRemainingMs: null,
        autopilotExitMessage: result.exitMessage ?? 'All fields collected — proposed action is ready for review.',
      });
      setTimeout(() => store.patchSlot(contactId, { autopilotFlash: false }), 100);
      // Attached only after the proposedAction is stored; if the card was
      // already rejected or replaced when the locator resolves, skip the patch.
      evidencePromise?.then(r => {
        if (!r?.evidence?.length) return;
        if (store.getSlot(contactId)?.proposedAction !== result.proposedAction) return;
        store.patchSlot(contactId, { proposedActionEvidence: r.evidence });
      });
      return;
    }

    if (result.shouldExitAutopilot) {
      exitAutopilot(contactId, result.exitMessage);
      if (result.closeChat) {
        // Route through ACW (not 'ended') so the agent must explicitly close the contact.
        // The ACW UI generates a summary and the agent clicks "Close contact" to end properly.
        store.patchSlot(contactId, { status: 'acw' });
      }
    }
  };

  // ── "Change to": pre-generate alternative directions AFTER a suggestion is shown ───────
  // Fired after addSuggestion so it never delays the suggestion display. Attaches options to
  // the just-added entry by id; failure → [] (menu then shows "no alternatives").
  const generateChangeOptions = (contactId: string) => {
    const s = store.getSlot(contactId);
    const entry = s?.suggestionHistory[s.suggestionHistory.length - 1];
    if (!s || !entry) return;
    const clientProfile = CLIENT_PROFILES[s.clientId] ?? DEFAULT_PROFILE;
    store.setChangeOptionsLoading(contactId, entry.id, true);
    post<{ options: string[] }>('/next-best-response', {
      mode: 'change-options',
      transcript: s.messages,
      clientProfile,
      currentSuggestion: entry.text,
    })
      .then(r => store.setChangeOptions(contactId, entry.id, r.options ?? []))
      .catch(() => store.setChangeOptions(contactId, entry.id, []));
  };

  // ── "Change to": author a fresh reply along the agent's chosen direction (on select) ───
  const handleChangeTo = (direction: string) => {
    if (!slot) return;
    const contactId = slot.contactId;
    const s = store.getSlot(contactId);
    if (!s) return;
    const rejected = s.suggestionHistory[s.suggestionIndex]?.text ?? '';   // the draft being changed
    const clientProfile = CLIENT_PROFILES[s.clientId] ?? DEFAULT_PROFILE;
    store.patchSlot(contactId, { suggestionLoading: true });   // reuse the header spinner
    post<{ suggestedText: string; resources?: { id: string; title: string; url: string }[] }>(
      '/next-best-response',
      { mode: 'change-reply', transcript: s.messages, clientProfile, direction, currentSuggestion: rejected },
    )
      .then(r => {
        if (r.suggestedText && r.suggestedText.trim()) {
          store.addChangeToReply(contactId, r.suggestedText, direction);
          generateChangeOptions(contactId);                    // the new entry gets its own menu
        }
        store.patchSlot(contactId, {
          suggestionLoading: false,
          ...(r.resources ? { suggestedResources: r.resources } : {}),
        });
      })
      .catch(() => store.patchSlot(contactId, { suggestionLoading: false }));
  };

  // ── NBR: fetch a fresh suggested reply. Fires on customer reply AND right after the agent
  // sends (the shown suggestion is then stale). Reads the LIVE transcript so it includes the
  // latest message; pre-generates the new entry's "Change to" options after display. ────────
  const runNbrRefresh = (contactId: string) => {
    const s = store.getSlot(contactId);
    if (!s || s.status !== 'active') return;
    const clientProfile = CLIENT_PROFILES[s.clientId] ?? DEFAULT_PROFILE;
    store.patchSlot(contactId, { suggestionLoading: true });
    post<{ suggestedText: string; resources: Array<{ id: string; title: string; url: string }>; suggestedScope?: string | null }>(
      '/next-best-response',
      { transcript: s.messages, clientProfile },
    )
      .then(result => {
        if (result.suggestedText && result.suggestedText.trim()) {
          store.addSuggestion(contactId, result.suggestedText, 'nbr');
          generateChangeOptions(contactId);
        }
        const patch: Partial<ContactSlot> = {
          suggestedResources: result.resources,
          suggestionLoading: false,
        };
        if (result.suggestedScope !== undefined && !store.getSlot(contactId)?.autopilotScope) {
          patch.suggestedScope = result.suggestedScope as AutopilotScope | null;
        }
        store.patchSlot(contactId, patch);
      })
      .catch(e => { console.warn('NBR fetch failed', e); store.patchSlot(contactId, { suggestionLoading: false }); });
  };

  // ── "Magic": restyle the currently-shown reply — same meaning, new presentation ──────────
  const handleMagic = (style: string) => {
    if (!slot) return;
    const contactId = slot.contactId;
    const s = store.getSlot(contactId);
    const entry = s?.suggestionHistory[s.suggestionIndex];
    if (!s || !entry) return;
    const clientProfile = CLIENT_PROFILES[s.clientId] ?? DEFAULT_PROFILE;
    store.patchSlot(contactId, { suggestionLoading: true });
    post<{ suggestedText: string }>('/next-best-response', {
      mode: 'magic-rewrite',
      transcript: s.messages,
      clientProfile,
      currentSuggestion: entry.text,
      style,
    })
      .then(r => {
        if (r.suggestedText && r.suggestedText.trim()) {
          store.addMagicReply(contactId, r.suggestedText, style);
          generateChangeOptions(contactId);
        }
        store.patchSlot(contactId, { suggestionLoading: false });
      })
      .catch(() => store.patchSlot(contactId, { suggestionLoading: false }));
  };

  // ── Autopilot deck: "Change to" / "Magic" for the paused "Autopilot sending" box ─────────
  // Same NBR calls the Suggested-reply box uses, but operating on the autopilot candidate deck
  // (autopilotHistory) rather than the suggestion deck. The staged send stays paused throughout;
  // the newly-authored candidate becomes the displayed/staged reply (mirrored into autopilotPending),
  // so Resume or Send now dispatches it. suggestionLoading drives the box's header spinner — safe to
  // reuse because the Suggested-reply box is hidden while autopilot is active.

  // Pre-generate alternative directions for the currently-displayed autopilot candidate.
  const generateAutopilotChangeOptions = (contactId: string) => {
    const s = store.getSlot(contactId);
    const entry = s?.autopilotHistory[s.autopilotIndex];
    if (!s || !entry) return;
    const clientProfile = CLIENT_PROFILES[s.clientId] ?? DEFAULT_PROFILE;
    store.setAutopilotChangeOptionsLoading(contactId, entry.id, true);
    post<{ options: string[] }>('/next-best-response', {
      mode: 'change-options',
      transcript: s.messages,
      clientProfile,
      currentSuggestion: entry.text,
    })
      .then(r => store.setAutopilotChangeOptions(contactId, entry.id, r.options ?? []))
      .catch(() => store.setAutopilotChangeOptions(contactId, entry.id, []));
  };

  const handleAutopilotChangeTo = (direction: string) => {
    if (!slot) return;
    const contactId = slot.contactId;
    const s = store.getSlot(contactId);
    if (!s) return;
    const rejected = s.autopilotHistory[s.autopilotIndex]?.text ?? s.autopilotPending ?? '';
    const clientProfile = CLIENT_PROFILES[s.clientId] ?? DEFAULT_PROFILE;
    store.patchSlot(contactId, { suggestionLoading: true });
    post<{ suggestedText: string }>('/next-best-response', {
      mode: 'change-reply', transcript: s.messages, clientProfile, direction, currentSuggestion: rejected,
    })
      .then(r => {
        // Jump to the new candidate; the pause effect (autopilotIndex changed) generates its options.
        if (r.suggestedText && r.suggestedText.trim()) store.addAutopilotChangeTo(contactId, r.suggestedText, direction);
        store.patchSlot(contactId, { suggestionLoading: false });
      })
      .catch(() => store.patchSlot(contactId, { suggestionLoading: false }));
  };

  const handleAutopilotMagic = (style: string) => {
    if (!slot) return;
    const contactId = slot.contactId;
    const s = store.getSlot(contactId);
    const entry = s?.autopilotHistory[s.autopilotIndex];
    if (!s || !entry) return;
    const clientProfile = CLIENT_PROFILES[s.clientId] ?? DEFAULT_PROFILE;
    store.patchSlot(contactId, { suggestionLoading: true });
    post<{ suggestedText: string }>('/next-best-response', {
      mode: 'magic-rewrite', transcript: s.messages, clientProfile, currentSuggestion: entry.text, style,
    })
      .then(r => {
        if (r.suggestedText && r.suggestedText.trim()) store.addAutopilotMagic(contactId, r.suggestedText, style);
        store.patchSlot(contactId, { suggestionLoading: false });
      })
      .catch(() => store.patchSlot(contactId, { suggestionLoading: false }));
  };

  // ── Effect: pre-generate autopilot "Change to" options once the agent pauses ─────────────
  // Fires when the box's controls become available (pause) and whenever the displayed candidate
  // changes (paging / a fresh Change-to/Magic jump). Guarded so each entry generates at most once.
  const autopilotPausedFlag = slot?.autopilotPaused;
  const autopilotIndexNow = slot?.autopilotIndex;
  useEffect(() => {
    if (!slot || slot.autopilotScope === null || !slot.autopilotPaused) return;
    const entry = slot.autopilotHistory[slot.autopilotIndex];
    if (!entry || entry.changeOptions !== null || entry.changeOptionsLoading) return;
    generateAutopilotChangeOptions(slot.contactId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autopilotPausedFlag, autopilotIndexNow, slot?.contactId]);

  // ── Effect: Greeting suggestion on first connection ────────────────────
  const connectionToken = slot?.connectionToken;
  useEffect(() => {
    if (!slot || !connectionToken || greetedContacts.current.has(slot.contactId)) return;
    const hasAgentMsg = slot.messages.some(m => m.role === 'AGENT');
    if (hasAgentMsg) { greetedContacts.current.add(slot.contactId); return; }
    greetedContacts.current.add(slot.contactId);
    const firstName = slot.clientName.split(' ')[0];
    const close = slot.intentGreeting || 'How can I assist you today?';
    store.addSuggestion(slot.contactId, `Hi ${firstName}, my name is ${store.agentName} with Bob's Mutual Funds. ${close}`, 'greeting');
    store.patchSlot(slot.contactId, { suggestedScope: 'get-intent' });
    generateChangeOptions(slot.contactId);
  }, [connectionToken, slot?.contactId]);

  // ── Effect: Autopilot scope activation ────────────────────────────────
  const autopilotScope = slot?.autopilotScope;
  const contactId = slot?.contactId;
  useEffect(() => {
    if (!slot || slot.status !== 'active') return;
    const scope = slot.autopilotScope;
    const cid = slot.contactId;

    // Scope turned off — clear timers (flash is handled by exitAutopilot)
    if (scope === null) {
      if (prevScopeRef.current !== null) {
        clearAutopilotTimers();
        // Release this contact's init guards so a later re-activation runs its kickoff again. The
        // guard only exists to dedupe a single activation — left un-reset it made re-activating
        // autopilot after a mid-task exit a permanent no-op (the task couldn't be resumed).
        for (const k of Array.from(initRunRef.current)) {
          if (k.startsWith(`${cid}:`)) initRunRef.current.delete(k);
        }
      }
      prevScopeRef.current = null;
      return;
    }

    // No change
    if (scope === prevScopeRef.current) return;
    prevScopeRef.current = scope;
    clearAutopilotTimers();

    const initKey = `${cid}:${scope}`;
    if (initRunRef.current.has(initKey)) return;
    initRunRef.current.add(initKey);

    if (scope === 'researching') {
      // Check if agent has already excused themselves
      const hasExcused = slot.messages.some(m =>
        m.role === 'AGENT' &&
        /take.*time|look.*into|hang.*on|please.*wait|give.*me.*moment|working.*on/i.test(m.content),
      );
      if (!hasExcused) {
        autopilotSend(
          "I'm going to take a little time now to work on this for you. Please hang on.",
          cid, scope,
        );
      }
      let msgIdx = 0;
      researchIntervalRef.current = setInterval(() => {
        const fresh = store.getSlot(cid);
        if (!fresh || fresh.autopilotScope !== 'researching') {
          clearInterval(researchIntervalRef.current!);
          return;
        }
        const msg = RESEARCHING_MSGS[msgIdx % RESEARCHING_MSGS.length];
        msgIdx++;
        const token = fresh.connectionToken;
        store.appendMessage(cid, { role: 'AGENT', content: msg });
        store.patchSlot(cid, { lastAgentMessageAt: Date.now() });
        if (token) {
          post<{ ok: boolean }>('/send-agent-message', { connectionToken: token, message: msg })
            .catch(e => log.error('ChatColumn:researching:sendFailed', e));
        }
      }, 2 * 60 * 1000);

    } else if (scope === 'idle-check') {
      const msg1 = "I haven't heard from you in a bit. Are we still connected?";
      const msg2 = "Still waiting to hear from you. If I don't hear back soon I'll need to disconnect this chat.";
      const msg3 = "Since we haven't heard back, I'm closing this chat now. Thank you for contacting Bob's Mutual Funds!";

      autopilotSend(msg1, cid, scope);

      idleTimer1Ref.current = setTimeout(() => {
        const s = store.getSlot(cid);
        if (!s || s.autopilotScope !== 'idle-check') return;
        const token = s.connectionToken;
        store.appendMessage(cid, { role: 'AGENT', content: msg2 });
        store.patchSlot(cid, { lastAgentMessageAt: Date.now() });
        if (token) {
          post<{ ok: boolean }>('/send-agent-message', { connectionToken: token, message: msg2 })
            .catch(e => log.error('ChatColumn:idleCheck:msg2Failed', e));
        }

        idleTimer2Ref.current = setTimeout(() => {
          const s2 = store.getSlot(cid);
          if (!s2 || s2.autopilotScope !== 'idle-check') return;
          const token2 = s2.connectionToken;
          store.appendMessage(cid, { role: 'AGENT', content: msg3 });
          if (token2) {
            post<{ ok: boolean }>('/send-agent-message', { connectionToken: token2, message: msg3 })
              .catch(e => log.error('ChatColumn:idleCheck:msg3Failed', e));
          }
          const slotForSave = store.getSlot(cid);
          if (slotForSave) saveTranscript(slotForSave);
          store.patchSlot(cid, { status: 'ended' });
          exitAutopilot(cid);
        }, 2 * 60 * 1000);
      }, 2 * 60 * 1000);

    } else if (scope === 'callback') {
      // callback always uses Lambda
      runAutopilotTurn(cid, scope);
    } else {
      // get-intent / full-auto: if a task is already in progress (a [TASK:] marker is in the
      // transcript), always run a fresh Lambda turn so re-activation RESUMES field collection.
      // Only reuse the currently-shown suggestion for a first activation (greeting / no task yet) —
      // replaying a stale suggestion mid-task would send an off-task message.
      const hasTaskMarker = slot.messages.some(m => m.role === 'SYSTEM' && /^\[TASK:/.test(m.content));
      const existingSuggestion = slot.suggestedText?.trim();
      if (existingSuggestion && !hasTaskMarker) {
        autopilotSend(existingSuggestion, cid, scope);
      } else {
        runAutopilotTurn(cid, scope);
      }
    }
  }, [autopilotScope, contactId]);

  // ── Effect: NBR + reactive autopilot on customer message ──────────────
  const lastCustomerMsg = slot?.lastCustomerMessageAt;
  useEffect(() => {
    if (!slot || slot.status !== 'active' || !lastCustomerMsg) return;
    const cid = slot.contactId;
    const clientProfile = CLIENT_PROFILES[slot.clientId] ?? DEFAULT_PROFILE;

    // Customer replied — cancel autopilot idle timer and agent-question idle timer
    if (autopilotIdleRef.current) { clearTimeout(autopilotIdleRef.current); autopilotIdleRef.current = null; }
    if (agentQuestionIdleRef.current) { clearTimeout(agentQuestionIdleRef.current); agentQuestionIdleRef.current = null; }

    // NBR (always, even when autopilot is on — keeps suggestions fresh)
    runNbrRefresh(cid);

    // Reactive autopilot turn
    const scope = slot.autopilotScope;
    if (!scope) return;

    // Idle check: customer responded — they're not idle, exit
    if (scope === 'idle-check') {
      exitAutopilot(cid);
      return;
    }

    // All other scopes: call Lambda
    runAutopilotTurn(cid, scope);
  }, [lastCustomerMsg]);

  // ── Effect: Idle suggestion timer (check every 30 s) ──────────────────
  useEffect(() => {
    if (!slot || slot.status !== 'active') return;
    const cid = slot.contactId;
    const timer = setInterval(() => {
      const s = store.getSlot(cid);
      if (!s || s.autopilotScope !== null) return;
      if (s.lastCustomerMessageAt && Date.now() - s.lastCustomerMessageAt > 5 * 60 * 1000) {
        store.patchSlot(cid, { suggestedScope: 'idle-check' });
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, [slot?.contactId, slot?.status]);

  // ── Effect: Generate ACW data when chat enters ACW state ──────────────
  const slotStatus = slot?.status;
  useEffect(() => {
    if (!slot || slot.status !== 'acw' || slot.acwData !== null) return;
    const cid = slot.contactId;
    const clientProfile = CLIENT_PROFILES[slot.clientId] ?? DEFAULT_PROFILE;

    post<ACWData & { wrapUpCodes?: string[] }>('/generate-acw', {
      transcript: slot.messages,
      clientProfile,
    })
      .then(data => store.patchSlot(cid, { acwData: data }))
      .catch(() => store.patchSlot(cid, {
        acwData: {
          wrapUpCode: 'General Information',
          coaching: { positive: 'Good interaction with the client.', bullets: [] },
          summary: 'Chat session completed.',
        },
      }));
  }, [slotStatus, slot?.contactId]);

  // ── Effect: Pending insert ─────────────────────────────────────────────
  const pendingInserts = store.pendingInserts;
  useEffect(() => {
    if (!slot) return;
    if (pendingInserts.has(slot.contactId)) {
      setInputText(slot.suggestedText);
      store.clearInsert(slot.contactId);
    }
  }, [pendingInserts, slot?.contactId, slot?.suggestedText]);

  // Emit a throttled typing event so the customer sees the agent composing.
  const handleInputTyping = (value: string) => {
    setInputText(value);
    if (!value.trim() || !slot?.connectionToken) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    sendCustomerTypingEvent(slot.connectionToken);
  };

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!inputText.trim() || !slot) return;
    const text = inputText.trim();
    setInputText('');
    // Telemetry: composer send — freehand (records any suggestion that was shown but ignored).
    const shown = slot.suggestionHistory[slot.suggestionIndex];
    logReplyEvent({
      contactId: slot.contactId, clientId: slot.clientId,
      agentUsername: store.agentUsername, agentName: store.agentName,
      path: 'composer-send', suggestionShownText: shown?.text, sentText: text,
    });
    sendText(text);
    // The shown suggestion is now stale — fetch a fresh one immediately.
    runNbrRefresh(slot.contactId);
    // Re-evaluate suggested scope after agent sends; clear any stale exit message
    if (slot.autopilotScope === null) {
      store.patchSlot(slot.contactId, { suggestedScope: null, autopilotExitMessage: null });
    }
  };

  const handleActivateAutopilot = (scope: AutopilotScope) => {
    if (!slot) return;
    // Keep suggestedText — the scope activation effect will consume it for get-intent/full-auto.
    // Reset any stale pause/countdown state so a fresh activation starts clean & unpaused.
    store.patchSlot(slot.contactId, {
      autopilotScope: scope, suggestedScope: null,
      autopilotPaused: false, autopilotSendAt: null, autopilotPausedRemainingMs: null,
    });
  };

  const handlePauseAutopilot = () => {
    if (slot) store.patchSlot(slot.contactId, { autopilotPaused: true });
  };

  const handleResumeAutopilot = () => {
    if (slot) store.patchSlot(slot.contactId, { autopilotPaused: false });
  };

  const handleEndChat = () => {
    if (!slot) return;
    window.dispatchEvent(
      new CustomEvent('bobs:endChat', { detail: { contactId: slot.contactId } }),
    );
  };

  // ── Visual state ───────────────────────────────────────────────────────
  const isAutopilot = slot !== null && slot.autopilotScope !== null;
  const isFlashing = slot?.autopilotFlash === true;

  // Evidence spans grouped by message id — highlighted only while the Proposed
  // Action card is visible (same condition AISupport uses to show the card).
  let evidenceByMsg: Map<string, { start: number; end: number }[]> | null = null;
  if (slot && slot.proposedAction && !slot.autopilotScope && slot.proposedActionEvidence?.length) {
    evidenceByMsg = new Map();
    for (const ev of slot.proposedActionEvidence) {
      const list = evidenceByMsg.get(ev.messageId) ?? [];
      list.push({ start: ev.start, end: ev.end });
      evidenceByMsg.set(ev.messageId, list);
    }
  }

  const borderColor = isFlashing ? '#eab308' : isAutopilot ? '#22c55e' : '#e2e8f0';
  const borderWidth = isAutopilot || isFlashing ? '4px' : '2px';
  const overlayColor = isFlashing ? 'rgba(234,179,8,0.15)' : isAutopilot ? 'rgba(34,197,94,0.12)' : 'transparent';

  return (
    // No column-level click handler: autopilot is controlled only by the explicit
    // Pause/Exit/Resume buttons (and the AI-panel ✈ toggle). Clicking anywhere else —
    // header, transcript, the resize handle — no longer exits autopilot.
    <div
      style={{
        background: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column',
        border: `${borderWidth} solid ${borderColor}`,
        overflow: 'hidden', minHeight: 0,
        boxShadow: '0 1px 6px rgba(0,0,0,.06)',
        transition: 'border-color .1s, border-width .1s',
        position: 'relative',
      }}
    >
      {/* Autopilot colour overlay (pointer-events: none so clicks pass through) */}
      {(isAutopilot || isFlashing) && (
        <div style={{
          position: 'absolute', inset: 0,
          background: overlayColor,
          pointerEvents: 'none',
          zIndex: 1,
          transition: 'background .1s',
        }} />
      )}

      {/* Empty state */}
      {!slot && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: 8,
        }}>
          <div style={{ fontSize: 40 }}>💬</div>
          <div style={{ fontSize: 16 }}>Waiting for a chat</div>
        </div>
      )}

      {/* Incoming alert */}
      {slot?.status === 'incoming' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <IncomingAlert slot={slot} />
        </div>
      )}

      {/* Active chat */}
      {slot && slot.status === 'active' && (
        <>
          {/* Static header */}
          <div style={{
            padding: '8px 14px', borderBottom: '1px solid #e5e7eb',
            background: '#f8fafc', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <button
                type="button"
                className="end-chat"
                aria-label="End chat"
                title="End chat"
                onClick={e => { e.stopPropagation(); handleEndChat(); }}
                style={{ marginLeft: '-10px', marginRight: '-10px', marginTop: '-5px', paddingRight: '5px' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  <path d="M9.5 7.5 14.5 12.5" />
                  <path d="M14.5 7.5 9.5 12.5" />
                </svg>
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div
                    style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2, cursor: 'default' }}
                    onClick={() => navigator.clipboard.writeText(slot.contactId).catch(() => {})}
                  >{slot.clientName}</div>
                  <ResponseTimer lastEventAt={
                    Math.max(slot.lastAgentMessageAt ?? 0, slot.lastCustomerMessageAt ?? 0) || null
                  } />
                </div>
                {slot.intentSummary && (
                  <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.3, marginTop: 2 }}>
                    <IntentLabel text={slot.intentSummary} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat history — scrollable */}
          <div ref={chatContainerRef} style={{
            flex: 1, overflowY: 'auto', padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0,
          }}>
            {slot.messages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                highlights={evidenceByMsg?.get(msg.id)}
                flash={flashMessageId === msg.id}
              />
            ))}
            {slot.customerTyping && <TypingDots />}
            <div ref={chatEndRef} />
          </div>

          {/* Type area — during autopilot the (unused) composer is replaced by the
              pause/exit/resume controls, lifted above the green overlay via zIndex. */}
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 10px', flexShrink: 0, position: 'relative', zIndex: 2 }}>
            {isAutopilot ? (
              slot.autopilotPaused ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => exitAutopilot(slot.contactId)}
                    style={{
                      flex: 1, padding: '12px 0', borderRadius: 8, border: 'none',
                      background: '#dc2626', color: '#fff', fontSize: 15, fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >Exit</button>
                  <button
                    onClick={handleResumeAutopilot}
                    style={{
                      flex: 1, padding: '12px 0', borderRadius: 8, border: 'none',
                      background: '#16a34a', color: '#fff', fontSize: 15, fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >Resume ▶</button>
                </div>
              ) : (
                <button
                  onClick={handlePauseAutopilot}
                  style={{
                    width: '100%', padding: '16px 0', borderRadius: 8, border: 'none',
                    background: '#1a56db', color: '#fff', fontSize: 17, fontWeight: 700,
                    cursor: 'pointer', letterSpacing: '.3px',
                  }}
                >Pause Autopilot</button>
              )
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <textarea
                  value={inputText}
                  onChange={e => handleInputTyping(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={slot.customerDisconnected ? 'Client closed the chat' : 'Type a reply…'}
                  disabled={slot.customerDisconnected}
                  rows={2}
                  style={{
                    flex: 1, resize: 'none', border: '1.5px solid #d1d5db', borderRadius: 8,
                    padding: '6px 10px', fontSize: 16, outline: 'none', fontFamily: 'inherit',
                    opacity: slot.customerDisconnected ? 0.5 : 1,
                  }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!inputText.trim() || slot.customerDisconnected}
                  style={{
                    width: 34, borderRadius: 8, border: 'none',
                    background: inputText.trim() && !slot.customerDisconnected ? '#1a56db' : '#e5e7eb',
                    color: '#fff', cursor: inputText.trim() && !slot.customerDisconnected ? 'pointer' : 'default', fontSize: 20,
                  }}
                >➤</button>
              </div>
            )}
          </div>

          {/* Drag handle — resize AI section independently per column */}
          <div
            onMouseDown={handleDragStart}
            style={{
              height: 14, cursor: 'ns-resize', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', userSelect: 'none',
            }}
          >
            <div style={{ width: 32, height: 3, borderRadius: 2, background: '#cbd5e1' }} />
          </div>

          {/* AI support panel — height per-column, resizable via drag handle above.
              When the customer has left, AI support is moot: show an explicit notice
              so the agent knows why, with End chat as the path to after-chat work. */}
          <div style={{ height: aiHeight, borderTop: '1px solid #e5e7eb', flexShrink: 0, overflow: 'hidden' }}>
            {slot.customerDisconnected ? (
              <div style={{
                height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
                background: '#fffbeb', padding: 16,
              }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#92400e', textAlign: 'center' }}>
                  Client closed the chat.
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleEndChat(); }}
                  style={{
                    padding: '8px 22px', borderRadius: 8, border: 'none',
                    background: '#1a56db', color: '#fff', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  End chat
                </button>
              </div>
            ) : (
              <AISupport
                slot={slot}
                onSend={text => { sendText(text); runNbrRefresh(slot.contactId); }}
                onSendResource={text => sendText(text)}
                onActivateAutopilot={handleActivateAutopilot}
                onChangeTo={handleChangeTo}
                onMagic={handleMagic}
                onAutopilotChangeTo={handleAutopilotChangeTo}
                onAutopilotMagic={handleAutopilotMagic}
              />
            )}
          </div>
        </>
      )}

      {/* Ended state (auto-closed via autopilot/timeout) */}
      {slot?.status === 'ended' && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', color: '#9ca3af', gap: 4,
        }}>
          <div style={{ fontSize: 30 }}>✅</div>
          <div style={{ fontSize: 16 }}>Chat ended — {slot.clientName}</div>
        </div>
      )}

      {/* After Call Work */}
      {slot?.status === 'acw' && (
        <>
          {/* ACW header */}
          <div style={{
            padding: '8px 14px', borderBottom: '1px solid #e5e7eb',
            background: '#f8fafc', flexShrink: 0,
          }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{slot.clientName}</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginTop: 1 }}>After call work</div>
          </div>
          <AfterCallWork slot={slot} />
        </>
      )}
    </div>
  );
}

// Animated ellipsis shown left-aligned (inbound) while the client is typing.
function TypingDots() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        background: '#f3f4f6', borderRadius: 10, padding: '8px 12px',
        display: 'flex', gap: 4, alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: '#9ca3af',
            display: 'inline-block',
            animation: `bobs-typing-bounce 1.2s ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <style>{`@keyframes bobs-typing-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }`}</style>
    </div>
  );
}

function MessageBubble({ msg, highlights, flash }: {
  msg: ChatMessage;
  highlights?: { start: number; end: number }[];
  flash?: boolean;
}) {
  const isAgent = msg.role === 'AGENT';
  const isSystem = msg.role === 'SYSTEM';

  if (isSystem) {
    return <div style={{ textAlign: 'center', fontSize: 14, color: '#9ca3af' }}>{msg.content}</div>;
  }

  const colors: Record<string, string> = {
    CUSTOMER: '#f3f4f6',
    AGENT: '#dbeafe',
    BOT: '#f0fdf4',
  };

  return (
    <div style={{ display: 'flex', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
      <div data-mid={msg.id} style={{
        maxWidth: '82%', background: colors[msg.role] ?? '#f3f4f6',
        borderRadius: 10, padding: '6px 10px', fontSize: 15, lineHeight: 1.5,
        color: '#111', whiteSpace: 'pre-wrap',
        boxShadow: flash ? '0 0 0 3px rgba(245,158,11,.55)' : 'none',
        transition: 'box-shadow .3s',
      }}>
        {!isAgent && (
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 2, fontWeight: 600 }}>
            {msg.role === 'BOT' ? '🤖 Bot' : 'Client'}
          </div>
        )}
        {highlights?.length ? renderHighlighted(msg.content, highlights) : msg.content}
      </div>
    </div>
  );
}
