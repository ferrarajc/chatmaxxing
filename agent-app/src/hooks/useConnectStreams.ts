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
      const type = contact.getType();

      contact.onConnecting(() => {
        const attrs = contact.getAttributes();
        const contactId = contact.getContactId();

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
        const contactId = contact.getContactId();

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
        const contactId = contact.getContactId();
        const timer = autoAcceptTimers.current.get(contactId);
        if (timer) { clearTimeout(timer); autoAcceptTimers.current.delete(contactId); }
        store.patchSlot(contactId, { status: 'ended' });
        // Fade out and clear slot after 3 seconds
        setTimeout(() => store.clearSlot(contactId), 3000);
      });

      contact.onDestroy(() => {
        store.clearSlot(contact.getContactId());
      });
    });

    // ── Agent state ────────────────────────────────────────────────
    window.connect.agent(agent => {
      agent.onStateChange(({ newState }) => {
        const name = newState.name;
        if (name === 'Available' || name === 'Away' || name === 'Offline') {
          store.setAgentStatus(name);
        }
      });
    });
  }, []);
}

/** Called when agent clicks Accept */
export function acceptContact(contactId: string) {
  // The actual accept is handled by the Streams contact reference stored in the hook.
  // We dispatch a custom event that the hook listener picks up.
  window.dispatchEvent(new CustomEvent('bobs:acceptContact', { detail: { contactId } }));
}

/** Called when agent clicks Skip */
export function skipContact(contactId: string) {
  window.dispatchEvent(new CustomEvent('bobs:skipContact', { detail: { contactId } }));
}
