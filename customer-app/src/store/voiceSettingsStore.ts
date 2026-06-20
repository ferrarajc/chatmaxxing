import { create } from 'zustand';

// User-tunable voice settings for "Talk to Bob", set live from the overlay's Voice panel and
// persisted to localStorage. `voice` + `instructions` are passed through to the /tts Lambda
// (which falls back to its own defaults when either is blank).

export const OPENAI_VOICES = [
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse',
];

export interface VoicePreset { label: string; voice: string; instructions: string; }

export const VOICE_PRESETS: VoicePreset[] = [
  { label: '🤠 Cowboy', voice: 'ash', instructions: 'A grizzled old Texas cowboy: deep, gravelly, slow West Texas drawl, folksy and full of character, with big intonation swings that lift at the end of questions and exclamations.' },
  { label: '📺 Newscaster', voice: 'onyx', instructions: 'A polished, authoritative TV news anchor — clear, measured, confident, with crisp diction.' },
  { label: '🏴‍☠️ Pirate', voice: 'ballad', instructions: 'A boisterous old sea pirate — gravelly, dramatic, and full of swagger. Arrr!' },
  { label: '🏄 Surfer', voice: 'verse', instructions: 'A laid-back California surfer — chill, breezy, easygoing, totally relaxed.' },
  { label: '🎩 Butler', voice: 'fable', instructions: 'A refined, elegant British butler — warm, proper, and unflappably polite.' },
  { label: '🤖 Robot', voice: 'echo', instructions: 'A flat, robotic, monotone computer voice with mechanical, even pacing.' },
  { label: '🙂 Natural', voice: 'ash', instructions: 'A warm, friendly, natural conversational voice with light, easy expression.' },
];

const KEY = 'bobs_voice_settings';

function load(): { voice: string; instructions: string } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { voice: typeof p.voice === 'string' ? p.voice : 'ash', instructions: typeof p.instructions === 'string' ? p.instructions : '' };
    }
  } catch { /* ignore */ }
  return { voice: 'ash', instructions: '' };
}

interface VoiceSettingsStore {
  voice: string;
  instructions: string;
  setVoice: (v: string) => void;
  setInstructions: (s: string) => void;
  applyPreset: (p: VoicePreset) => void;
}

function persist(voice: string, instructions: string) {
  try { localStorage.setItem(KEY, JSON.stringify({ voice, instructions })); } catch { /* ignore */ }
}

export const useVoiceSettings = create<VoiceSettingsStore>((set) => {
  const init = load();
  return {
    voice: init.voice,
    instructions: init.instructions,
    setVoice: (voice) => set(s => { persist(voice, s.instructions); return { voice }; }),
    setInstructions: (instructions) => set(s => { persist(s.voice, instructions); return { instructions }; }),
    applyPreset: (p) => { persist(p.voice, p.instructions); set({ voice: p.voice, instructions: p.instructions }); },
  };
});
