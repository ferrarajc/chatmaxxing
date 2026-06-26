import { create } from 'zustand';
import { post } from './api/client';
import type { CallbackListItem, CallbackFull, Dossier } from './types';

export type CallPhase = 'ringing' | 'connecting' | 'live' | 'wrapup';

interface ActiveCall {
  item: CallbackListItem;
  dossier?: Dossier;
  phase: CallPhase;
}

interface Store {
  // Right-pane dossier selection
  selectedId: string | null;
  selected: CallbackFull | null;
  selectedLoading: boolean;
  select: (id: string) => Promise<void>;
  clearSelected: () => void;

  // Active (simulated) call
  call: ActiveCall | null;
  callOutcome: string;        // how the call ended, shown on the wrap-up card
  audioOn: boolean;
  setAudioOn: (v: boolean) => void;
  micOn: boolean;             // wait for the agent's real mic input on "client" turns
  setMicOn: (v: boolean) => void;
  ring: (item: CallbackListItem) => Promise<void>;
  accept: () => void;
  decline: () => void;
  connect: () => void;
  endWithOutcome: (outcome: string) => Promise<void>;
  endCall: () => Promise<void>;
  dismissCall: () => void;
}

async function fetchFull(callbackId: string): Promise<CallbackFull | null> {
  try {
    const res = await post<{ callback: CallbackFull }>('/agent-callbacks', { action: 'get', callbackId });
    return res.callback;
  } catch {
    return null;
  }
}

export const useStore = create<Store>((set, get) => ({
  selectedId: null,
  selected: null,
  selectedLoading: false,
  select: async (id) => {
    set({ selectedId: id, selectedLoading: true, selected: null });
    const full = await fetchFull(id);
    if (get().selectedId === id) set({ selected: full, selectedLoading: false });
  },
  clearSelected: () => set({ selectedId: null, selected: null }),

  call: null,
  callOutcome: '',
  audioOn: true,
  setAudioOn: (v) => set({ audioOn: v }),
  micOn: true,
  setMicOn: (v) => set({ micOn: v }),

  ring: async (item) => {
    set({ call: { item, phase: 'ringing' }, callOutcome: '' });
    const full = await fetchFull(item.callbackId);
    set(s => (s.call && s.call.item.callbackId === item.callbackId
      ? { call: { ...s.call, dossier: full?.dossier } }
      : {}));
  },
  accept: () => set(s => (s.call ? { call: { ...s.call, phase: 'connecting' } } : {})),
  decline: () => set({ call: null }),
  connect: () => set(s => (s.call ? { call: { ...s.call, phase: 'live' } } : {})),
  endWithOutcome: async (outcome) => {
    const c = get().call;
    set(s => (s.call ? { call: { ...s.call, phase: 'wrapup' }, callOutcome: outcome } : {}));
    if (c) {
      try { await post('/agent-callbacks', { action: 'complete', callbackId: c.item.callbackId }); } catch { /* ignore */ }
    }
  },
  endCall: async () => { await get().endWithOutcome('✅ Completed — handled by agent'); },
  dismissCall: () => set({ call: null, callOutcome: '' }),
}));
