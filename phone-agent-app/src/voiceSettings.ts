import { create } from 'zustand';

// Live-tunable voice config for the automated callback, with an OpenAI ↔ ElevenLabs switch.
// Persisted to localStorage so your picks survive reloads.

export type TtsProvider = 'openai' | 'elevenlabs';

export const OPENAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'];

// ElevenLabs premade voice IDs (stable, available on the free tier). Add your own from
// the ElevenLabs voice library by pasting its voice_id.
export const ELEVEN_VOICES: { id: string; name: string }[] = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel — calm, professional' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah — warm, friendly' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam — deep, steady' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni — well-rounded' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh — confident' },
];

export const DEFAULT_OPENAI_INSTRUCTIONS =
  "You are the automated voice assistant for Bob's Mutual Funds placing a scheduled callback to a client. " +
  'Speak excitedly and clearly — like a courteous, upbeat call-center representative. ' +
  'Use a natural, human, conversational pace with gentle, genuine expressiveness. Never sound flat, robotic, or theatrical. ' +
  "Sound like you're really delighted to talk to the client.";

export interface VoiceSettings {
  provider: TtsProvider;
  openaiVoice: string;
  openaiInstructions: string;
  elevenVoiceId: string;
  panelOpen: boolean;
  set: (patch: Partial<Omit<VoiceSettings, 'set' | 'openPanel'>>) => void;
  openPanel: (open: boolean) => void;
}

const KEY = 'pa_voice_settings';

function load(): Pick<VoiceSettings, 'provider' | 'openaiVoice' | 'openaiInstructions' | 'elevenVoiceId'> {
  const defaults = { provider: 'openai' as TtsProvider, openaiVoice: 'echo', openaiInstructions: DEFAULT_OPENAI_INSTRUCTIONS, elevenVoiceId: ELEVEN_VOICES[0].id };
  try {
    const s = localStorage.getItem(KEY);
    if (s) return { ...defaults, ...JSON.parse(s) };
  } catch { /* ignore */ }
  return defaults;
}

export const useVoiceSettings = create<VoiceSettings>((set, get) => ({
  ...load(),
  panelOpen: false,
  set: (patch) => {
    set(patch);
    const { provider, openaiVoice, openaiInstructions, elevenVoiceId } = get();
    try { localStorage.setItem(KEY, JSON.stringify({ provider, openaiVoice, openaiInstructions, elevenVoiceId })); } catch { /* ignore */ }
  },
  openPanel: (open) => set({ panelOpen: open }),
}));
