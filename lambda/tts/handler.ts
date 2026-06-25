import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { jsonResponse } from '../shared/types';

// Text-to-speech for the "Talk to Bob" voice feature. Takes a short piece of text and
// returns OpenAI-generated speech as base64 mp3, which the browser plays. Reuses the
// existing OPENAI_API_KEY (resolved from SSM at deploy time). If anything fails, the
// client falls back to the browser's built-in speechSynthesis, so this is best-effort.

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
const MODEL = process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts';
const DEFAULT_VOICE = process.env.OPENAI_TTS_VOICE ?? 'ash';
const MAX_CHARS = 1200; // cap latency/cost — answers are short; longer text is truncated

// ElevenLabs (alternate TTS engine — the phone-agent cockpit can A/B against OpenAI). Key is
// resolved from SSM at deploy (bobs-elevenlabs-api-key); blank/"unset" ⇒ graceful not-configured.
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL ?? 'eleven_turbo_v2_5';
const ELEVEN_DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM'; // Rachel

// gpt-4o(-mini)-tts honors an `instructions` field that steers delivery (tone, energy, pacing).
// This is the lever that keeps Bob lively instead of monotone. Ignored by older tts-1 models.
// The BOrB's voice character. gpt-4o-mini-tts steers strongly off `instructions`, so this is the
// main dial — change it (or OPENAI_TTS_VOICE) to retune the voice with no code change.
const DEFAULT_INSTRUCTIONS = process.env.OPENAI_TTS_INSTRUCTIONS ??
  'An elderly gentleman, slow delivery, lots of pauses, folksy, really sharp intonation, with big ' +
  'crescendo highs and deep thoughtful lows. Responds absolutely literally to punctuation, coming up ' +
  'at the ends of sentences ending in a question mark, excited at the ends of sentences ending in ' +
  'exclamation points, and coming way down at the ends of sentences ending in periods. Every comma is ' +
  'a pause. Every parenthetical is an aside, and every em dash is a digression to a separate thought. ' +
  'The mind speaks to the punctuation powerfully.';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const { text, voice, instructions, provider } = JSON.parse(event.body ?? '{}') as { text?: string; voice?: string; instructions?: string; provider?: string };
    const input = (text ?? '').trim().slice(0, MAX_CHARS);
    if (!input) return jsonResponse(400, { error: 'text is required' });

    // ── ElevenLabs branch ────────────────────────────────────────────────────
    if (provider === 'elevenlabs') {
      const key = process.env.ELEVENLABS_API_KEY;
      if (!key || key === 'unset') {
        return jsonResponse(200, { error: 'ElevenLabs is not configured — no API key set on the backend.' });
      }
      const voiceId = voice || ELEVEN_DEFAULT_VOICE;
      const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: input,
          model_id: ELEVEN_MODEL,
          voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
        }),
      });
      if (!elRes.ok) {
        const detail = await elRes.text().catch(() => '');
        console.error('elevenlabs error', elRes.status, detail.slice(0, 500));
        return jsonResponse(200, { error: `ElevenLabs error ${elRes.status}` });
      }
      const elBuf = Buffer.from(await elRes.arrayBuffer());
      return jsonResponse(200, { audioBase64: elBuf.toString('base64'), mime: 'audio/mpeg' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return jsonResponse(500, { error: 'tts not configured' });

    const res = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        voice: voice ?? DEFAULT_VOICE,
        input,
        response_format: 'mp3',
        // `instructions` is only supported by gpt-4o(-mini)-tts; omit for older tts-1 models.
        ...(MODEL.includes('gpt-4o') ? { instructions: instructions ?? DEFAULT_INSTRUCTIONS } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('tts upstream error', res.status, detail.slice(0, 500));
      return jsonResponse(502, { error: 'tts upstream failed' });
    }

    const buf = Buffer.from(await res.arrayBuffer());
    return jsonResponse(200, { audioBase64: buf.toString('base64'), mime: 'audio/mpeg' });
  } catch (err) {
    console.error('tts error', err);
    return jsonResponse(500, { error: 'tts failed' });
  }
};
