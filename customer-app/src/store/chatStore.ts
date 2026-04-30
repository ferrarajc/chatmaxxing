import { create } from 'zustand';
import { ChatState, ChatMessage, CallbackConfirmation } from '../types';
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
  levelTwoQuestions: string[] | null;  // null = not yet fetched; [] = fetch failed/empty
  isTyping: boolean;
  escalationWaitTime: number | null;
  callbackConfirmation: CallbackConfirmation | null;

  // Actions
  transitionTo: (s: ChatState) => void;
  setChatSession: (s: unknown, contactId: string, participantToken: string, participantId: string) => void;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setTopics: (topics: string[]) => void;
  setSelectedTopic: (topic: string | null) => void;
  setLevelTwoQuestions: (questions: string[] | null) => void;
  setTyping: (v: boolean) => void;
  setEscalationWaitTime: (v: number | null) => void;
  setCallbackConfirmation: (v: CallbackConfirmation) => void;
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
  escalationWaitTime: null,
  callbackConfirmation: null,
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
  setEscalationWaitTime: (escalationWaitTime) => set({ escalationWaitTime }),
  setCallbackConfirmation: (callbackConfirmation) => set({ callbackConfirmation }),
  reset: () => set(initial),
}));
