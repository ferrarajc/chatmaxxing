import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { post } from '../api/client';
import { MOCK_CLIENT } from '../data/mock-client';

declare global {
  // amazon-connect-chatjs is loaded as a UMD global in index.html
  interface Window {
    connect: {
      ChatSession: {
        create: (config: unknown) => unknown;
        SessionTypes: { CUSTOMER: string };
        LogLevel: { DEBUG: string; INFO: string; ERROR: string };
        setGlobalConfig: (config: unknown) => void;
      };
    };
  }
}

interface StartChatResponse {
  participantToken: string;
  contactId: string;
  participantId: string;
}

export function useChatSession() {
  const store = useChatStore();
  const sessionRef = useRef<unknown>(null);

  async function openChat(currentPage: string) {
    if (store.state !== 'CLOSED') return;

    store.transitionTo('GREETING');

    try {
      const data = await post<StartChatResponse>('/start-chat', {
        clientId: MOCK_CLIENT.clientId,
        clientName: MOCK_CLIENT.name,
        currentPage,
      });

      // Configure chatjs
      window.connect.ChatSession.setGlobalConfig({
        loggerConfig: { level: window.connect.ChatSession.LogLevel.ERROR },
        region: import.meta.env.VITE_AWS_REGION ?? 'us-east-1',
      });

      const session = window.connect.ChatSession.create({
        chatDetails: {
          contactId: data.contactId,
          participantId: data.participantId,
          participantToken: data.participantToken,
        },
        options: { region: import.meta.env.VITE_AWS_REGION ?? 'us-east-1' },
        type: window.connect.ChatSession.SessionTypes.CUSTOMER,
      }) as {
        connect: () => Promise<void>;
        onMessage: (cb: (e: { data: { ParticipantRole: string; Content: string; Type: string } }) => void) => void;
        onTyping: (cb: () => void) => void;
        onConnectionEstablished: (cb: () => void) => void;
        onConnectionBroken: (cb: () => void) => void;
        onEnded: (cb: () => void) => void;
        sendMessage: (m: { message: string; contentType: string }) => Promise<void>;
      };

      sessionRef.current = session;

      session.onMessage(({ data }) => {
        if (data.Type !== 'MESSAGE') return;
        const role = data.ParticipantRole === 'CUSTOMER' ? 'CUSTOMER'
          : data.ParticipantRole === 'AGENT' ? 'AGENT' : 'BOT';

        store.addMessage({ role, content: data.Content });

        // Detect escalation intent from bot message
        if (role === 'BOT' && (
          data.Content.toLowerCase().includes('connect you with a live agent') ||
          data.Content.toLowerCase().includes('chat now, or would a callback')
        )) {
          store.transitionTo('ESCALATION_OFFERED');
          store.setEscalationWaitTime(3);  // demo: ~3 min wait
        }

        // Detect agent joined
        if (data.ParticipantRole === 'AGENT') {
          store.transitionTo('CONNECTED_TO_AGENT');
        }
      });

      session.onTyping(() => store.setTyping(true));
      session.onConnectionEstablished(() => {
        store.transitionTo('BOT_ACTIVE');
      });
      session.onConnectionBroken(() => {
        store.addMessage({ role: 'SYSTEM', content: 'Connection interrupted. Reconnecting…' });
      });
      session.onEnded(() => {
        store.addMessage({ role: 'SYSTEM', content: 'Chat ended.' });
      });

      await session.connect();

      store.setChatSession(session, data.contactId, data.participantToken, data.participantId);
    } catch (err) {
      console.error('Failed to open chat', err);
      store.addMessage({ role: 'SYSTEM', content: 'Unable to connect. Please try again.' });
      store.transitionTo('CLOSED');
    }
  }

  async function sendMessage(text: string) {
    const session = sessionRef.current as { sendMessage: (m: { message: string; contentType: string }) => Promise<void> } | null;
    if (!session) return;
    store.addMessage({ role: 'CUSTOMER', content: text });
    await session.sendMessage({ message: text, contentType: 'text/plain' });
  }

  return { openChat, sendMessage };
}
