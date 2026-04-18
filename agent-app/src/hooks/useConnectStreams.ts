import { useEffect, useRef } from 'react';
import { useAgentStore } from '../store/agentStore';
import { post } from '../api/client';
import { ChatMessage } from '../types';

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
  accept: (opts?: unknown) => void;
  reject: (opts?: unknown) => void;
  clear: (opts?: unknown) => void;
  onConnecting: (cb: () => void) => void;
  onConnected: (cb: () => void) => void;
  onEnded: (cb: () => void) => void;
  onDestroy: (cb: () => void) => void;
  getConnections: () => ConnectConnection[];
}

interface ConnectConnection {
  getType: () => string;
  getParticipantToken: () => string | undefined;
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

export function useConnectStreams(ccpContainerRef: React.RefObject<HTMLDivElement | null>) {
  const store = useAgentStore();
  const autoAcceptTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const contactRefs = useRef<Map<string, ConnectContact>>(new Map());
  // Agent-side WebSocket sessions keyed by contactId
  const agentWs = useRef<Map<string, WebSocket>>(new Map());
  const agentHeartbeats = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const closeAgentWs = (contactId: string) => {
    const hb = agentHeartbeats.current.get(contactId);
    if (hb) { clearInterval(hb); agentHeartbeats.current.delete(contactId); }
    const ws = agentWs.current.get(contactId);
    if (ws) { try { ws.close(); } catch { /* ignore */ } agentWs.current.delete(contactId); }
  };

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

        // Get agent participant token → create connection → open WebSocket
        try {
          const connections = contact.getConnections();
          const agentConn = connections.find(c => c.getType() === 'agent');
          const participantToken = agentConn?.getParticipantToken?.();

          if (participantToken) {
            const result = await post<{ connectionToken: string; websocketUrl: string }>(
              '/agent-connection',
              { participantToken },
            );
            store.patchSlot(contactId, { connectionToken: result.connectionToken });

            // ── Open bidirectional WebSocket ──────────────────────────────────
            if (result.websocketUrl) {
              const ws = new WebSocket(result.websocketUrl);
              agentWs.current.set(contactId, ws);

              ws.onopen = () => {
                // Subscribe to chat messages
                ws.send(JSON.stringify({
                  topic: 'aws/subscribe',
                  content: JSON.stringify({ topics: ['aws/chat'] }),
                }));
                // Heartbeat every 10 s to keep connection alive
                const hb = setInterval(() => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ topic: 'aws/heartbeat' }));
                  }
                }, 10000);
                agentHeartbeats.current.set(contactId, hb);
              };

              ws.onmessage = (event) => {
                try {
                  const envelope = JSON.parse(event.data as string);
                  if (envelope.topic !== 'aws/chat') return;
                  const msg = JSON.parse(envelope.content ?? '{}');
                  if (msg.Type !== 'MESSAGE') return;
                  // Suppress echoes of our own sent messages
                  if (msg.ParticipantRole === 'AGENT') return;

                  const role = msg.ParticipantRole === 'CUSTOMER'
                    ? 'CUSTOMER' as const
                    : 'BOT' as const;
                  // Use getState() to avoid stale closure
                  useAgentStore.getState().appendMessage(contactId, {
                    role,
                    content: msg.Content,
                  });
                  useAgentStore.getState().patchSlot(contactId, {
                    lastCustomerMessageAt: Date.now(),
                  });
                } catch { /* ignore malformed frames */ }
              };

              ws.onerror = () => console.warn('Agent WebSocket error for', contactId);
              ws.onclose = () => agentWs.current.delete(contactId);
            }
          }
        } catch (e) {
          console.warn('Could not establish agent participant connection', e);
        }
      });

      contact.onEnded(() => {
        const timer = autoAcceptTimers.current.get(contactId);
        if (timer) { clearTimeout(timer); autoAcceptTimers.current.delete(contactId); }
        contactRefs.current.delete(contactId);
        closeAgentWs(contactId);
        store.patchSlot(contactId, { status: 'ended' });
        setTimeout(() => store.clearSlot(contactId), 3000);
      });

      contact.onDestroy(() => {
        contactRefs.current.delete(contactId);
        closeAgentWs(contactId);
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
