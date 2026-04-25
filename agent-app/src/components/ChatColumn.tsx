import React, { useEffect, useRef, useState } from 'react';
import { ContactSlot, ChatMessage, AutopilotScope } from '../types';
import { useAgentStore } from '../store/agentStore';
import { post } from '../api/client';
import { log } from '../api/logger';
import { IncomingAlert } from './IncomingAlert';
import { ResponseTimer } from './ResponseTimer';
import { AISupport } from './AISupport';
import { CLIENT_PROFILES, DEFAULT_PROFILE } from '../data/clientProfiles';

const AGENT_NAME = 'John Ferrara';

interface Props {
  slotIndex: number;
  slot: ContactSlot | null;
}

// ── Autopilot helpers ──────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

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
  const prevMsgCount = useRef(0);

  // Greeting tracking
  const greetedContacts = useRef<Set<string>>(new Set());

  // Autopilot timers
  const researchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimer1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fires if no customer reply within 2 min after an autopilot message
  const autopilotIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prevent double-running the initial autopilot turn for a given contact+scope
  const initRunRef = useRef<Set<string>>(new Set());
  // Track previous scope to detect changes
  const prevScopeRef = useRef<AutopilotScope | null>(null);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (slot && slot.messages.length !== prevMsgCount.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      prevMsgCount.current = slot.messages.length;
    }
  }, [slot?.messages.length]);

  // ── sendText: append locally + POST to Connect ─────────────────────────
  const sendText = (text: string) => {
    if (!slot) return;
    store.appendMessage(slot.contactId, { role: 'AGENT', content: text });
    store.patchSlot(slot.contactId, { lastAgentMessageAt: Date.now() });

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

  // ── Autopilot: send with human-like delay (chars / 15 = seconds) ───────
  const autopilotSend = async (text: string, contactId: string, scope: AutopilotScope): Promise<boolean> => {
    const delaySecs = Math.max(1, Math.floor(text.length / 15));
    store.patchSlot(contactId, { autopilotPending: text });
    await sleep(delaySecs * 1000);
    // Abort if scope was cancelled while waiting
    const fresh = store.getSlot(contactId);
    if (!fresh || fresh.autopilotScope !== scope) {
      store.patchSlot(contactId, { autopilotPending: null });
      return false;
    }
    // Read fresh connectionToken at send time
    const token = fresh.connectionToken;
    store.appendMessage(contactId, { role: 'AGENT', content: text });
    store.patchSlot(contactId, { lastAgentMessageAt: Date.now(), autopilotPending: null });
    if (token) {
      post<{ ok: boolean }>('/send-agent-message', { connectionToken: token, message: text })
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
  const exitAutopilot = (contactId: string) => {
    clearAutopilotTimers();
    store.patchSlot(contactId, { autopilotScope: null, autopilotFlash: true, autopilotPending: null });
    setTimeout(() => store.patchSlot(contactId, { autopilotFlash: false }), 100);
  };

  const clearAutopilotTimers = () => {
    if (researchIntervalRef.current) { clearInterval(researchIntervalRef.current); researchIntervalRef.current = null; }
    if (idleTimer1Ref.current) { clearTimeout(idleTimer1Ref.current); idleTimer1Ref.current = null; }
    if (idleTimer2Ref.current) { clearTimeout(idleTimer2Ref.current); idleTimer2Ref.current = null; }
    if (autopilotIdleRef.current) { clearTimeout(autopilotIdleRef.current); autopilotIdleRef.current = null; }
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
      console.warn('Autopilot turn failed', e);
      exitAutopilot(contactId);
      return;
    }

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
        });
        // Append system note so next Lambda turn knows callback was scheduled
        store.appendMessage(contactId, {
          role: 'SYSTEM',
          content: `[CALLBACK_SCHEDULED] ${cbResult.displayTime} → ${result.scheduleCallback.phoneNumber}`,
        });
        // Immediately run another turn so Lambda can ask "Is there anything else?"
        setTimeout(() => runAutopilotTurn(contactId, scope), 200);
        return; // don't process shouldExitAutopilot from the scheduling turn
      } catch (e) {
        console.warn('Schedule callback failed', e);
        store.appendMessage(contactId, {
          role: 'SYSTEM', content: '⚠ Callback scheduling failed — please try manually.',
        });
      }
    }

    if (result.shouldExitAutopilot) {
      exitAutopilot(contactId);
      if (result.closeChat) {
        store.patchSlot(contactId, { status: 'ended' });
      }
    }
  };

  // ── Effect: Greeting suggestion on first connection ────────────────────
  const connectionToken = slot?.connectionToken;
  useEffect(() => {
    if (!slot || !connectionToken || greetedContacts.current.has(slot.contactId)) return;
    const hasAgentMsg = slot.messages.some(m => m.role === 'AGENT');
    if (hasAgentMsg) { greetedContacts.current.add(slot.contactId); return; }
    greetedContacts.current.add(slot.contactId);
    const firstName = slot.clientName.split(' ')[0];
    const close = slot.intentGreeting || 'How can I assist you today?';
    store.patchSlot(slot.contactId, {
      suggestedText: `Hi ${firstName}, my name is ${AGENT_NAME} with Bob's Mutual Funds. ${close}`,
      suggestedScope: 'get-intent',
    });
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
      if (prevScopeRef.current !== null) clearAutopilotTimers();
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
          store.patchSlot(cid, { status: 'ended' });
          exitAutopilot(cid);
        }, 2 * 60 * 1000);
      }, 2 * 60 * 1000);

    } else if (scope === 'callback') {
      // callback always uses Lambda
      runAutopilotTurn(cid, scope);
    } else {
      // get-intent / full-auto: use existing suggestedText if available, else call Lambda
      const existingSuggestion = slot.suggestedText?.trim();
      if (existingSuggestion) {
        store.patchSlot(cid, { suggestedText: '' });
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

    // Customer replied — cancel the autopilot idle timer
    if (autopilotIdleRef.current) { clearTimeout(autopilotIdleRef.current); autopilotIdleRef.current = null; }

    // NBR (always, even when autopilot is on — keeps suggestions fresh)
    post<{ suggestedText: string; resources: Array<{ id: string; title: string; url: string }>; suggestedScope?: string | null }>(
      '/next-best-response',
      { transcript: slot.messages, clientProfile },
    )
      .then(result => {
        const patch: Partial<ContactSlot> = {
          suggestedText: result.suggestedText,
          suggestedResources: result.resources,
        };
        if (result.suggestedScope !== undefined && !store.getSlot(cid)?.autopilotScope) {
          patch.suggestedScope = result.suggestedScope as AutopilotScope | null;
        }
        store.patchSlot(cid, patch);
      })
      .catch(e => console.warn('NBR fetch failed', e));

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

  // ── Effect: Pending insert ─────────────────────────────────────────────
  const pendingInserts = store.pendingInserts;
  useEffect(() => {
    if (!slot) return;
    if (pendingInserts.has(slot.contactId)) {
      setInputText(slot.suggestedText);
      store.clearInsert(slot.contactId);
    }
  }, [pendingInserts, slot?.contactId, slot?.suggestedText]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!inputText.trim() || !slot) return;
    const text = inputText.trim();
    setInputText('');
    sendText(text);
    // Re-evaluate suggested scope after agent sends
    if (slot.autopilotScope === null) {
      store.patchSlot(slot.contactId, { suggestedScope: null });
    }
  };

  const handleActivateAutopilot = (scope: AutopilotScope) => {
    if (!slot) return;
    store.patchSlot(slot.contactId, { autopilotScope: scope, suggestedScope: null, suggestedText: '' });
  };

  const handleColumnClick = () => {
    if (slot !== null && slot.autopilotScope !== null) {
      exitAutopilot(slot.contactId);
    }
  };

  // ── Visual state ───────────────────────────────────────────────────────
  const isAutopilot = slot !== null && slot.autopilotScope !== null;
  const isFlashing = slot?.autopilotFlash === true;

  const borderColor = isFlashing ? '#eab308' : isAutopilot ? '#22c55e' : '#e2e8f0';
  const borderWidth = isAutopilot || isFlashing ? '4px' : '2px';
  const overlayColor = isFlashing ? 'rgba(234,179,8,0.15)' : isAutopilot ? 'rgba(34,197,94,0.12)' : 'transparent';

  return (
    <div
      onClick={handleColumnClick}
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
          <div style={{ fontSize: 32 }}>💬</div>
          <div style={{ fontSize: 13 }}>Waiting for a chat</div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{slot.clientName}</div>
              <ResponseTimer lastEventAt={
                Math.max(slot.lastAgentMessageAt ?? 0, slot.lastCustomerMessageAt ?? 0) || null
              } />
            </div>
            {slot.intentSummary && (
              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.3, marginTop: 2 }}>
                {slot.intentSummary}
              </div>
            )}
          </div>

          {/* Chat history — scrollable */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0,
          }}>
            {slot.messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            <div ref={chatEndRef} />
          </div>

          {/* Type area */}
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 10px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                onClick={e => e.stopPropagation()} // prevent column click-to-exit on textarea focus
                placeholder="Type a reply…"
                rows={2}
                style={{
                  flex: 1, resize: 'none', border: '1.5px solid #d1d5db', borderRadius: 8,
                  padding: '6px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button
                onClick={e => { e.stopPropagation(); handleSend(); }}
                disabled={!inputText.trim()}
                style={{
                  width: 34, borderRadius: 8, border: 'none',
                  background: inputText.trim() ? '#1a56db' : '#e5e7eb',
                  color: '#fff', cursor: inputText.trim() ? 'pointer' : 'default', fontSize: 16,
                }}
              >➤</button>
            </div>
          </div>

          {/* AI support panel — fixed height, internal scroll handled by AISupport */}
          <div style={{ height: 180, borderTop: '1px solid #e5e7eb', flexShrink: 0, overflow: 'hidden' }}>
            <AISupport
              slot={slot}
              onSendResource={text => sendText(text)}
              onActivateAutopilot={handleActivateAutopilot}
            />
          </div>
        </>
      )}

      {/* Ended state */}
      {slot?.status === 'ended' && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', color: '#9ca3af', gap: 4,
        }}>
          <div style={{ fontSize: 24 }}>✅</div>
          <div style={{ fontSize: 13 }}>Chat ended — {slot.clientName}</div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isAgent = msg.role === 'AGENT';
  const isSystem = msg.role === 'SYSTEM';

  if (isSystem) {
    return <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>{msg.content}</div>;
  }

  const colors: Record<string, string> = {
    CUSTOMER: '#f3f4f6',
    AGENT: '#dbeafe',
    BOT: '#f0fdf4',
  };

  return (
    <div style={{ display: 'flex', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '82%', background: colors[msg.role] ?? '#f3f4f6',
        borderRadius: 10, padding: '6px 10px', fontSize: 12, lineHeight: 1.5,
        color: '#111', whiteSpace: 'pre-wrap',
      }}>
        {!isAgent && (
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2, fontWeight: 600 }}>
            {msg.role === 'BOT' ? '🤖 Bot' : 'Client'}
          </div>
        )}
        {msg.content}
      </div>
    </div>
  );
}
