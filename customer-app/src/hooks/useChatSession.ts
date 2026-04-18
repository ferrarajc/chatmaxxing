import { useRef } from 'react';
import 'amazon-connect-chatjs';
import { useChatStore, ChatStore } from '../store/chatStore';
import { post } from '../api/client';
import { MOCK_CLIENT } from '../data/mock-client';

const ESCALATION_PHRASES = [
  'connect you with a live agent',
  'connect you to a live',
  'connect you to a real',
  'connecting you to',
  'chat now, or would a callback',
  'transfer you to',
  'speak with an agent',
  'speak with a representative',
  'live representative',
  'real person',
  'human agent',
  'hold on for a moment',
  'please hold',
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

type ChatJsSession = {
  connect: () => Promise<void>;
  disconnect: () => void;
  onMessage: (cb: (e: { data: { ParticipantRole: string; Content: string; Type: string } }) => void) => void;
  onTyping: (cb: () => void) => void;
  onConnectionEstablished: (cb: () => void) => void;
  onConnectionBroken: (cb: () => void) => void;
  onEnded: (cb: () => void) => void;
  sendMessage: (m: { message: string; contentType: string }) => Promise<void>;
};

function createAndBindSession(
  data: StartChatResponse,
  store: ChatStore,
  sessionRef: React.MutableRefObject<ChatJsSession | null>,
  botReplyTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
): ChatJsSession {
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
  }) as ChatJsSession;

  session.onMessage(({ data: msg }) => {
    if (msg.Type !== 'MESSAGE') return;
    // Skip the customer's own messages — sendMessage already adds them optimistically
    if (msg.ParticipantRole === 'CUSTOMER') return;

    const role = msg.ParticipantRole === 'AGENT' ? 'AGENT' : 'BOT';
    store.addMessage({ role, content: msg.Content });

    if (role === 'BOT') {
      // A real Connect/Lex reply arrived — cancel any pending fallback timer
      if (botReplyTimerRef.current) {
        clearTimeout(botReplyTimerRef.current);
        botReplyTimerRef.current = null;
      }
      checkEscalation(msg.Content, store);
    }

    if (msg.ParticipantRole === 'AGENT') {
      // Cancel bot timer — agent is handling the conversation now
      if (botReplyTimerRef.current) {
        clearTimeout(botReplyTimerRef.current);
        botReplyTimerRef.current = null;
      }
      store.transitionTo('CONNECTED_TO_AGENT');
    }
  });

  session.onTyping(() => store.setTyping(true));

  session.onConnectionEstablished(() => {
    // Only promote to BOT_ACTIVE if we haven't already escalated to agent
    const current = useChatStore.getState().state;
    if (current === 'GREETING' || current === 'ESCALATION_OFFERED') {
      store.transitionTo('BOT_ACTIVE');
    }
  });

  session.onConnectionBroken(() => {
    store.addMessage({ role: 'SYSTEM', content: 'Connection interrupted. Reconnecting…' });
  });

  session.onEnded(() => {
    // Only surface "Chat ended." when a live agent was connected.
    if (useChatStore.getState().state === 'CONNECTED_TO_AGENT') {
      store.addMessage({ role: 'SYSTEM', content: 'Chat ended.' });
    }
  });

  return session;
}

export function useChatSession() {
  const store = useChatStore();
  const sessionRef = useRef<ChatJsSession | null>(null);
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

      const session = createAndBindSession(data, store, sessionRef, botReplyTimerRef);
      sessionRef.current = session;
      await session.connect();
      store.setChatSession(session, data.contactId, data.participantToken, data.participantId);
    } catch (err) {
      console.error('Failed to open chat', err);
      store.addMessage({ role: 'SYSTEM', content: 'Unable to connect. Please try again.' });
      store.transitionTo('CLOSED');
    }
  }

  async function escalateToAgent() {
    // Clear any pending bot timer — agent mode suppresses the autopilot
    if (botReplyTimerRef.current) {
      clearTimeout(botReplyTimerRef.current);
      botReplyTimerRef.current = null;
    }

    store.addMessage({ role: 'SYSTEM', content: 'Connecting you to a live agent…' });

    // Disconnect the bot-mode chatjs session (flow already ended on Connect side)
    try { sessionRef.current?.disconnect(); } catch { /* ignore */ }
    sessionRef.current = null;

    // Build a brief transcript summary to pass as context
    const msgs = useChatStore.getState().messages.filter(m => m.role !== 'SYSTEM');
    const summary = msgs.slice(-6).map(m => `${m.role}: ${m.content}`).join(' | ');

    try {
      const data = await post<StartChatResponse>('/start-chat', {
        clientId: MOCK_CLIENT.clientId,
        clientName: MOCK_CLIENT.name,
        currentPage: 'escalation',
        escalate: true,
        intentSummary: summary.slice(0, 500),
      });

      const session = createAndBindSession(data, store, sessionRef, botReplyTimerRef);
      sessionRef.current = session;
      await session.connect();
      store.setChatSession(session, data.contactId, data.participantToken, data.participantId);
      // State stays BOT_ACTIVE (set by onConnectionEstablished) — hides the
      // escalation panel so the user can't accidentally click "Chat with agent" twice.
      // Header and system message tell them an agent is being connected.
    } catch (err) {
      console.error('Escalation failed', err);
      store.addMessage({ role: 'SYSTEM', content: 'Unable to reach an agent right now. Please try again.' });
    }
  }

  async function sendMessage(text: string) {
    const session = sessionRef.current;
    // In CONNECTED_TO_AGENT state, only send through the live session (no bot fallback)
    const currentState = useChatStore.getState().state;
    store.addMessage({ role: 'CUSTOMER', content: text });

    if (currentState !== 'CONNECTED_TO_AGENT') {
      // Start fallback timer: if Connect/Lex doesn't reply within 3 s, call autopilot-turn directly
      if (botReplyTimerRef.current) clearTimeout(botReplyTimerRef.current);
      botReplyTimerRef.current = setTimeout(async () => {
        botReplyTimerRef.current = null;
        const currentMessages = useChatStore.getState().messages;
        const lastMsg = currentMessages[currentMessages.length - 1];
        if (!lastMsg || lastMsg.role !== 'CUSTOMER') return; // bot or agent already replied
        // Suppress if escalated to agent while timer was pending
        if (useChatStore.getState().state === 'CONNECTED_TO_AGENT') return;
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
    }

    if (!session) return;
    try {
      await session.sendMessage({ message: text, contentType: 'text/plain' });
    } catch {
      // WebSocket may be closed; fallback timer will handle the response
    }
  }

  return { openChat, sendMessage, escalateToAgent };
}
