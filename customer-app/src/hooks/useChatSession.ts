import { useRef } from 'react';
import 'amazon-connect-chatjs';
import { useChatStore, ChatStore } from '../store/chatStore';
import { post } from '../api/client';
import { MOCK_CLIENT } from '../data/mock-client';

const ESCALATION_PHRASES = [
  'connect you with a live agent',
  'chat now, or would a callback',
  'transfer you to',
  'speak with an agent',
  'live representative',
];

function checkEscalation(text: string, store: ChatStore): void {
  const lower = text.toLowerCase();
  if (ESCALATION_PHRASES.some(p => lower.includes(p))) {
    store.transitionTo('ESCALATION_OFFERED');
    store.setEscalationWaitTime(3);
  }
}

declare global {
  // kept for legacy type compat only — not used at runtime
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
  // Timer: if Connect/Lex doesn't reply in 3 s, call /autopilot-turn directly
  const botReplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      window.connect!.ChatSession.setGlobalConfig({
        loggerConfig: { level: 'ERROR' },
        region: import.meta.env.VITE_AWS_REGION ?? 'us-east-1',
      });

      const session = window.connect!.ChatSession.create({
        chatDetails: {
          contactId: data.contactId,
          participantId: data.participantId,
          participantToken: data.participantToken,
        },
        options: { region: import.meta.env.VITE_AWS_REGION ?? 'us-east-1' },
        type: window.connect!.ChatSession.SessionTypes.CUSTOMER,
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

        // A real Connect/Lex reply arrived — cancel any pending fallback timer
        if (role === 'BOT') {
          if (botReplyTimerRef.current) {
            clearTimeout(botReplyTimerRef.current);
            botReplyTimerRef.current = null;
          }
          checkEscalation(data.Content, store);
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
        // Only surface "Chat ended." when a live agent was connected.
        // The placeholder contact flow disconnects immediately in BOT_ACTIVE state,
        // so suppress the message there to avoid alarming users mid-conversation.
        if (useChatStore.getState().state === 'CONNECTED_TO_AGENT') {
          store.addMessage({ role: 'SYSTEM', content: 'Chat ended.' });
        }
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

    // Start fallback timer: if Connect/Lex doesn't reply within 3 s, call autopilot-turn directly
    if (botReplyTimerRef.current) clearTimeout(botReplyTimerRef.current);
    botReplyTimerRef.current = setTimeout(async () => {
      botReplyTimerRef.current = null;
      const currentMessages = useChatStore.getState().messages;
      const lastMsg = currentMessages[currentMessages.length - 1];
      if (!lastMsg || lastMsg.role !== 'CUSTOMER') return; // bot already replied
      try {
        store.setTyping(true);
        const result = await post<{ response: string; confidence: number; shouldExitAutopilot: boolean }>(
          '/autopilot-turn',
          {
            transcript: currentMessages.filter(m => m.role !== 'SYSTEM'),
            clientProfile: MOCK_CLIENT,
            currentIntent: 'general inquiry',
          },
        );
        store.setTyping(false);
        if (result.response) {
          store.addMessage({ role: 'BOT', content: result.response });
          checkEscalation(result.response, store);
        }
      } catch (e) {
        store.setTyping(false);
        console.warn('Fallback bot response failed', e);
      }
    }, 3000);

    try {
      await session.sendMessage({ message: text, contentType: 'text/plain' });
    } catch {
      // WebSocket may be closed (placeholder contact flow disconnects immediately); fallback timer will handle the response
    }
  }

  return { openChat, sendMessage };
}
