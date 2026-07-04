import { create } from 'zustand';
import { ContactSlot, AgentStatus, ChatMessage, AutopilotScope, ProposedActionData } from '../types';

const nanoid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

type Slots = [ContactSlot | null, ContactSlot | null, ContactSlot | null, ContactSlot | null];

interface AgentStore {
  agentStatus: AgentStatus;
  agentConnected: boolean;
  agentName: string;
  agentUsername: string;
  slots: Slots;
  dailyBonus: number;

  setAgentStatus: (s: AgentStatus) => void;
  setAgentConnected: (connected: boolean) => void;
  setAgentName: (name: string) => void;
  setAgentUsername: (username: string) => void;
  addBonus: (amount: number) => void;

  addContact: (
    contact: Omit<ContactSlot,
      | 'messages' | 'autopilotScope' | 'suggestedScope' | 'autopilotFlash'
      | 'autopilotPending' | 'autopilotPaused' | 'autopilotSendAt' | 'autopilotPausedRemainingMs'
      | 'autopilotExitMessage' | 'suggestedText' | 'suggestedResources'
      | 'suggestionHistory' | 'suggestionIndex' | 'suggestionAutoAdvance'
      | 'suggestionLoading' | 'suggestionNewBadge'
      | 'lastAgentMessageAt' | 'lastCustomerMessageAt' | 'connectionToken'
      | 'bonusEligible' | 'acwData' | 'proposedAction'>,
    initialMessages?: ChatMessage[]
  ) => number | null;

  patchSlot: (contactId: string, patch: Partial<ContactSlot>) => void;
  appendMessage: (contactId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  /** Append a new suggested reply to the history; honors auto-advance / sets the new-badge. */
  addSuggestion: (contactId: string, text: string) => void;
  /** Step the displayed suggestion by delta (clamped); toggles auto-advance/new-badge at ends. */
  paginateSuggestion: (contactId: string, delta: number) => void;
  /** Edit the currently-displayed suggestion in place (retained in history); parks auto-advance. */
  editCurrentSuggestion: (contactId: string, text: string) => void;
  clearSlot: (contactId: string) => void;
  insertSuggestion: (contactId: string) => void;
  pendingInserts: Set<string>;
  clearInsert: (contactId: string) => void;
  /** Read a slot synchronously (safe in async callbacks to avoid stale closure) */
  getSlot: (contactId: string) => ContactSlot | null;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agentStatus: 'Away',
  agentConnected: false,
  agentName: '',
  agentUsername: '',
  slots: [null, null, null, null],
  dailyBonus: 0,
  pendingInserts: new Set(),

  setAgentStatus: (agentStatus) => set({ agentStatus }),
  setAgentConnected: (agentConnected) => set({ agentConnected }),
  setAgentName: (agentName) => set({ agentName }),
  setAgentUsername: (agentUsername) => set({ agentUsername }),
  addBonus: (amount) => set(s => ({ dailyBonus: s.dailyBonus + amount })),

  addContact: (contact, initialMessages = []) => {
    const slots = [...get().slots] as Slots;
    const idx = slots.findIndex(s => s === null);
    if (idx === -1) return null;
    slots[idx] = {
      ...contact,
      messages: initialMessages,
      autopilotScope: null,
      suggestedScope: null,
      autopilotFlash: false,
      autopilotPending: null,
      autopilotPaused: false,
      autopilotSendAt: null,
      autopilotPausedRemainingMs: null,
      autopilotExitMessage: null,
      suggestedText: '',
      suggestedResources: [],
      suggestionHistory: [],
      suggestionIndex: 0,
      suggestionAutoAdvance: true,
      suggestionLoading: false,
      suggestionNewBadge: false,
      lastAgentMessageAt: null,
      lastCustomerMessageAt: null,
      connectionToken: null,
      bonusEligible: idx === 3,
      acwData: null,
      proposedAction: null,
    };
    set({ slots });
    return idx;
  },

  patchSlot: (contactId, patch) => {
    const slots = get().slots.map(s =>
      s?.contactId === contactId ? { ...s, ...patch } : s,
    ) as Slots;
    set({ slots });
  },

  appendMessage: (contactId, msg) => {
    const slots = get().slots.map(s => {
      if (s?.contactId !== contactId) return s;
      return {
        ...s,
        messages: [...s.messages, { ...msg, id: nanoid(), timestamp: Date.now() }],
      };
    }) as Slots;
    set({ slots });
  },

  addSuggestion: (contactId, text) => {
    const slots = get().slots.map(s => {
      if (s?.contactId !== contactId) return s;
      const history = [...s.suggestionHistory, text];
      const lastIdx = history.length - 1;
      // First ever, or currently auto-advancing → snap the view to the newest.
      const advance = s.suggestionHistory.length === 0 || s.suggestionAutoAdvance;
      return advance
        ? { ...s, suggestionHistory: history, suggestionIndex: lastIdx, suggestedText: text, suggestionNewBadge: false }
        : { ...s, suggestionHistory: history, suggestionNewBadge: true }; // paged back → flag a new one
    }) as Slots;
    set({ slots });
  },

  paginateSuggestion: (contactId, delta) => {
    const slots = get().slots.map(s => {
      if (s?.contactId !== contactId) return s;
      const len = s.suggestionHistory.length;
      if (len === 0) return s;
      const newIndex = Math.max(0, Math.min(len - 1, s.suggestionIndex + delta));
      const atNewest = newIndex === len - 1;
      return {
        ...s,
        suggestionIndex: newIndex,
        suggestedText: s.suggestionHistory[newIndex],
        suggestionAutoAdvance: atNewest,                        // re-enable only at newest
        suggestionNewBadge: atNewest ? false : s.suggestionNewBadge,
      };
    }) as Slots;
    set({ slots });
  },

  editCurrentSuggestion: (contactId, text) => {
    const slots = get().slots.map(s => {
      if (s?.contactId !== contactId) return s;
      if (s.suggestionIndex < 0 || s.suggestionIndex >= s.suggestionHistory.length) return s;
      const history = s.suggestionHistory.slice();
      history[s.suggestionIndex] = text;                        // retained in its edited state
      return { ...s, suggestionHistory: history, suggestedText: text };
    }) as Slots;
    set({ slots });
  },

  clearSlot: (contactId) => {
    const slots = get().slots.map(s =>
      s?.contactId === contactId ? null : s,
    ) as Slots;
    set({ slots });
  },

  insertSuggestion: (contactId) => {
    const next = new Set(get().pendingInserts);
    next.add(contactId);
    set({ pendingInserts: next });
  },

  clearInsert: (contactId) => {
    const next = new Set(get().pendingInserts);
    next.delete(contactId);
    set({ pendingInserts: next });
  },

  getSlot: (contactId) =>
    get().slots.find(s => s?.contactId === contactId) ?? null,
}));
