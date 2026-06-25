import { API_BASE } from './api/client';
import { useVoiceSettings } from './voiceSettings';

// Speaks a line via the /tts Lambda using the live voice settings (OpenAI or ElevenLabs),
// falling back to the browser's speechSynthesis if the call/playback fails. Returns which
// engine actually played, so the voice picker can surface configuration problems.

export interface SpeakResult { source: 'openai' | 'elevenlabs' | 'browser'; error?: string }

let currentAudio: HTMLAudioElement | null = null;

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
  const s = useVoiceSettings.getState();
  const provider = s.provider;
  const body = provider === 'elevenlabs'
    ? { provider, text, voice: s.elevenVoiceId }
    : { provider, text, voice: s.openaiVoice, instructions: s.openaiInstructions };

  try {
    const res = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { audioBase64?: string; error?: string };
    if (!res.ok || data.error || !data.audioBase64) {
      throw new Error(data.error || `tts ${res.status}`);
    }
    const audio = new Audio(`data:audio/mpeg;base64,${data.audioBase64}`);
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
