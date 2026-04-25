// AI client — uses OpenAI (gpt-4o-mini) via native Node 20 fetch.
// Function names kept as-is so all callers require zero changes.

import { logToArize } from './arize';

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

export interface LlmCallContext {
  /** Lambda function name (e.g. "autopilot-turn", "generate-acw") */
  fn: string;
  /** Amazon Connect contactId — used to correlate logs across a session */
  contactId?: string;
  /** Logical label for this call (e.g. "callback", "get-intent") */
  scope?: string;
}

export async function invokeNovaMicro(
  userPrompt: string,
  systemPrompt: string,
  maxTokens = 300,
  ctx?: LlmCallContext,
): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const startMs = Date.now();

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const durationMs = Date.now() - startMs;
    console.log(JSON.stringify({
      event: 'llm_error',
      fn: ctx?.fn ?? 'unknown',
      contactId: ctx?.contactId,
      scope: ctx?.scope,
      status: res.status,
      durationMs,
    }));
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const text = data.choices[0]?.message?.content;
  if (!text) throw new Error('Empty OpenAI response');

  const durationMs = Date.now() - startMs;
  // CloudWatch structured log — queryable with Insights:
  //   fields @timestamp, fn, durationMs, totalTokens | sort @timestamp desc
  console.log(JSON.stringify({
    event: 'llm_call',
    fn: ctx?.fn ?? 'unknown',
    contactId: ctx?.contactId,
    scope: ctx?.scope,
    model: OPENAI_MODEL,
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
    totalTokens: data.usage?.total_tokens,
    durationMs,
    promptChars: userPrompt.length + systemPrompt.length,
    responseChars: text.length,
  }));

  // Arize observability — no-op when ARIZE_API_KEY / ARIZE_SPACE_KEY not set
  logToArize({
    modelId:       ctx?.fn ?? 'unknown',
    predictionId:  `${ctx?.contactId ?? 'anon'}-${Date.now()}`,
    features: {
      scope:        ctx?.scope ?? null,
      contactId:    ctx?.contactId ?? null,
      promptTokens: data.usage?.prompt_tokens ?? null,
      promptChars:  userPrompt.length + systemPrompt.length,
    },
    predictionLabel: text,
    latencyMs: durationMs,
  });

  return text;
}

/** Parse JSON from a model response, with regex fallback */
export function parseJsonFromBedrock<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error(`Could not parse JSON from model response: ${raw.slice(0, 200)}`);
  }
}
