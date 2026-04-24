import { useRef } from 'react';
import 'amazon-connect-chatjs';
import { useChatStore, ChatStore } from '../store/chatStore';
import { useClientStore } from '../store/clientStore';
import { post } from '../api/client';

// Phrases that the BOT says which signal escalation is being offered.
const BOT_ESCALATION_PHRASES = [
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

// Phrases the CUSTOMER says that clearly signal they want to escalate.
// Checked client-side for 99% reliability — bypasses Lex classification.
const CUSTOMER_ESCALATION_PHRASES = [
  'speak to an agent', 'speak with an agent', 'talk to an agent', 'talk with an agent',
  'chat with an agent', 'connect me to an agent', 'connect me with an agent',
  'live agent', 'live person', 'live representative', 'live support',
  'real person', 'real agent', 'real human',
  'human agent', 'human representative', 'human support',
  'i want to speak', 'i want to talk', 'i need to speak', 'i need to talk',
  "i'd like to speak", "i'd like to talk",
  'connect me', 'transfer me', 'put me through',
  'want a human', 'need a human', 'talk to a human', 'speak to a human',
  'get me an agent', 'need an agent', 'want an agent', 'get an agent',
  'representative', 'escalate', 'supervisor',
  'someone who can help', 'speak to someone', 'talk to someone',
];

function checkBotEscalation(text: string, store: ChatStore): void {
  const s = useChatStore.getState().state;
  if (s === 'WAITING_FOR_AGENT' || s === 'CONNECTED_TO_AGENT') return;
  const lower = text.toLowerCase();
  if (BOT_ESCALATION_PHRASES.some(p => lower.includes(p))) {
    store.transitionTo('ESCALATION_OFFERED');
    store.setEscalationWaitTime(3);
  }
}

function isCustomerEscalationRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return CUSTOMER_ESCALATION_PHRASES.some(p => lower.includes(p));
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
      checkBotEscalation(msg.Content, store);
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
    const { activePersona } = useClientStore.getState();

    try {
      const data = await post<StartChatResponse>('/start-chat', {
        clientId: activePersona.clientId,
        clientName: activePersona.name,
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
    // Guard: only callable from ESCALATION_OFFERED state
    if (useChatStore.getState().state !== 'ESCALATION_OFFERED') return;

    // Cancel any pending fallback bot timer
    if (botReplyTimerRef.current) {
      clearTimeout(botReplyTimerRef.current);
      botReplyTimerRef.current = null;
    }

    store.addMessage({ role: 'SYSTEM', content: 'Connecting you to a live agent…' });
    store.transitionTo('WAITING_FOR_AGENT');

    try { sessionRef.current?.disconnect(); } catch { /* ignore */ }
    sessionRef.current = null;

    // Build summary from full transcript (not just last 6) for accurate intent capture.
    const allMessages = useChatStore.getState().messages.filter(m => m.role !== 'SYSTEM');
    const summaryParts = allMessages.map(m => `${m.role}: ${m.content}`);
    // Cap total length to avoid Lambda payload limits while including as much as possible
    let summary = summaryParts.join(' | ');
    if (summary.length > 1500) {
      summary = summary.slice(-1500);
    }

    const { activePersona } = useClientStore.getState();

    try {
      const data = await post<StartChatResponse>('/start-chat', {
        clientId: activePersona.clientId,
        clientName: activePersona.name,
        currentPage: 'escalation',
        escalate: true,
        intentSummary: summary,
      });

      const session = createAndBindSession(data, store, sessionRef, botReplyTimerRef);
      sessionRef.current = session;
      await session.connect();
      store.setChatSession(session, data.contactId, data.participantToken, data.participantId);
    } catch (err) {
      console.error('Escalation failed', err);
      store.addMessage({ role: 'SYSTEM', content: 'Unable to reach an agent right now. Please try again.' });
      store.transitionTo('ESCALATION_OFFERED');
    }
  }

  async function sendMessage(text: string) {
    const session = sessionRef.current;
    const currentState = useChatStore.getState().state;
    store.addMessage({ role: 'CUSTOMER', content: text });

    const isAgentMode = currentState === 'CONNECTED_TO_AGENT' || currentState === 'WAITING_FOR_AGENT';

    // Client-side escalation detection: if customer clearly wants an agent,
    // offer escalation immediately without waiting for Lex to classify the intent.
    if (!isAgentMode && currentState !== 'ESCALATION_OFFERED' && isCustomerEscalationRequest(text)) {
      store.addMessage({
        role: 'BOT',
        content: "Of course! I'd be happy to connect you with a live agent. Would you prefer to chat now, or would a callback at a time of your choosing work better?",
      });
      store.transitionTo('ESCALATION_OFFERED');
      store.setEscalationWaitTime(3);
      return; // Don't send to Lex — escalation is already offered
    }

    if (!isAgentMode) {
      // Start fallback timer: if Connect/Lex doesn't reply within 3 s, call autopilot-turn directly
      if (botReplyTimerRef.current) clearTimeout(botReplyTimerRef.current);
      botReplyTimerRef.current = setTimeout(async () => {
        botReplyTimerRef.current = null;
        const currentMessages = useChatStore.getState().messages;
        const lastMsg = currentMessages[currentMessages.length - 1];
        if (!lastMsg || lastMsg.role !== 'CUSTOMER') return; // bot or agent already replied
        // Suppress if an agent is connected or we're waiting for one to join
        const liveState = useChatStore.getState().state;
        if (liveState === 'CONNECTED_TO_AGENT' || liveState === 'WAITING_FOR_AGENT') return;
        try {
          store.setTyping(true);
          const { activePersona } = useClientStore.getState();
          const result = await post<{ response: string; confidence: number; shouldExitAutopilot: boolean }>(
            '/autopilot-turn',
            {
              transcript: currentMessages.filter(m => m.role !== 'SYSTEM'),
              clientProfile: activePersona,
              currentIntent: 'general inquiry',
            },
          );
          store.setTyping(false);
          if (result.response) {
            store.addMessage({ role: 'BOT', content: result.response });
            checkBotEscalation(result.response, store);
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
