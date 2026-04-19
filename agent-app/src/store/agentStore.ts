import { create } from 'zustand';
import { ContactSlot, AgentStatus, ChatMessage, Resource } from '../types';

const nanoid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

type Slots = [ContactSlot | null, ContactSlot | null, ContactSlot | null, ContactSlot | null];

interface AgentStore {
  agentStatus: AgentStatus;
  slots: Slots;

  setAgentStatus: (s: AgentStatus) => void;

  /** Add a new incoming contact to the first free slot */
  addContact: (contact: Omit<ContactSlot, 'messages' | 'isAutopilot' | 'suggestedText' | 'suggestedResources' | 'lastAgentMessageAt' | 'lastCustomerMessageAt' | 'participantToken'>, initialMessages?: ChatMessage[]) => number | null;

  /** Partially update a slot by contactId */
  patchSlot: (contactId: string, patch: Partial<ContactSlot>) => void;

  /** Append a message to a slot */
  appendMessage: (contactId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;

  /** Clear a slot (set to null) */
  clearSlot: (contactId: string) => void;

  /** Insert the current suggested text into a slot's TypeArea (sets a flag read by TypeArea) */
  insertSuggestion: (contactId: string) => void;
  pendingInserts: Set<string>;
  clearInsert: (contactId: string) => void;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agentStatus: 'Available',
  slots: [null, null, null, null],
  pendingInserts: new Set(),

  setAgentStatus: (agentStatus) => set({ agentStatus }),

  addContact: (contact, initialMessages = []) => {
    const slots = [...get().slots] as Slots;
    const idx = slots.findIndex(s => s === null);
    if (idx === -1) return null;
    slots[idx] = {
      ...contact,
      messages: initialMessages,
      isAutopilot: false,
      suggestedText: '',
      suggestedResources: [],
      lastAgentMessageAt: null,
      lastCustomerMessageAt: null,
      participantToken: null,
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
}));
