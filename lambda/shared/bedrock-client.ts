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
  jsonMode = false,
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
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
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

// ── Tool-calling (agentic loop) ────────────────────────────────────────────

import type { OpenAITool } from './client-tools';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface InvokeWithToolsResult {
  text: string;
  toolsUsed: string[];
}

const MAX_TOOL_ITERATIONS = 3;
const MONEY_RE = /\$[\d,]+|\b\d{1,3}(?:,\d{3})+\b/;

async function openAiCall(
  body: Record<string, unknown>,
  ctx: LlmCallContext & { clientId: string },
  iteration: number,
): Promise<{ choice: { finish_reason: string; message: OpenAIMessage & { tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> } }; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }; durationMs: number }> {
  const startMs = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.log(JSON.stringify({ event: 'llm_error', fn: ctx.fn, contactId: ctx.contactId, clientId: ctx.clientId, scope: ctx.scope, status: res.status, durationMs: Date.now() - startMs }));
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }
  const data = await res.json() as { choices: Array<{ finish_reason: string; message: OpenAIMessage & { tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> } }>; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } };
  const durationMs = Date.now() - startMs;
  console.log(JSON.stringify({ event: 'llm_call_with_tools', fn: ctx.fn, contactId: ctx.contactId, clientId: ctx.clientId, scope: ctx.scope, iteration, model: OPENAI_MODEL, promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens, totalTokens: data.usage?.total_tokens, durationMs, toolCallCount: data.choices[0]?.message?.tool_calls?.length ?? 0 }));
  return { choice: data.choices[0], usage: data.usage, durationMs };
}

export async function invokeWithTools(
  systemPrompt: string,
  messages: OpenAIMessage[],
  tools: OpenAITool[],
  toolExecutor: (toolName: string) => Promise<string>,
  maxTokens: number,
  ctx: LlmCallContext & { clientId: string },
  jsonMode = false,
  model = OPENAI_MODEL,
): Promise<InvokeWithToolsResult> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const current: OpenAIMessage[] = [...messages];
  const toolsUsed: string[] = [];

  // Phase 1: tool-calling loop — gather data
  // response_format is intentionally omitted; incompatible with tools in OpenAI API.
  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const { choice } = await openAiCall({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...current],
      tools,
      tool_choice: 'auto',
      max_tokens: maxTokens,
      temperature: 0.3,
    }, ctx, iteration);

    const assistantMsg = choice.message;

    if (choice.finish_reason === 'tool_calls' && assistantMsg.tool_calls?.length) {
      current.push(assistantMsg);
      const toolResults = await Promise.all(
        assistantMsg.tool_calls.map(async tc => {
          const toolStartMs = Date.now();
          const result = await toolExecutor(tc.function.name);
          console.log(JSON.stringify({ event: 'tool_call', fn: ctx.fn, contactId: ctx.contactId, clientId: ctx.clientId, tool: tc.function.name, durationMs: Date.now() - toolStartMs, resultChars: result.length }));
          toolsUsed.push(tc.function.name);
          return { role: 'tool' as const, content: result, tool_call_id: tc.id, name: tc.function.name };
        }),
      );
      current.push(...toolResults);
      continue;
    }

    // finish_reason === 'stop'
    if (toolsUsed.length === 0) {
      if (!jsonMode) {
        // Prose response, no JSON needed — return directly.
        return { text: assistantMsg.content ?? '', toolsUsed };
      }
      // jsonMode=true but no tools called — push prose to current so Phase 2 can reformat
      // with response_format: json_object. Without this, gpt-4o-mini sometimes ignores the
      // "Return ONLY valid JSON" system prompt instruction when tools are present in the call.
      current.push(assistantMsg);
    }

    // Both no-tools+jsonMode and tools-used+stop fall through to Phase 2.
    break;
  }

  if (toolsUsed.length === 0 && current.length <= messages.length) {
    // Max iterations without any useful content accumulated — safety net
    console.log(JSON.stringify({ event: 'tool_loop_max_iterations', fn: ctx.fn, contactId: ctx.contactId, clientId: ctx.clientId, toolsUsed }));
    return { text: '', toolsUsed };
  }

  // Phase 2: final json-mode call (no tools) — reformat into structured output.
  // `current` holds either tool results (when tools were called) or a prose assistant
  // message (when no tools were called but jsonMode=true). Either way, the model
  // synthesizes them into the required JSON shape with response_format enforced.
  const { choice: finalChoice } = await openAiCall({
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...current],
    max_tokens: maxTokens,
    temperature: 0.3,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  }, ctx, MAX_TOOL_ITERATIONS);

  const text = finalChoice.message.content ?? '';
  if (MONEY_RE.test(text) && jsonMode && toolsUsed.length === 0) {
    console.log(JSON.stringify({ event: 'possible_hallucination_risk', fn: ctx.fn, contactId: ctx.contactId, clientId: ctx.clientId, scope: ctx.scope }));
  }
  return { text, toolsUsed };
}

// ── JSON parse helper ──────────────────────────────────────────────────────

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
