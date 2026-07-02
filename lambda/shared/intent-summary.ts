import { invokeNovaMicro, LlmCallContext } from './bedrock-client';

// The chat's proven "what does the customer actually want" summarizer, shared so every surface
// (live-agent escalation via start-chat, and the phone callback cockpit via prep-callback) reads
// the SAME high-quality one-sentence intent instead of each rolling its own weaker version.
//
// Input is a full transcript formatted as "ROLE: message | ROLE: message | ...".
// Output is one concise sentence starting with the client's first name, focused on their underlying
// goal (not just their last message), with 1–2 defining words wrapped in **double asterisks**.
// Callers that render plain text (the phone cockpit) strip the ** markers.

export function intentSummarySystemPrompt(clientName: string): string {
  return `You are summarizing a full customer support chat transcript for a financial services agent.
The transcript is formatted as "ROLE: message | ROLE: message | ...".
The customer's name is ${clientName}. Other names that appear in the transcript (beneficiaries, fund names, etc.) are NOT the customer.
Write a single concise sentence (max 20 words) capturing what ${clientName}'s core need or question is.
Start the sentence with their first name, e.g. "Robert wants to **update** the **beneficiaries** on his SEP-IRA".
Focus on the customer's underlying goal — not just the last message.
Do not mention that the customer asked to speak to an agent or requested escalation — that is implied and wastes space.
Pick 1 or 2 words in your sentence that most distinguish the intent — typically the action and/or the account type or subject — and wrap them in **double asterisks** like **word**. Leave all other words unmarked.
Return only the plain text sentence with those markers — no quotes, no JSON, no punctuation at the end.`;
}

/**
 * Summarize a transcript into one concise intent sentence (with **markers**, first-name lead).
 * Returns the cleaned sentence; callers slice/strip as they need. Throws on LLM failure.
 */
export async function summarizeChatIntent(
  transcriptText: string,
  clientName: string,
  ctx?: LlmCallContext,
  maxTokens = 90,
): Promise<string> {
  const raw = await invokeNovaMicro(transcriptText, intentSummarySystemPrompt(clientName), maxTokens, ctx);
  return raw.trim().replace(/^["']|["']$/g, '').replace(/\.$/, '');
}
