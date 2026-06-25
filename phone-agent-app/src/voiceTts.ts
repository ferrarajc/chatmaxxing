import { API_BASE } from './api/client';

// Speaks a line in Bob's automated-callback voice via the existing /tts Lambda (OpenAI TTS),
// falling back to the browser's speechSynthesis if TTS is unavailable. Used to make the
// simulated voice-verification audible during the demo.

let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking(): void {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

export async function speak(text: string): Promise<void> {
  stopSpeaking();
  try {
    const res = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error('tts unavailable');
    const { audioBase64 } = (await res.json()) as { audioBase64: string };
    const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
    currentAudio = audio;
    await new Promise<void>(resolve => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
  } catch {
    // Browser fallback.
    await new Promise<void>(resolve => {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.98;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch {
        resolve();
      }
    });
  }
}
