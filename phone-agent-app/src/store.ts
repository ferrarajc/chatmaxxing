import { create } from 'zustand';
import { post } from './api/client';
import { normalizeDossier } from './dossier';
import type { CallbackListItem, CallbackFull, Dossier } from './types';

export type CallPhase = 'ringing' | 'connecting' | 'live' | 'wrapup';
export type LiveMic = 'agent' | 'client' | 'off';   // who the single mic is voicing in the live call

interface ActiveCall {
  item: CallbackListItem;
  dossier?: Dossier;
  phase: CallPhase;
  identityVerified?: boolean;   // set when the automated verification passes before connecting
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
  liveMic: LiveMic;           // live-call transcription: who's talking (or off)
  setLiveMic: (v: LiveMic) => void;
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
    const cb = res.callback;
    // Guarantee the dossier carries an `intent` + `guidedScript` (older records predate them).
    return { ...cb, dossier: normalizeDossier(cb.dossier, cb.clientName, cb.intentSummary) };
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
  liveMic: 'agent',
  setLiveMic: (v) => set({ liveMic: v }),

  ring: async (item) => {
    set({ call: { item, phase: 'ringing' }, callOutcome: '' });
    const full = await fetchFull(item.callbackId);
    set(s => (s.call && s.call.item.callbackId === item.callbackId
      ? { call: { ...s.call, dossier: full?.dossier } }
      : {}));
  },
  accept: () => set(s => (s.call ? { call: { ...s.call, phase: 'connecting' } } : {})),
  decline: () => set({ call: null }),
  connect: () => set(s => (s.call ? { call: { ...s.call, phase: 'live', identityVerified: true } } : {})),
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
