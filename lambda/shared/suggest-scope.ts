// ── The deterministic ✈ suggestion: which automation should the agent start? ──
//
// PURE MODULE — no AWS imports, no I/O. Lifted out of next-best-response so that the
// SAME resolution can run on two paths that need different things:
//
//   1. next-best-response, after the LLM has drafted a reply, to correct the scope the
//      model guessed; and
//   2. the `scope-only` mode, called the instant a contact is accepted — before any
//      customer message arrives on the live socket, with no LLM call and no cost.
//
// (2) exists because the agent app hardcoded `suggestedScope: 'get-intent'` with no task
// on accept, and the code that would have attached the task was gated on a "last customer
// message" timestamp that only the live chat socket sets. The pre-agent transcript — the
// one containing "I'd like to buy a fund" — never set it. So the agent stared at a bare
// "Get intent" on the least ambiguous intent in the system.
//
// Keeping this server-side is deliberate: the ORDER (advice first, then latest message,
// then the whole customer side, then the trade fallback) is the part that is easy to get
// wrong, and duplicating it in the client would guarantee the two drift.

import { matchTaskByIntent } from './tasks';
import { isAdviceRequest } from './advice-guard';
import { ChatMessage } from './types';

/**
 * Last resort only. This used to fire on any message containing buy/sell/redeem and
 * force a callback, which dated from when trades genuinely could not be handled in chat.
 * They can now — place-purchase and place-sale are two of the 19 experts.
 */
const TRADE_RE = /\b(buy|sell|purchase|trade|place.?order|liquidat|redeem)\b/i;

export interface ScopeSuggestion {
  suggestedScope: string | null;
  suggestedTaskId: string | null;
}

export function resolveSuggestion(
  transcript: ChatMessage[],
  accountTypes: string[],
  llmScope: string | null,
): ScopeSuggestion {
  const customerMsgs = transcript.filter(m => m.role === 'CUSTOMER').map(m => m.content);
  const lastCustomerMsg = customerMsgs.length ? customerMsgs[customerMsgs.length - 1] : '';

  // Advice needs a licensed advisor; that outranks any task match.
  if (isAdviceRequest(lastCustomerMsg)) {
    return { suggestedScope: 'callback', suggestedTaskId: null };
  }

  // Latest message first, then the WHOLE customer side most-recent-first, so a newer
  // stated intent still wins but "I'd like to buy a fund" said at the very top is not
  // lost once the agent greets and the client answers "that's right".
  const allCustomer = [...customerMsgs].reverse().join('  ');
  const matched = matchTaskByIntent(lastCustomerMsg, accountTypes)
    ?? matchTaskByIntent(allCustomer, accountTypes);

  if (matched) return { suggestedScope: 'get-intent', suggestedTaskId: matched.id };

  // A trade word with no task match — better than leaving the agent with nothing.
  if (TRADE_RE.test(lastCustomerMsg)) return { suggestedScope: 'callback', suggestedTaskId: null };

  // Nothing deterministic to say: keep whatever the LLM proposed, with no task attached.
  return { suggestedScope: llmScope, suggestedTaskId: null };
}
