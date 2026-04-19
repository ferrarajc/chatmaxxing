import { useEffect, useRef } from 'react';
import 'amazon-connect-chatjs';
import { useAgentStore } from '../store/agentStore';
import { ChatMessage } from '../types';
import { log } from '../api/logger';

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

interface ConnectAgent {
  onStateChange: (cb: (e: { newState: { name: string } }) => void) => void;
  getName: () => string;
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
      loginPopup: false,
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
        // Prefer AI-generated label; fall back to 'General inquiry'
        const displayLabel = attrs.intentLabel?.value || 'General inquiry';

        const idx = store.addContact({
          contactId,
          clientId: attrs.clientId?.value ?? 'demo-client-001',
          clientName: attrs.clientName?.value ?? 'Alex Johnson',
          intentSummary: displayLabel,
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
          // onMessage() works regardless because the Streams proxy relays inbound
          // messages. sendMessage() also works through the proxy when connect() is
          // NOT called (the session uses the proxy's send channel directly).

          agentChatSessions.set(contactId, chatSession);

          // Extract the connection token from chatjs session for server-side sending.
          // connectionDetails.connectionToken is the connection token the CCP obtained
          // via CreateParticipantConnection (provided to us via the Streams LPC channel).
          // We pass this to our Lambda which calls SendMessage directly via raw fetch
          // (bypassing SDK IAM signing that would otherwise be denied).
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

          // Receive messages from the customer (and suppress our own AGENT echoes)
          chatSession.onMessage(({ data: msg }: { data: { Type: string; ParticipantRole: string; Content: string } }) => {
            if (msg?.Type !== 'MESSAGE') return;
            if (msg.ParticipantRole === 'AGENT') return; // suppress echo of own sent messages
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
        contactRefs.current.delete(contactId);
        agentChatSessions.delete(contactId);
        store.patchSlot(contactId, { status: 'ended' });
        setTimeout(() => store.clearSlot(contactId), 3000);
      });

      contact.onDestroy(() => {
        contactRefs.current.delete(contactId);
        agentChatSessions.delete(contactId);
        store.clearSlot(contactId);
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

    window.addEventListener('bobs:acceptContact', handleAccept);
    window.addEventListener('bobs:skipContact', handleSkip);

    // ── Agent state ───────────────────────────────────────────────────────────
    window.connect.agent(agent => {
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
    };
  }, []);
}
