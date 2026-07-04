import { useEffect, useRef } from 'react';
import 'amazon-connect-chatjs';
import { useAgentStore } from '../store/agentStore';
import { ChatMessage } from '../types';
import { log } from '../api/logger';
import { playChaChingSound } from '../utils/sounds';
import { post, get } from '../api/client';
import { submitProposedAction } from '../utils/submitProposedAction';

declare global {
  interface Window {
    connect: {
      core: { initCCP: (container: HTMLElement, config: unknown) => void };
      contact: (cb: (contact: ConnectContact) => void) => void;
      agent: (cb: (agent: ConnectAgent) => void) => void;
      ContactType: { CHAT: string; VOICE: string };
    };
  }
}

interface ConnectContact {
  getContactId: () => string;
  getType: () => string;
  getAttributes: () => Record<string, { value: string }>;
  getAgentConnection: () => ConnectConnection;
  getConnections: () => ConnectConnection[];
  accept: (opts?: unknown) => void;
  reject: (opts?: unknown) => void;
  clear: (opts?: unknown) => void;
  disconnect: (opts?: unknown) => void;
  onConnecting: (cb: () => void) => void;
  onConnected: (cb: () => void) => void;
  onEnded: (cb: () => void) => void;
  onDestroy: (cb: () => void) => void;
}

interface ConnectConnection {
  getType: () => string;
  getMediaType: () => string;
  destroy: (opts?: unknown) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMediaController: () => Promise<any>;
}

interface AgentState {
  name: string;
  agentStateARN: string;
  type: string;
}

interface AgentConfiguration {
  name: string;
  username: string;
}

interface ConnectAgent {
  onStateChange: (cb: (e: { newState: AgentState }) => void) => void;
  onRoutable: (cb: () => void) => void;
  onNotRoutable: (cb: () => void) => void;
  onOffline: (cb: () => void) => void;
  getName: () => string;
  getConfiguration: () => AgentConfiguration;
  getAgentStates: () => AgentState[];
  getState: () => AgentState;
  setState: (state: AgentState, opts?: { success?: () => void; failure?: () => void }) => void;
}

/** Parse pipe-separated "ROLE: content | ROLE: content" transcript from intentSummary */
function parseHistory(raw: string): ChatMessage[] {
  if (!raw) return [];
  return raw.split(' | ').flatMap((part, i) => {
    const colonIdx = part.indexOf(': ');
    if (colonIdx === -1) return [];
    const rawRole = part.slice(0, colonIdx).toUpperCase();
    const content = part.slice(colonIdx + 2).trim();
    if (!content) return [];
    const role = (['CUSTOMER', 'BOT', 'AGENT', 'SYSTEM'].includes(rawRole)
      ? rawRole
      : 'BOT') as ChatMessage['role'];
    return [{ id: `pre-${i}`, timestamp: Date.now() - (20 - i) * 1000, role, content }];
  });
}

/**
 * Module-level Map of contactId → chatjs AgentChatSession.
 * Exported so ChatColumn can call session.sendMessage() directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const agentChatSessions = new Map<string, any>();

// Module-level set prevents React StrictMode's double-mount from registering
// duplicate contact handlers (which would double-append every incoming message).
const trackedContactIds = new Set<string>();

// Tracks contacts whose prior transcript has already been loaded, so the
// "continue this chat" history is never prepended twice (StrictMode / reconnects).
const continuationLoaded = new Set<string>();

// Per-contact auto-expiry timers for the "client is typing" ellipsis. The indicator
// is hidden if no further typing event arrives within CUSTOMER_TYPING_TTL_MS.
const customerTypingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const CUSTOMER_TYPING_TTL_MS = 30_000;

// Control message prefix used to hand the customer our full agent name (first + last).
// The Connect chat DisplayName only carries the agent's first name, so the customer
// can't derive correct initials from it; we send the full name explicitly. Intercepted
// and never rendered on the customer side. Must match the customer app's sentinel.
const AGENT_NAME_SENTINEL = '__BOBS_AGENT_NAME__';

// ── Type 3 (client-submitted) proposed-action control messages ──────────────
// The client's chat sends these back to us; we intercept by content prefix and
// never render them as bubbles. Must match the customer app's sentinels exactly.
const CLIENT_APPROVED_SENTINEL = '__BOBS_CLIENT_APPROVED__'; // client submitted the form (+ JSON {fields})
const CLIENT_DECLINED_SENTINEL = '__BOBS_CLIENT_DECLINED__'; // client declined; card returns to the agent
// We send this one TO the client to drop a pending approval card (agent cancelled / ended chat).
const APPROVAL_CANCEL_SENTINEL = '__BOBS_APPROVAL_CANCEL__';

/**
 * Relay a client's approval of a Type 3 proposed action: run the exact same submit
 * path as the agent's "Submit Action" (so the confirmation is identical to Type 1).
 * Idempotent — only the first approval for an awaiting action executes.
 */
async function handleClientApproved(contactId: string, payloadRaw: string): Promise<void> {
  const store = useAgentStore.getState();
  const slot = store.getSlot(contactId);
  // Stale or duplicate (already submitted / cancelled / nothing pending) → ignore.
  if (!slot?.proposedAction || !slot.awaitingClientApproval) return;
  const action = slot.proposedAction;
  // Close the gate BEFORE awaiting so a redelivered message can't double-execute.
  store.patchSlot(contactId, { awaitingClientApproval: false });

  // Use the client's final (possibly edited) field values; fall back to the action's.
  const fieldsMap: Record<string, string> = {};
  try {
    const parsed = JSON.parse(payloadRaw) as { fields?: Array<{ key: string; value: string }> };
    for (const f of parsed.fields ?? []) fieldsMap[f.key] = f.value;
  } catch { /* fall back below */ }
  if (Object.keys(fieldsMap).length === 0) {
    for (const f of action.fields) fieldsMap[f.key] = f.value;
  }

  try {
    const res = await submitProposedAction(slot, action, fieldsMap);
    if (res.success) {
      store.patchSlot(contactId, { proposedAction: null, proposedActionEvidence: null });
    } else {
      // execute-task returned a structured failure — return the card to the agent.
      store.patchSlot(contactId, { awaitingClientApproval: false });
      store.appendMessage(contactId, { role: 'SYSTEM', content: `⚠ Client submission failed: ${res.message}` });
    }
  } catch {
    store.patchSlot(contactId, { awaitingClientApproval: false });
    store.appendMessage(contactId, { role: 'SYSTEM', content: '⚠ Client submission failed — ask them to resubmit.' });
  }
}

/** Clear the typing ellipsis for a contact and cancel its expiry timer. */
function clearCustomerTyping(contactId: string): void {
  const t = customerTypingTimers.get(contactId);
  if (t) { clearTimeout(t); customerTypingTimers.delete(contactId); }
  if (useAgentStore.getState().getSlot(contactId)?.customerTyping) {
    useAgentStore.getState().patchSlot(contactId, { customerTyping: false });
  }
}

interface PriorTranscript {
  messages?: Array<{ id?: string; ts?: number; role?: string; content?: string }>;
  startTime?: number;
  endTime?: number;
}

/**
 * For a "Continue this chat" contact, fetch the prior transcript and prepend it to
 * the slot, capped by a SYSTEM divider noting that this conversation is being continued.
 * Live messages (if any already arrived) stay after the divider.
 */
async function loadContinuationTranscript(
  contactId: string,
  transcriptId: string,
  preferredAgentUsername: string,
): Promise<void> {
  if (continuationLoaded.has(contactId)) return;
  continuationLoaded.add(contactId);
  try {
    const data = await get<{ transcript?: PriorTranscript }>(
      `/get-transcripts?transcriptId=${encodeURIComponent(transcriptId)}`,
    );
    const prior = data.transcript;
    if (!prior?.messages?.length) return;

    const priorMsgs: ChatMessage[] = prior.messages.map((m, i) => ({
      id: m.id || `prior-${i}`,
      role: (['CUSTOMER', 'AGENT', 'BOT', 'SYSTEM'].includes((m.role ?? '').toUpperCase())
        ? (m.role as string).toUpperCase()
        : 'BOT') as ChatMessage['role'],
      content: m.content ?? '',
      timestamp: m.ts ?? Date.now(),
    }));

    const when = prior.endTime ?? prior.startTime;
    const dateStr = when
      ? new Date(when).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
      : 'a previous session';
    const myUsername = useAgentStore.getState().agentUsername;
    const choseYou = preferredAgentUsername &&
      preferredAgentUsername.toLowerCase() === (myUsername ?? '').toLowerCase();
    const dividerText = `↩ Continued chat · previous conversation from ${dateStr}` +
      (choseYou ? ' · client chose to continue with you' : '');

    const divider: ChatMessage = {
      id: `cont-divider-${contactId}`,
      role: 'SYSTEM',
      content: dividerText,
      timestamp: priorMsgs[priorMsgs.length - 1]?.timestamp ?? Date.now(),
    };

    const existing = useAgentStore.getState().getSlot(contactId)?.messages ?? [];
    useAgentStore.getState().patchSlot(contactId, {
      messages: [...priorMsgs, divider, ...existing],
    });
    log.info('useConnectStreams:continuationLoaded', { contactId, transcriptId, count: priorMsgs.length });
  } catch (e) {
    continuationLoaded.delete(contactId); // allow a retry on a later event
    log.warn('useConnectStreams:continuationLoad:failed', e);
  }
}

// Prevents initCCP from being called twice (React StrictMode double-invokes effects).
// initCCP appends a new iframe every call; two iframes corrupt the Streams event bus
// and cause onRoutable/onOffline/onStateChange to never fire.
let ccpInitialized = false;

// Handle for the agent-state poll — cleared by effect cleanup.
let agentStatePollHandle: ReturnType<typeof setInterval> | null = null;

// Suppress the poll briefly after a manual setState so the optimistic UI
// update isn't clobbered by the poll reading the old Connect state.
// Cleared by success/failure callbacks; expires after 5 s regardless.
let agentStatePendingUntil = 0;

/**
 * Module-level Connect agent reference for external state changes (e.g. TopBar Available/Away).
 * Set once when the agent initializes via window.connect.agent().
 */
let connectAgentInstance: ConnectAgent | null = null;

/** Call Connect's agent setState API — used by TopBar Available/Away buttons. */
export function setConnectAgentState(stateName: 'Available' | 'Away'): void {
  if (!connectAgentInstance) {
    console.warn('setConnectAgentState: agent not initialized yet');
    return;
  }
  try {
    const states = connectAgentInstance.getAgentStates();
    // Amazon Connect has no built-in "Away" state — it calls it "Offline"
    const connectName = stateName === 'Away' ? 'Offline' : 'Available';
    const target = states.find(s => s.name === connectName)
      ?? states.find(s => s.type === (stateName === 'Away' ? 'offline' : 'routable'));
    if (target) {
      agentStatePendingUntil = Date.now() + 5000;
      connectAgentInstance.setState(target, {
        // Do NOT clear agentStatePendingUntil on success — Connect's own
        // onStateChange/onOffline callbacks fire after success and would
        // snap the optimistic UI back if the suppression is already gone.
        // The 5 s window expires naturally and the poll confirms final state.
        success: () => console.info('Connect setState succeeded:', connectName),
        failure: () => {
          console.warn('Connect setState failed for', connectName);
          agentStatePendingUntil = 0;
          try {
            const s = connectAgentInstance?.getState();
            if (s) useAgentStore.getState().setAgentStatus(s.name === 'Available' ? 'Available' : 'Away');
          } catch { /* ignore */ }
        },
      });
    } else {
      console.warn(
        'Connect state not found:', connectName,
        '| available:', states.map(s => `${s.name}(${s.type})`).join(', '),
      );
    }
  } catch (e) {
    console.warn('Could not set Connect agent state', e);
  }
}

export function useConnectStreams(ccpContainerRef: React.RefObject<HTMLDivElement | null>) {
  const store = useAgentStore();
  const autoAcceptTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const contactRefs = useRef<Map<string, ConnectContact>>(new Map());

  useEffect(() => {
    if (!ccpContainerRef.current) return;
    if (!window.connect?.core) {
      console.warn('amazon-connect-streams not loaded yet');
      return;
    }
    const ccpUrl = import.meta.env.VITE_CCP_URL;
    if (!ccpUrl) {
      console.warn('VITE_CCP_URL not set');
      return;
    }

    // ── Manual Accept / Skip / Close / EndChat ────────────────────────────────
    // Defined before the ccpInitialized guard so listeners survive StrictMode's
    // cleanup-and-remount cycle (the guard blocks CCP re-init, not listener re-registration).
    const handleAccept = (e: Event) => {
      const { contactId } = (e as CustomEvent<{ contactId: string }>).detail;
      const timer = autoAcceptTimers.current.get(contactId);
      if (timer) { clearTimeout(timer); autoAcceptTimers.current.delete(contactId); }
      const contact = contactRefs.current.get(contactId);
      if (contact) contact.accept({});
      else console.warn('Accept: no contact ref for', contactId);
    };
    const handleSkip = (e: Event) => {
      const { contactId } = (e as CustomEvent<{ contactId: string }>).detail;
      const timer = autoAcceptTimers.current.get(contactId);
      if (timer) { clearTimeout(timer); autoAcceptTimers.current.delete(contactId); }
      const contact = contactRefs.current.get(contactId);
      if (contact) contact.reject({});
      contactRefs.current.delete(contactId);
      agentChatSessions.delete(contactId);
      store.clearSlot(contactId);
    };
    // onDestroy does NOT fire for already-ended chat contacts after contact.clear().
    // Always call clearSlot directly — don't rely on onDestroy as the trigger.
    const handleCloseContact = (e: Event) => {
      const { contactId } = (e as CustomEvent<{ contactId: string }>).detail;
      const contact = contactRefs.current.get(contactId);
      if (contact) {
        try { contact.clear({}); } catch { /* ignore — already ended */ }
      }
      contactRefs.current.delete(contactId);
      agentChatSessions.delete(contactId);
      store.clearSlot(contactId);
    };
    // End the active chat in Amazon Connect (agent-initiated disconnect → moves to ACW).
    // Destroys the agent connection via Connect Streams, which fires contact.onEnded()
    // and lets the normal ACW transition handle the rest.
    const handleEndChat = (e: Event) => {
      const { contactId } = (e as CustomEvent<{ contactId: string }>).detail;
      const contact = contactRefs.current.get(contactId);
      // If a Type 3 action is still out with the client, tell their chat to drop the card.
      const endingSlot = useAgentStore.getState().getSlot(contactId);
      if (endingSlot?.awaitingClientApproval && endingSlot.connectionToken) {
        post('/send-agent-message', {
          connectionToken: endingSlot.connectionToken, message: APPROVAL_CANCEL_SENTINEL,
        }).catch(() => {});
      }
      // Customer already left: the contact has (almost certainly) ended and
      // contact.onEnded deliberately held the slot at 'active' for the notice —
      // destroying the connection again won't re-fire onEnded, so transition
      // to ACW directly. The destroy is best-effort for the rare case Connect
      // still considers the agent connected.
      if (useAgentStore.getState().getSlot(contactId)?.customerDisconnected) {
        try { contact?.getAgentConnection().destroy({}); } catch { /* already gone */ }
        store.patchSlot(contactId, { status: 'acw' });
        return;
      }
      if (contact) {
        try {
          contact.getAgentConnection().destroy({});
        } catch (err) {
          log.warn('useConnectStreams:endChat:destroyFailed', err);
          store.patchSlot(contactId, { status: 'acw' });
        }
      } else {
        log.warn('useConnectStreams:endChat:noContact', { contactId });
        store.patchSlot(contactId, { status: 'acw' });
      }
    };
    window.addEventListener('bobs:acceptContact', handleAccept);
    window.addEventListener('bobs:skipContact', handleSkip);
    window.addEventListener('bobs:closeContact', handleCloseContact);
    window.addEventListener('bobs:endChat', handleEndChat);

    if (ccpInitialized) {
      return () => {
        window.removeEventListener('bobs:acceptContact', handleAccept);
        window.removeEventListener('bobs:skipContact', handleSkip);
        window.removeEventListener('bobs:closeContact', handleCloseContact);
        window.removeEventListener('bobs:endChat', handleEndChat);
      };
    }
    ccpInitialized = true;

    window.connect.core.initCCP(ccpContainerRef.current, {
      ccpUrl,
      loginPopup: true,
      loginPopupAutoClose: true,
      softphone: { allowFramedSoftphone: true },
      chat: { disableMultipleChatWindows: false },
    });

    // ── Contact events ────────────────────────────────────────────────────────
    window.connect.contact(contact => {
      const contactId = contact.getContactId();
      // StrictMode runs effects twice, registering two subscribers. Skip all event
      // registration for a contactId that's already being handled.
      if (trackedContactIds.has(contactId)) return;
      trackedContactIds.add(contactId);

      contact.onConnecting(() => {
        const attrs = contact.getAttributes();
        contactRefs.current.set(contactId, contact);

        const rawHistory = attrs.intentSummary?.value ?? '';
        const initialMessages = parseHistory(rawHistory);
        const displayLabel = attrs.intentLabel?.value || 'General inquiry';
        const intentGreeting = attrs.intentGreeting?.value || '';
        const continuedFromTranscriptId = attrs.continuedFromTranscriptId?.value || '';
        const isContinuation = (attrs.continuation?.value || '') === 'true';
        const preferredAgentUsername = attrs.preferredAgentUsername?.value || '';

        const idx = store.addContact({
          contactId,
          clientId: attrs.clientId?.value ?? 'demo-client-001',
          clientName: attrs.clientName?.value ?? 'Alex Johnson',
          intentSummary: displayLabel,
          intentGreeting,
          status: 'incoming',
          continuedFromTranscriptId: continuedFromTranscriptId || undefined,
          isContinuation: isContinuation || undefined,
          preferredAgentUsername: preferredAgentUsername || undefined,
        }, initialMessages);

        if (idx === null) {
          contact.reject();
          contactRefs.current.delete(contactId);
          return;
        }

        const timer = setTimeout(() => {
          contact.accept({});
          autoAcceptTimers.current.delete(contactId);
        }, 10000);
        autoAcceptTimers.current.set(contactId, timer);
      });

      contact.onConnected(async () => {
        const timer = autoAcceptTimers.current.get(contactId);
        if (timer) { clearTimeout(timer); autoAcceptTimers.current.delete(contactId); }

        store.patchSlot(contactId, { status: 'active' });

        // "Continue this chat": once the agent accepts, load the prior transcript
        // into this column above a "continued chat" divider.
        const acceptedSlot = useAgentStore.getState().getSlot(contactId);
        if (acceptedSlot?.continuedFromTranscriptId) {
          loadContinuationTranscript(
            contactId,
            acceptedSlot.continuedFromTranscriptId,
            acceptedSlot.preferredAgentUsername ?? '',
          );
        }

        // ── Establish agent chat session via chatjs getMediaController() ──────
        try {
          const agentConn = contact.getAgentConnection();
          if (!agentConn) {
            console.warn('No agent connection for', contactId);
            return;
          }

          const chatSession = await agentConn.getMediaController();
          if (!chatSession) {
            console.warn('getMediaController() returned null for', contactId);
            return;
          }

          // DO NOT call chatSession.connect() for agent sessions obtained via
          // getMediaController(). Those sessions are already connected through the
          // Streams CCP WebSocket proxy. Calling connect() on them establishes a
          // second, separate connection using browser IAM credentials, which have
          // an explicit deny for connectparticipant:SendMessage — causing a 403.
          agentChatSessions.set(contactId, chatSession);

          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const details = (chatSession as any).getChatDetails?.() ?? {};
            const connectionToken: string | null =
              details?.connectionDetails?.connectionToken ?? null;
            log.info('useConnectStreams:onConnected', {
              contactId,
              sessionKeys: Object.keys(chatSession),
              detailKeys: Object.keys(details),
              hasConnectionToken: !!connectionToken,
              connectionDetailsKeys: Object.keys(details?.connectionDetails ?? {}),
            });
            if (connectionToken) {
              store.patchSlot(contactId, { connectionToken });
              // Send our full name (first + last) so the customer chat shows correct
              // initials — Connect's chat DisplayName is only the agent's first name.
              const fullName = useAgentStore.getState().agentName?.trim();
              if (fullName) {
                post('/send-agent-message', {
                  connectionToken, message: `${AGENT_NAME_SENTINEL}${fullName}`,
                }).catch(() => {});
              }
            } else {
              log.warn('useConnectStreams:noConnectionToken', { contactId, detailKeys: Object.keys(details) });
            }
          } catch (e) {
            log.warn('useConnectStreams:getChatDetails:failed', e);
          }

          chatSession.onMessage(({ data: msg }: { data: { Type: string; ParticipantRole: string; Content: string; ContentType?: string } }) => {
            // Customer left the chat (closed it / ended their side). chatjs has no
            // dedicated callback for participant.left — unmapped event content types
            // fall through to onMessage. The contact itself stays active until the
            // agent explicitly ends it, so surface the disconnect in the column.
            if (
              msg?.Type === 'EVENT' &&
              msg.ContentType === 'application/vnd.amazonaws.connect.event.participant.left' &&
              msg.ParticipantRole === 'CUSTOMER'
            ) {
              clearCustomerTyping(contactId);
              const leftSlot = useAgentStore.getState().getSlot(contactId);
              if (leftSlot?.status === 'active') {
                useAgentStore.getState().patchSlot(contactId, {
                  customerDisconnected: true,
                  customerTyping: false,
                  // Nobody is listening anymore — stop autopilot and pending sends.
                  autopilotScope: null,
                  autopilotPending: null,
                  autopilotPaused: false,
                  autopilotSendAt: null,
                  autopilotPausedRemainingMs: null,
                  suggestedScope: null,
                  // A Type 3 action sent to the client can no longer be submitted.
                  ...(leftSlot.awaitingClientApproval ? { awaitingClientApproval: false } : {}),
                });
                if (leftSlot.awaitingClientApproval) {
                  useAgentStore.getState().appendMessage(contactId, {
                    role: 'SYSTEM', content: 'Client left before submitting the proposed action.',
                  });
                }
              }
              log.info('useConnectStreams:customerLeft', { contactId });
              return;
            }
            if (msg?.Type !== 'MESSAGE') return;
            // Type 3 control messages from the client — handle, never render as a bubble.
            if (msg.ParticipantRole === 'CUSTOMER' && typeof msg.Content === 'string') {
              if (msg.Content.startsWith(CLIENT_APPROVED_SENTINEL)) {
                handleClientApproved(contactId, msg.Content.slice(CLIENT_APPROVED_SENTINEL.length));
                return;
              }
              if (msg.Content === CLIENT_DECLINED_SENTINEL) {
                if (useAgentStore.getState().getSlot(contactId)?.awaitingClientApproval) {
                  useAgentStore.getState().patchSlot(contactId, { awaitingClientApproval: false });
                  useAgentStore.getState().appendMessage(contactId, {
                    role: 'SYSTEM', content: 'Client declined the proposed action.',
                  });
                }
                return;
              }
            }
            if (msg.ParticipantRole === 'AGENT') return;
            const role = msg.ParticipantRole === 'CUSTOMER' ? 'CUSTOMER' as const : 'BOT' as const;
            // The client's message arrived — they're done typing.
            if (role === 'CUSTOMER') clearCustomerTyping(contactId);
            useAgentStore.getState().appendMessage(contactId, { role, content: msg.Content });
            useAgentStore.getState().patchSlot(contactId, { lastCustomerMessageAt: Date.now() });
            log.info('useConnectStreams:onMessage', { contactId, role, preview: msg.Content.slice(0, 40) });
          });

          // Client typing → show an ellipsis in this column; auto-expire after 30 s of silence.
          chatSession.onTyping(({ data }: { data?: { ParticipantRole?: string } }) => {
            if (data?.ParticipantRole && data.ParticipantRole !== 'CUSTOMER') return;
            if (useAgentStore.getState().getSlot(contactId)?.status !== 'active') return;
            useAgentStore.getState().patchSlot(contactId, { customerTyping: true });
            const existing = customerTypingTimers.get(contactId);
            if (existing) clearTimeout(existing);
            customerTypingTimers.set(contactId, setTimeout(() => {
              customerTypingTimers.delete(contactId);
              useAgentStore.getState().patchSlot(contactId, { customerTyping: false });
            }, CUSTOMER_TYPING_TTL_MS));
          });

          chatSession.onConnectionEstablished(() => {
            log.info('useConnectStreams:connectionEstablished', { contactId });
          });

          chatSession.onConnectionLost(() => {
            log.warn('useConnectStreams:connectionLost', { contactId });
          });

          chatSession.onConnectionBroken(() => {
            log.warn('useConnectStreams:connectionBroken', { contactId });
          });

        } catch (e) {
          log.error('useConnectStreams:onConnected:failed', e);
          console.warn('Could not establish agent chat session', e);
        }
      });

      contact.onEnded(() => {
        const timer = autoAcceptTimers.current.get(contactId);
        if (timer) { clearTimeout(timer); autoAcceptTimers.current.delete(contactId); }

        // Keep contactRef alive — needed for contact.clear() when agent clicks Close Contact
        // Do NOT delete from contactRefs here

        clearCustomerTyping(contactId);
        agentChatSessions.delete(contactId);

        // Bonus: if this was the 4th chat, play sound and tally
        const slot = useAgentStore.getState().getSlot(contactId);
        if (slot?.bonusEligible) {
          playChaChingSound();
          useAgentStore.getState().addBonus(50);
        }

        // Save transcript now (no ACW data yet) — AfterCallWork will overwrite with ACW data
        const slotNow = useAgentStore.getState().getSlot(contactId);
        if (slotNow) {
          const msgs = slotNow.messages;
          const now = Date.now();
          post('/save-transcript', {
            transcriptId: slotNow.contactId,
            clientId: slotNow.clientId,
            clientName: slotNow.clientName,
            intentSummary: slotNow.intentSummary,
            startTime: msgs[0]?.timestamp ?? now,
            endTime: msgs[msgs.length - 1]?.timestamp ?? now,
            agentUsername: useAgentStore.getState().agentUsername,
            agentName: useAgentStore.getState().agentName,
            messages: msgs.map(m => ({ id: m.id, ts: m.timestamp, role: m.role, content: m.content })),
          }).catch(() => {});
        }

        // Customer-initiated end (participant.left already seen): hold the slot
        // at 'active' so the "Client closed the chat." notice stays visible —
        // jumping straight to ACW feels abrupt/unexplained. The agent's explicit
        // End chat click (handleEndChat) makes the ACW transition instead.
        if (slotNow?.customerDisconnected) return;

        // Agent-initiated end: transition to ACW — do NOT auto-clear
        store.patchSlot(contactId, { status: 'acw' });
      });

      contact.onDestroy(() => {
        trackedContactIds.delete(contactId);
        agentChatSessions.delete(contactId);
        continuationLoaded.delete(contactId);
        clearCustomerTyping(contactId);
        const destroyedSlot = useAgentStore.getState().getSlot(contactId);
        const currentStatus = destroyedSlot?.status;
        if (currentStatus === 'acw' || (currentStatus === 'active' && destroyedSlot?.customerDisconnected)) {
          // Preserve contactRef so the Close Contact button can still call contact.clear()
          // to signal Connect the agent is done with ACW. Ref is cleaned up by handleCloseContact.
          // (Also preserved while holding the "Client closed the chat." notice — the
          // agent still needs to reach ACW from there.)
        } else {
          contactRefs.current.delete(contactId);
          store.clearSlot(contactId);
        }
      });
    });

    // ── Agent state ───────────────────────────────────────────────────────────
    window.connect.agent(agent => {
      connectAgentInstance = agent;
      useAgentStore.getState().setAgentConnected(true);
      const config = agent.getConfiguration();
      console.info('[Connect] agent config — name:', config.name, '| username:', config.username);
      const rawName = (config.name || agent.getName() || '').trim();
      const agentDisplayName = rawName.split(/\s+/).length >= 2
        ? rawName
        : (config.username || '').split(/[-_.@]/).filter(Boolean)
            .map((p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
            .join(' ') || rawName;
      useAgentStore.getState().setAgentName(agentDisplayName);
      useAgentStore.getState().setAgentUsername(config.username || '');

      // Sync on (re-)init
      const syncFromAgent = () => {
        if (Date.now() < agentStatePendingUntil) return; // suppress during pending setState
        try {
          const s = connectAgentInstance?.getState();
          if (!s) return;
          console.info('[Connect] getState:', s.name, '| type:', s.type);
          useAgentStore.getState().setAgentStatus(s.name === 'Available' ? 'Available' : 'Away');
        } catch { /* ignore */ }
      };

      syncFromAgent();

      // Poll every 1 s — belt-and-suspenders for the Offline→Available
      // transition where onRoutable/onStateChange reliably do not fire.
      // Zustand no-ops the set if the value is unchanged, so no extra renders.
      if (agentStatePollHandle) clearInterval(agentStatePollHandle);
      agentStatePollHandle = setInterval(syncFromAgent, 1000);

      agent.onRoutable(() => {
        if (Date.now() < agentStatePendingUntil) return;
        useAgentStore.getState().setAgentStatus('Available');
      });
      agent.onOffline(() => {
        if (Date.now() < agentStatePendingUntil) return;
        useAgentStore.getState().setAgentStatus('Away');
      });
      agent.onStateChange(({ newState }) => {
        if (Date.now() < agentStatePendingUntil) return;
        console.info('[Connect] onStateChange:', newState.name, '| type:', newState.type);
        useAgentStore.getState().setAgentStatus(newState.name === 'Available' ? 'Available' : 'Away');
      });
    });

    return () => {
      window.removeEventListener('bobs:acceptContact', handleAccept);
      window.removeEventListener('bobs:skipContact', handleSkip);
      window.removeEventListener('bobs:closeContact', handleCloseContact);
      window.removeEventListener('bobs:endChat', handleEndChat);
      if (agentStatePollHandle) { clearInterval(agentStatePollHandle); agentStatePollHandle = null; }
    };
  }, []);
}
