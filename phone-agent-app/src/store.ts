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
  vvStage: number;            // index into the mock voice-verification stages
  audioOn: boolean;
  setAudioOn: (v: boolean) => void;
  ring: (item: CallbackListItem) => Promise<void>;
  accept: () => void;
  decline: () => void;
  setVvStage: (n: number) => void;
  connect: () => void;
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
  vvStage: 0,
  audioOn: true,
  setAudioOn: (v) => set({ audioOn: v }),

  ring: async (item) => {
    set({ call: { item, phase: 'ringing' }, vvStage: 0 });
    const full = await fetchFull(item.callbackId);
    set(s => (s.call && s.call.item.callbackId === item.callbackId
      ? { call: { ...s.call, dossier: full?.dossier } }
      : {}));
  },
  accept: () => set(s => (s.call ? { call: { ...s.call, phase: 'connecting' }, vvStage: 0 } : {})),
  decline: () => set({ call: null }),
  setVvStage: (n) => set({ vvStage: n }),
  connect: () => set(s => (s.call ? { call: { ...s.call, phase: 'live' } } : {})),
  endCall: async () => {
    const c = get().call;
    set(s => (s.call ? { call: { ...s.call, phase: 'wrapup' } } : {}));
    if (c) {
      try { await post('/agent-callbacks', { action: 'complete', callbackId: c.item.callbackId }); } catch { /* ignore */ }
    }
  },
  dismissCall: () => set({ call: null }),
}));
