import { useRef } from 'react';
import 'amazon-connect-chatjs';
import { useChatStore, ChatStore } from '../store/chatStore';
import { useClientStore } from '../store/clientStore';
import { post } from '../api/client';
import { LastAgentChat } from '../types';

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

// Simple affirmatives — only checked when the bot has just asked about escalating (escalationPending=true).
const ESCALATION_AFFIRMATIVES = /^(yes|yeah|yep|yup|sure|ok|okay|please|go ahead|yes please|please do|sounds good|that works|connect me now)\b/i;

// Connect participant "typing" event content type — used to tell the agent we're typing.
const TYPING_EVENT_CONTENT_TYPE = 'application/vnd.amazonaws.connect.event.typing';
// Throttle outgoing typing events so a burst of keystrokes sends at most one per interval.
const TYPING_THROTTLE_MS = 3000;
// Hide the agent typing ellipsis if no further typing event arrives within this window.
const AGENT_TYPING_TTL_MS = 60_000;
// Control message the agent sends to immediately clear the typing ellipsis when autopilot
// is cancelled mid-compose. Must match the agent app's sentinel exactly. Never rendered.
const TYPING_STOP_SENTINEL = '__BOBS_TYPING_STOP__';
// Control message prefix carrying the connected agent's full name (first + last), so the
// chat can show correct initials. Connect's chat DisplayName is only the first name.
const AGENT_NAME_SENTINEL = '__BOBS_AGENT_NAME__';

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
  onMessage: (cb: (e: { data: { ParticipantRole: string; Content: string; Type: string; DisplayName?: string } }) => void) => void;
  onTyping: (cb: (e: { data: { ParticipantRole?: string; DisplayName?: string } }) => void) => void;
  onConnectionEstablished: (cb: () => void) => void;
  onConnectionBroken: (cb: () => void) => void;
  onEnded: (cb: () => void) => void;
  sendMessage: (m: { message: string; contentType: string }) => Promise<void>;
  sendEvent: (e: { contentType: string }) => Promise<void>;
};

function createAndBindSession(
  data: StartChatResponse,
  store: ChatStore,
  sessionRef: React.MutableRefObject<ChatJsSession | null>,
  botReplyTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  agentTypingTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
): ChatJsSession {
  const clearAgentTyping = () => {
    if (agentTypingTimerRef.current) {
      clearTimeout(agentTypingTimerRef.current);
      agentTypingTimerRef.current = null;
    }
    store.setAgentTyping(false);
  };
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

    // Control signal: agent cancelled an in-progress (autopilot) compose — drop the
    // typing ellipsis immediately and don't render the sentinel as a chat bubble.
    if (msg.Content === TYPING_STOP_SENTINEL) {
      clearAgentTyping();
      return;
    }

    // Control signal: the connected agent's full name (first + last) for correct initials.
    if (msg.Content?.startsWith(AGENT_NAME_SENTINEL)) {
      const name = msg.Content.slice(AGENT_NAME_SENTINEL.length).trim();
      if (name) store.setAgentName(name);
      return;
    }

    const role = msg.ParticipantRole === 'AGENT' ? 'AGENT' : 'BOT';
    // A real message means the agent is done composing — clear the typing ellipsis.
    if (role === 'AGENT') {
      clearAgentTyping();
      // Fallback name capture: only trust DisplayName when it's a full name (has a
      // space). Connect sends just the first name, which would yield wrong initials —
      // the authoritative full name arrives via the AGENT_NAME_SENTINEL control message.
      if (msg.DisplayName && msg.DisplayName.trim().includes(' ')) store.setAgentName(msg.DisplayName);
    }
    store.addMessage({ role, content: msg.Content });

    if (role === 'BOT') {
      // A real Connect/Lex reply arrived — cancel any pending fallback timer
      if (botReplyTimerRef.current) {
        clearTimeout(botReplyTimerRef.current);
        botReplyTimerRef.current = null;
      }
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

  session.onTyping(({ data }) => {
    // Only the live agent's typing drives the customer ellipsis; ignore echoes of our own.
    if (data?.ParticipantRole && data.ParticipantRole !== 'AGENT') return;
    // Only meaningful once an agent is (being) connected — never during the bot phase.
    const liveState = useChatStore.getState().state;
    if (liveState !== 'CONNECTED_TO_AGENT' && liveState !== 'WAITING_FOR_AGENT') return;
    // Fallback name capture from the typing event — only when it's a full name (has a
    // space); the authoritative full name arrives via the AGENT_NAME_SENTINEL message.
    if (data?.DisplayName && data.DisplayName.trim().includes(' ')) store.setAgentName(data.DisplayName);
    store.setAgentTyping(true);
    if (agentTypingTimerRef.current) clearTimeout(agentTypingTimerRef.current);
    agentTypingTimerRef.current = setTimeout(() => {
      agentTypingTimerRef.current = null;
      store.setAgentTyping(false);
    }, AGENT_TYPING_TTL_MS);
  });

  session.onConnectionEstablished(() => {
    // Only promote to BOT_ACTIVE on initial connect from GREETING
    const current = useChatStore.getState().state;
    if (current === 'GREETING') {
      store.transitionTo('BOT_ACTIVE');
    }
  });

  session.onConnectionBroken(() => {
    store.addMessage({ role: 'SYSTEM', content: 'Connection interrupted. Reconnecting…' });
  });

  session.onEnded(() => {
    clearAgentTyping();
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
  const currentPageRef = useRef<string>('');
  // Timer: if Connect/Lex doesn't reply in 3 s, call /autopilot-turn directly
  const botReplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Auto-expiry timer for the agent typing ellipsis (cleared/reset on each typing event)
  const agentTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Last time we emitted an outgoing typing event (throttling)
  const lastTypingSentRef = useRef<number>(0);

  async function openChat(currentPage: string) {
    currentPageRef.current = currentPage;
    if (store.state !== 'CLOSED') return;

    store.transitionTo('GREETING');
    const { activePersona } = useClientStore.getState();

    // Load the client's most recent agent chat so the chat layer can offer
    // "Continue this chat". Purely additive — failure just means no card shown.
    store.setContinuation(null);
    post<{ lastAgentChat: LastAgentChat | null }>('/client-data', {
      action: 'get-continuation',
      clientId: activePersona.clientId,
    })
      .then(res => store.setContinuation(res.lastAgentChat ?? null))
      .catch(() => { /* no card on failure */ });

    // Pre-warm the fallback Lambda in the background so the first message
    // doesn't cold-start it. Fired before /start-chat so it has maximum lead time.
    post('/autopilot-turn', {
      transcript: [{ role: 'CUSTOMER', content: 'hello', id: 'warmup', timestamp: Date.now() }],
      clientProfile: activePersona,
      scope: 'customer-bot',
      currentIntent: 'general inquiry',
    }).catch(() => {});

    try {
      const data = await post<StartChatResponse>('/start-chat', {
        clientId: activePersona.clientId,
        clientName: activePersona.name,
        currentPage,
      });

      const session = createAndBindSession(data, store, sessionRef, botReplyTimerRef, agentTypingTimerRef);
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

      const session = createAndBindSession(data, store, sessionRef, botReplyTimerRef, agentTypingTimerRef);
      sessionRef.current = session;
      await session.connect();
      store.setChatSession(session, data.contactId, data.participantToken, data.participantId);
    } catch (err) {
      console.error('Escalation failed', err);
      store.addMessage({ role: 'SYSTEM', content: 'Unable to reach an agent right now. Please try again.' });
      store.transitionTo('ESCALATION_OFFERED');
    }
  }

  // Resume a recent agent chat. Triggered from the "Continue this chat" card in the
  // greeting state (so, unlike escalateToAgent, there is no ESCALATION_OFFERED guard).
  // `preferredAgentUsername` is the agent the client asked to wait for, or null for
  // "first available". The previous transcript is loaded agent-side via the
  // continuedFromTranscriptId attribute set on the new Connect contact.
  async function continueChat(preferredAgentUsername: string | null) {
    const continuation = useChatStore.getState().continuation;
    if (!continuation) return;

    if (botReplyTimerRef.current) {
      clearTimeout(botReplyTimerRef.current);
      botReplyTimerRef.current = null;
    }

    store.addMessage({ role: 'SYSTEM', content: 'Connecting you to a live agent…' });
    store.transitionTo('WAITING_FOR_AGENT');

    try { sessionRef.current?.disconnect(); } catch { /* ignore */ }
    sessionRef.current = null;

    const { activePersona } = useClientStore.getState();

    try {
      const data = await post<StartChatResponse>('/start-chat', {
        clientId: activePersona.clientId,
        clientName: activePersona.name,
        currentPage: 'escalation',
        escalate: true,
        intentSummary: continuation.summary,
        continuation: true,
        continuedFromTranscriptId: continuation.transcriptId,
        preferredAgentUsername: preferredAgentUsername ?? '',
      });

      const session = createAndBindSession(data, store, sessionRef, botReplyTimerRef, agentTypingTimerRef);
      sessionRef.current = session;
      await session.connect();
      store.setChatSession(session, data.contactId, data.participantToken, data.participantId);
    } catch (err) {
      console.error('Continue chat failed', err);
      store.addMessage({ role: 'SYSTEM', content: 'Unable to reach an agent right now. Please try again.' });
      store.transitionTo('BOT_ACTIVE');
    }
  }

  async function sendMessage(text: string) {
    const session = sessionRef.current;
    const currentState = useChatStore.getState().state;
    store.addMessage({ role: 'CUSTOMER', content: text });

    const isAgentMode = currentState === 'CONNECTED_TO_AGENT' || currentState === 'WAITING_FOR_AGENT';

    // If the bot just asked "would you like to connect?" and the customer responds,
    // check for an affirmative before doing anything else.
    if (!isAgentMode && useChatStore.getState().escalationPending) {
      store.setEscalationPending(false);
      if (ESCALATION_AFFIRMATIVES.test(text.trim()) || isCustomerEscalationRequest(text)) {
        store.addMessage({
          role: 'BOT',
          content: "Of course! Would you prefer to chat with a live agent now, or would a callback at a time of your choosing work better?",
        });
        store.transitionTo('ESCALATION_OFFERED');
        store.setEscalationWaitTime(3);
        return;
      }
      // Customer said something else — continue the conversation normally (fall through)
    }

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
      // Show typing indicator immediately — customer shouldn't see dead silence while waiting.
      store.setTyping(true);
      // Fallback timer: if Connect/Lex doesn't reply in 3 s, call autopilot-turn directly.
      // 3 s is safe because the pre-warm in openChat() keeps the Lambda hot.
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
          const { activePersona } = useClientStore.getState();
          const result = await post<{ response: string; shouldExitAutopilot: boolean; toolsUsed?: string[] }>(
            '/autopilot-turn',
            {
              transcript: currentMessages.filter(m => m.role !== 'SYSTEM'),
              clientProfile: activePersona,
              scope: 'customer-bot',
              currentIntent: 'general inquiry',
              currentPage: currentPageRef.current,
            },
          );
          store.setTyping(false);
          const reply = result.response?.trim();
          if (reply && reply !== '...' && reply.length > 3) {
            store.addMessage({ role: 'BOT', content: reply, toolsUsed: result.toolsUsed ?? [] });
            if (result.shouldExitAutopilot) {
              const s = useChatStore.getState().state;
              if (s !== 'WAITING_FOR_AGENT' && s !== 'CONNECTED_TO_AGENT' && s !== 'ESCALATION_OFFERED') {
                // Don't auto-open the escalation panel — wait for the customer to confirm.
                // The bot's message should already be asking "would you like to connect?"
                store.setEscalationPending(true);
              }
            }
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

  // Tell the connected agent we're typing. Throttled so a burst of keystrokes emits at
  // most one Connect event per interval. Only meaningful once an agent is (being) connected.
  function notifyTyping() {
    const session = sessionRef.current;
    if (!session) return;
    const state = useChatStore.getState().state;
    if (state !== 'CONNECTED_TO_AGENT' && state !== 'WAITING_FOR_AGENT') return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    try {
      session.sendEvent({ contentType: TYPING_EVENT_CONTENT_TYPE })?.catch?.(() => {});
    } catch { /* ignore — typing is best-effort */ }
  }

  return { openChat, sendMessage, escalateToAgent, continueChat, notifyTyping };
}
