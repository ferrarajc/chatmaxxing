import { useEffect, useRef } from 'react';
import 'amazon-connect-chatjs';
import { useAgentStore } from '../store/agentStore';
import { ChatMessage } from '../types';
import { log } from '../api/logger';
import { playChaChingSound } from '../utils/sounds';

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
  onConnecting: (cb: () => void) => void;
  onConnected: (cb: () => void) => void;
  onEnded: (cb: () => void) => void;
  onDestroy: (cb: () => void) => void;
}

interface ConnectConnection {
  getType: () => string;
  getMediaType: () => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMediaController: () => Promise<any>;
}

interface AgentState {
  name: string;
  agentStateARN: string;
  type: string;
}

interface ConnectAgent {
  onStateChange: (cb: (e: { newState: { name: string } }) => void) => void;
  getName: () => string;
  getAgentStates: () => AgentState[];
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

/**
 * Module-level Connect agent reference for external state changes (e.g. TopBar Available/Away).
 * Set once when the agent initializes via window.connect.agent().
 */
let connectAgentInstance: ConnectAgent | null = null;

/** Call Connect's agent setState API — used by TopBar Available/Away buttons. */
export function setConnectAgentState(stateName: 'Available' | 'Away'): void {
  if (!connectAgentInstance) return;
  try {
    const states = connectAgentInstance.getAgentStates();
    const target = states.find(s => s.name === stateName);
    if (target) {
      connectAgentInstance.setState(target, {
        failure: () => console.warn('Connect setState failed for', stateName),
      });
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

        // Transition to ACW — do NOT auto-clear
        store.patchSlot(contactId, { status: 'acw' });
      });

      contact.onDestroy(() => {
        contactRefs.current.delete(contactId);
        agentChatSessions.delete(contactId);
        // Preserve the slot if we're in ACW so the agent can still review and close.
        // The contact is already gone from Connect; Close Contact will just clear locally.
        if (useAgentStore.getState().getSlot(contactId)?.status !== 'acw') {
          store.clearSlot(contactId);
        }
      });
    });

    // ── Manual Accept / Skip ──────────────────────────────────────────────────
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

    // ── Close Contact (ACW → clearSlot) ──────────────────────────────────────
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

    window.addEventListener('bobs:acceptContact', handleAccept);
    window.addEventListener('bobs:skipContact', handleSkip);
    window.addEventListener('bobs:closeContact', handleCloseContact);

    // ── Agent state ───────────────────────────────────────────────────────────
    window.connect.agent(agent => {
      connectAgentInstance = agent;
      agent.onStateChange(({ newState }) => {
        const name = newState.name;
        if (name === 'Available' || name === 'Away' || name === 'Offline') {
          store.setAgentStatus(name);
        }
      });
    });

    return () => {
      window.removeEventListener('bobs:acceptContact', handleAccept);
      window.removeEventListener('bobs:skipContact', handleSkip);
      window.removeEventListener('bobs:closeContact', handleCloseContact);
    };
  }, []);
}
