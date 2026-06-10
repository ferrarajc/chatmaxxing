import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
  /** Panel hidden but the chat session stays fully alive; restored from the FAB. */
  minimized: boolean;
  /** Non-customer messages received while minimized; shown as a badge on the FAB. */
  unreadCount: number;
  /** The Connect chat is over (agent or customer ended it); closing the panel needs no confirmation. */
  chatEnded: boolean;

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
  setMinimized: (v: boolean) => void;
  setChatEnded: (v: boolean) => void;
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
  minimized: false,
  unreadCount: 0,
  chatEnded: false,
};

export const useChatStore = create<ChatStore>()(
  persist(
    set => ({
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
          unreadCount: s.minimized && msg.role !== 'CUSTOMER' ? s.unreadCount + 1 : s.unreadCount,
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
      setMinimized: (minimized) => set(minimized ? { minimized } : { minimized, unreadCount: 0 }),
      setChatEnded: (chatEnded) => set({ chatEnded }),
      reset: () => set(initial),
    }),
    {
      name: 'bobs-chat',
      // sessionStorage: the chat survives navigating away and back in the same tab
      // (and reloads), but a closed tab/browser ends it — matching the desired
      // end-of-chat semantics without a beforeunload disconnect.
      storage: createJSONStorage(() => sessionStorage),
      partialize: s => ({
        state: s.state,
        contactId: s.contactId,
        participantToken: s.participantToken,
        participantId: s.participantId,
        messages: s.messages,
        agentName: s.agentName,
        escalationWaitTime: s.escalationWaitTime,
        escalationPending: s.escalationPending,
        callbackConfirmation: s.callbackConfirmation,
        minimized: s.minimized,
        unreadCount: s.unreadCount,
        chatEnded: s.chatEnded,
      }),
    },
  ),
);
