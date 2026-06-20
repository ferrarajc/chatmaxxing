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
    const { text, voice, instructions } = JSON.parse(event.body ?? '{}') as { text?: string; voice?: string; instructions?: string };
    const input = (text ?? '').trim().slice(0, MAX_CHARS);
    if (!input) return jsonResponse(400, { error: 'text is required' });

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
