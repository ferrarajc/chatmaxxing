import {
  BedrockRuntimeClient,
  ConverseCommand,
  Message,
} from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
});

const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'amazon.nova-micro-v1:0';

export async function invokeNovaMicro(
  userPrompt: string,
  systemPrompt: string,
  maxTokens = 300,
): Promise<string> {
  const messages: Message[] = [
    { role: 'user', content: [{ text: userPrompt }] },
  ];

  const response = await client.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: systemPrompt }],
      messages,
      inferenceConfig: {
        maxTokens,
        temperature: 0.3,
        topP: 0.9,
      },
    }),
  );

  const text = response.output?.message?.content?.[0]?.text;
  if (!text) throw new Error('Empty Bedrock response');
  return text;
}

/** Parse JSON from a Bedrock response, with regex fallback */
export function parseJsonFromBedrock<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Try to extract JSON object from surrounding text
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error(`Could not parse JSON from Bedrock response: ${raw.slice(0, 200)}`);
  }
}
