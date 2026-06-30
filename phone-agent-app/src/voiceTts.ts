import { API_BASE } from './api/client';
import { useVoiceSettings } from './voiceSettings';

// Speaks a line via the /tts Lambda using the live voice settings (OpenAI or ElevenLabs),
// falling back to the browser's speechSynthesis if the call/playback fails. Returns which
// engine actually played, so the voice picker can surface configuration problems.
//
// Synthesized audio is cached by (settings + text), and `prefetch()` lets the caller
// pre-generate upcoming lines (e.g. the happy-path lines, during the ring) so they start
// near-instantly instead of waiting on a fresh round-trip each time.

export interface SpeakResult { source: 'openai' | 'elevenlabs' | 'browser'; error?: string }

let currentAudio: HTMLAudioElement | null = null;
const audioCache = new Map<string, Promise<string>>();

function cacheKey(text: string): string {
  const s = useVoiceSettings.getState();
  return s.provider === 'elevenlabs'
    ? `el|${s.elevenVoiceId}|${text}`
    : `oa|${s.openaiVoice}|${s.openaiInstructions}|${text}`;
}

function requestBody(text: string) {
  const s = useVoiceSettings.getState();
  return s.provider === 'elevenlabs'
    ? { provider: s.provider, text, voice: s.elevenVoiceId }
    : { provider: s.provider, text, voice: s.openaiVoice, instructions: s.openaiInstructions };
}

async function fetchAudio(text: string): Promise<string> {
  const res = await fetch(`${API_BASE}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody(text)),
  });
  const data = (await res.json().catch(() => ({}))) as { audioBase64?: string; error?: string };
  if (!res.ok || data.error || !data.audioBase64) throw new Error(data.error || `tts ${res.status}`);
  return data.audioBase64;
}

/** Get the base64 audio for `text`, using/filling the cache (de-dupes in-flight requests). */
function getAudio(text: string): Promise<string> {
  const key = cacheKey(text);
  let p = audioCache.get(key);
  if (!p) {
    p = fetchAudio(text).catch(err => { audioCache.delete(key); throw err; });
    audioCache.set(key, p);
  }
  return p;
}

/** Pre-generate (and cache) a line so it can start near-instantly when spoken. Best-effort. */
export function prefetch(text: string): void {
  if (!text) return;
  getAudio(text).catch(() => { /* prefetch failures are non-fatal; speak() will retry/fall back */ });
}

export function stopSpeaking(): void {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

async function browserVoice(text: string): Promise<void> {
  await new Promise<void>(resolve => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.98;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    } catch { resolve(); }
  });
}

export async function speak(text: string): Promise<SpeakResult> {
  stopSpeaking();
  const provider = useVoiceSettings.getState().provider;
  try {
    const audioBase64 = await getAudio(text);
    const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
    currentAudio = audio;
    const done = new Promise<void>(resolve => { audio.onended = () => resolve(); audio.onerror = () => resolve(); });
    await audio.play();
    await done;
    return { source: provider };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.warn(`[voiceTts] ${provider} unavailable — using the browser voice:`, error);
    await browserVoice(text);
    return { source: 'browser', error };
  }
}
