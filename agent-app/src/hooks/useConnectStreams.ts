import { useEffect, useRef } from 'react';
import { useAgentStore } from '../store/agentStore';
import { post } from '../api/client';

declare global {
  interface Window {
    // amazon-connect-streams loaded as UMD global
    connect: {
      core: {
        initCCP: (container: HTMLElement, config: unknown) => void;
      };
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

export function useConnectStreams(ccpContainerRef: React.RefObject<HTMLDivElement | null>) {
  const store = useAgentStore();
  const autoAcceptTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Map from contactId → live contact reference so Accept/Skip events can call the SDK
  const contactRefs = useRef<Map<string, ConnectContact>>(new Map());

  useEffect(() => {
    if (!ccpContainerRef.current) return;
    if (!window.connect?.core) {
      console.warn('amazon-connect-streams not loaded yet');
      return;
    }

    const ccpUrl = import.meta.env.VITE_CCP_URL;
    if (!ccpUrl) {
      console.warn('VITE_CCP_URL not set — Connect Streams not initialized');
      return;
    }

    window.connect.core.initCCP(ccpContainerRef.current, {
      ccpUrl,
      loginPopup: true,
      loginPopupAutoClose: true,
      loginOptions: { autoClose: true, height: 600, width: 400, top: 0, left: 0 },
      softphone: { allowFramedSoftphone: true },
      chat: { disableMultipleChatWindows: false },
    });

    // ── Contact events ─────────────────────────────────────────────
    window.connect.contact(contact => {
      const contactId = contact.getContactId();

      contact.onConnecting(() => {
        const attrs = contact.getAttributes();

        // Store the live contact reference so the Accept/Skip buttons can reach it
        contactRefs.current.set(contactId, contact);

        const idx = store.addContact({
          contactId,
          clientId: attrs.clientId?.value ?? 'demo-client-001',
          clientName: attrs.clientName?.value ?? 'Alex Johnson',
          intentSummary: attrs.intentSummary?.value ?? 'General inquiry',
          status: 'incoming',
        });

        if (idx === null) {
          // All 4 slots full — reject
          contact.reject();
          contactRefs.current.delete(contactId);
          return;
        }

        // 10-second auto-accept timer
        const timer = setTimeout(() => {
          contact.accept({});
          autoAcceptTimers.current.delete(contactId);
        }, 10000);
        autoAcceptTimers.current.set(contactId, timer);
      });

      contact.onConnected(async () => {
        // Cancel auto-accept timer (agent already accepted)
        const timer = autoAcceptTimers.current.get(contactId);
        if (timer) { clearTimeout(timer); autoAcceptTimers.current.delete(contactId); }

        store.patchSlot(contactId, { status: 'active' });

        // Get agent's participant connection token for autopilot
        try {
          const connections = contact.getConnections();
          const agentConn = connections.find(c => c.getType() === 'agent');
          const participantToken = agentConn?.getParticipantToken?.();

          if (participantToken) {
            const result = await post<{ connectionToken: string }>('/agent-connection', { participantToken });
            store.patchSlot(contactId, { connectionToken: result.connectionToken });
          }
        } catch (e) {
          console.warn('Could not get agent connection token', e);
        }
      });

      contact.onEnded(() => {
        const timer = autoAcceptTimers.current.get(contactId);
        if (timer) { clearTimeout(timer); autoAcceptTimers.current.delete(contactId); }
        contactRefs.current.delete(contactId);
        store.patchSlot(contactId, { status: 'ended' });
        // Fade out and clear slot after 3 seconds
        setTimeout(() => store.clearSlot(contactId), 3000);
      });

      contact.onDestroy(() => {
        contactRefs.current.delete(contactId);
        store.clearSlot(contactId);
      });
    });

    // ── Manual Accept / Skip from UI buttons ───────────────────────
    const handleAccept = (e: Event) => {
      const { contactId } = (e as CustomEvent<{ contactId: string }>).detail;
      const timer = autoAcceptTimers.current.get(contactId);
      if (timer) { clearTimeout(timer); autoAcceptTimers.current.delete(contactId); }
      const contact = contactRefs.current.get(contactId);
      if (contact) {
        contact.accept({});
      } else {
        console.warn('Accept: no contact ref found for', contactId);
      }
    };

    const handleSkip = (e: Event) => {
      const { contactId } = (e as CustomEvent<{ contactId: string }>).detail;
      const timer = autoAcceptTimers.current.get(contactId);
      if (timer) { clearTimeout(timer); autoAcceptTimers.current.delete(contactId); }
      const contact = contactRefs.current.get(contactId);
      if (contact) {
        contact.reject({});
      }
      contactRefs.current.delete(contactId);
      store.clearSlot(contactId);
    };

    window.addEventListener('bobs:acceptContact', handleAccept);
    window.addEventListener('bobs:skipContact', handleSkip);

    // ── Agent state ────────────────────────────────────────────────
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
