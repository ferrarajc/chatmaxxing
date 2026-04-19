import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION ?? 'us-east-1',
});

const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'amazon.nova-micro-v1:0';

export async function invokeNovaMicro(
  userPrompt: string,
  systemPrompt: string,
  maxTokens = 300,
): Promise<string> {
  const payload = {
    messages: [{ role: 'user', content: [{ text: userPrompt }] }],
    system: [{ text: systemPrompt }],
    inferenceConfig: { maxTokens, temperature: 0.3 },
  };

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const body = JSON.parse(Buffer.from(response.body).toString('utf-8'));
  const text = body?.output?.message?.content?.[0]?.text;
  if (!text) throw new Error('Empty Bedrock response');
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
