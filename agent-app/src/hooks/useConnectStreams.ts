import { useEffect, useRef } from 'react';
import 'amazon-connect-chatjs';
import { useAgentStore } from '../store/agentStore';
import { ChatMessage } from '../types';
import { log } from '../api/logger';
import { playChaChingSound } from '../utils/sounds';
import { post } from '../api/client';

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

        const idx = store.addContact({
          contactId,
          clientId: attrs.clientId?.value ?? 'demo-client-001',
          clientName: attrs.clientName?.value ?? 'Alex Johnson',
          intentSummary: displayLabel,
          intentGreeting,
          status: 'incoming',
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
            } else {
              log.warn('useConnectStreams:noConnectionToken', { contactId, detailKeys: Object.keys(details) });
            }
          } catch (e) {
            log.warn('useConnectStreams:getChatDetails:failed', e);
          }

          chatSession.onMessage(({ data: msg }: { data: { Type: string; ParticipantRole: string; Content: string } }) => {
            if (msg?.Type !== 'MESSAGE') return;
            if (msg.ParticipantRole === 'AGENT') return;
            const role = msg.ParticipantRole === 'CUSTOMER' ? 'CUSTOMER' as const : 'BOT' as const;
            useAgentStore.getState().appendMessage(contactId, { role, content: msg.Content });
            useAgentStore.getState().patchSlot(contactId, { lastCustomerMessageAt: Date.now() });
            log.info('useConnectStreams:onMessage', { contactId, role, preview: msg.Content.slice(0, 40) });
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
            messages: msgs.map(m => ({ id: m.id, ts: m.timestamp, role: m.role, content: m.content })),
          }).catch(() => {});
        }

        // Transition to ACW — do NOT auto-clear
        store.patchSlot(contactId, { status: 'acw' });
      });

      contact.onDestroy(() => {
        trackedContactIds.delete(contactId);
        agentChatSessions.delete(contactId);
        const currentStatus = useAgentStore.getState().getSlot(contactId)?.status;
        if (currentStatus === 'acw') {
          // Preserve contactRef so the Close Contact button can still call contact.clear()
          // to signal Connect the agent is done with ACW. Ref is cleaned up by handleCloseContact.
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
      useAgentStore.getState().setAgentName(config.name || agent.getName());
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
