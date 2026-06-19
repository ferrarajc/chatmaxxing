import { create } from 'zustand';

// Tiny UI store for the "Talk to Bob" overlay open state, so both entry points (the launcher
// FAB and the in-panel mic) can open it without prop-threading. No persistence — the overlay
// is transient and the feature flag (featureFlagsStore) controls whether any of it exists.
interface VoiceUiStore {
  open: boolean;
  openVoice: () => void;
  closeVoice: () => void;
}

export const useVoiceStore = create<VoiceUiStore>((set) => ({
  open: false,
  openVoice: () => set({ open: true }),
  closeVoice: () => set({ open: false }),
}));
