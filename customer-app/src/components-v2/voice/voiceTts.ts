import { post } from '../../api/client';

// Calls the /tts endpoint (OpenAI text-to-speech) and returns an object URL for the
// generated mp3. Throws on any failure so the caller can fall back to the browser's
// built-in speechSynthesis. The caller is responsible for URL.revokeObjectURL().
export async function fetchSpeechUrl(text: string, voice?: string): Promise<string> {
  const res = await post<{ audioBase64?: string; mime?: string }>('/tts', { text, voice });
  if (!res?.audioBase64) throw new Error('no audio');
  const byteChars = atob(res.audioBase64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const blob = new Blob([bytes], { type: res.mime || 'audio/mpeg' });
  return URL.createObjectURL(blob);
}
