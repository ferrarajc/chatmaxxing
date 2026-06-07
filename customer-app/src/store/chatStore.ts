import { create } from 'zustand';
import { ChatState, ChatMessage, CallbackConfirmation, KBQuestionResult, LastAgentChat } from '../types';
import { nanoid } from './nanoid';

// Tiny nanoid replacement (no external dep)
export { nanoid };

export interface ChatStore {
  state: ChatState;
  contactId: string | null;
  participantToken: string | null;
  participantId: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chatSession: any | null;  // amazon-connect-chatjs ChatSession object
  messages: ChatMessage[];
  predictedTopics: string[];
  selectedTopic: string | null;
  levelTwoQuestions: KBQuestionResult[] | null;  // null = not yet fetched; [] = fetch failed/empty
  isTyping: boolean;
  /** True while a live agent is composing a reply (or autopilot is delaying a send). Drives the ellipsis indicator. */
  agentTyping: boolean;
  /** Connected human agent's display name (from Connect), once a live agent is handling the chat; null while pre-agent/bot. */
  agentName: string | null;
  escalationWaitTime: number | null;
  escalationPending: boolean;
  callbackConfirmation: CallbackConfirmation | null;
  /** The client's most recent agent chat, for the "Continue this chat" card; null = none/not loaded. */
  continuation: LastAgentChat | null;

  // Actions
  transitionTo: (s: ChatState) => void;
  setChatSession: (s: unknown, contactId: string, participantToken: string, participantId: string) => void;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setTopics: (topics: string[]) => void;
  setSelectedTopic: (topic: string | null) => void;
  setLevelTwoQuestions: (questions: KBQuestionResult[] | null) => void;
  setTyping: (v: boolean) => void;
  setAgentTyping: (v: boolean) => void;
  setAgentName: (v: string) => void;
  setEscalationWaitTime: (v: number | null) => void;
  setEscalationPending: (v: boolean) => void;
  setCallbackConfirmation: (v: CallbackConfirmation) => void;
  setContinuation: (v: LastAgentChat | null) => void;
  reset: () => void;
}

const initial = {
  state: 'CLOSED' as ChatState,
  contactId: null,
  participantToken: null,
  participantId: null,
  chatSession: null,
  messages: [],
  predictedTopics: [],
  selectedTopic: null,
  levelTwoQuestions: null,
  isTyping: false,
  agentTyping: false,
  agentName: null,
  escalationWaitTime: null,
  escalationPending: false,
  callbackConfirmation: null,
  continuation: null,
};

export const useChatStore = create<ChatStore>(set => ({
  ...initial,

  transitionTo: (state) => set({ state }),

  setChatSession: (chatSession, contactId, participantToken, participantId) =>
    set({ chatSession, contactId, participantToken, participantId }),

  addMessage: (msg) =>
    set(s => ({
      messages: [
        ...s.messages,
        { ...msg, id: nanoid(), timestamp: Date.now() },
      ],
      isTyping: false,
    })),

  setTopics: (predictedTopics) => set({ predictedTopics }),
  setSelectedTopic: (selectedTopic) => set({ selectedTopic }),
  setLevelTwoQuestions: (levelTwoQuestions) => set({ levelTwoQuestions }),
  setTyping: (isTyping) => set({ isTyping }),
  setAgentTyping: (agentTyping) => set({ agentTyping }),
  setAgentName: (agentName) => set({ agentName }),
  setEscalationWaitTime: (escalationWaitTime) => set({ escalationWaitTime }),
  setEscalationPending: (escalationPending) => set({ escalationPending }),
  setCallbackConfirmation: (callbackConfirmation) => set({ callbackConfirmation }),
  setContinuation: (continuation) => set({ continuation }),
  reset: () => set(initial),
}));
