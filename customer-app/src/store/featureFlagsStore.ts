import { create } from 'zustand';

// ── Experimental features ────────────────────────────────────────────────────
// Client-side feature flags for opt-in experimental features, toggled from the
// "Experimental features" section of the avatar menu. Persisted to localStorage,
// default OFF. Add a new entry to EXPERIMENTS to surface another experiment — the
// menu and gating read from this registry, so no other wiring is required.

export interface ExperimentDef {
  key: string;
  label: string;
  description: string;
}

export const EXPERIMENTS: ExperimentDef[] = [
  {
    key: 'talkToBob',
    label: 'Talk to Bob',
    description: 'Voice assistant — tap the mic, ask a question, and Bob answers out loud.',
  },
];

const STORAGE_KEY = 'bobs_feature_flags';

function loadFlags(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

interface FeatureFlagsStore {
  flags: Record<string, boolean>;
  setFlag: (key: string, on: boolean) => void;
}

export const useFeatureFlags = create<FeatureFlagsStore>((set) => ({
  flags: loadFlags(),
  setFlag: (key, on) =>
    set((state) => {
      const flags = { ...state.flags, [key]: on };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(flags)); } catch { /* ignore */ }
      return { flags };
    }),
}));

/**
 * Subscribe to a single flag. Returns false unless the flag is explicitly on, so a
 * missing/never-touched flag is off — and components that gate on it render nothing
 * (and import nothing) until the user opts in.
 */
export function useFlag(key: string): boolean {
  return useFeatureFlags((s) => s.flags[key] === true);
}
