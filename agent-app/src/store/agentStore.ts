import { create } from 'zustand';
import { ContactSlot, AgentStatus, ChatMessage, AutopilotScope } from '../types';

const nanoid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

type Slots = [ContactSlot | null, ContactSlot | null, ContactSlot | null, ContactSlot | null];

interface AgentStore {
  agentStatus: AgentStatus;
  slots: Slots;
  dailyBonus: number;

  setAgentStatus: (s: AgentStatus) => void;
  addBonus: (amount: number) => void;

  addContact: (
    contact: Omit<ContactSlot,
      | 'messages' | 'autopilotScope' | 'suggestedScope' | 'autopilotFlash'
      | 'autopilotPending' | 'suggestedText' | 'suggestedResources'
      | 'lastAgentMessageAt' | 'lastCustomerMessageAt' | 'connectionToken'
      | 'bonusEligible' | 'acwData'>,
    initialMessages?: ChatMessage[]
  ) => number | null;

  patchSlot: (contactId: string, patch: Partial<ContactSlot>) => void;
  appendMessage: (contactId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearSlot: (contactId: string) => void;
  insertSuggestion: (contactId: string) => void;
  pendingInserts: Set<string>;
  clearInsert: (contactId: string) => void;
  /** Read a slot synchronously (safe in async callbacks to avoid stale closure) */
  getSlot: (contactId: string) => ContactSlot | null;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agentStatus: 'Available',
  slots: [null, null, null, null],
  dailyBonus: 0,
  pendingInserts: new Set(),

  setAgentStatus: (agentStatus) => set({ agentStatus }),
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
      suggestedText: '',
      suggestedResources: [],
      lastAgentMessageAt: null,
      lastCustomerMessageAt: null,
      connectionToken: null,
      bonusEligible: idx === 3,
      acwData: null,
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

  getSlot: (contactId) =>
    get().slots.find(s => s?.contactId === contactId) ?? null,
}));
