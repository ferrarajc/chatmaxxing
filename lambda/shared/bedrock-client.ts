// AI client — uses OpenAI (gpt-4o-mini) via native Node 20 fetch.
// Function names kept as-is so all callers require zero changes.

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

export async function invokeNovaMicro(
  userPrompt: string,
  systemPrompt: string,
  maxTokens = 300,
): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

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
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  const text = data.choices[0]?.message?.content;
  if (!text) throw new Error('Empty OpenAI response');
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
