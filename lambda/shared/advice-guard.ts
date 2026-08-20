// ── Financial-advice guard ───────────────────────────────────────────────────
//
// Personalized investment advice must route to a callback with a licensed advisor
// rather than be answered by autopilot. This module holds that test.
//
// It was previously an identical ADVICE_RE copy-pasted into autopilot-turn and
// next-best-response; both now import from here so the rule cannot drift between the
// customer-facing path and the agent-suggestion path.
//
// THE CONTRIBUTION-ROOM CARVE-OUT: ADVICE_RE matches "invest" as a substring of
// "investment", which meant a plain factual question like "What can I still invest in
// my IRA this year?" was force-routed to a callback before any LLM call — a question
// the product is explicitly supposed to answer (see SELF_SERVICE_PAGES, the t-ira-limits
// KB topic, and the get_contribution_room tool). Contribution limits are tax-rule facts,
// not investment recommendations. So a contribution-room question is exempted UNLESS it
// also carries a strong advice marker ("what's the BEST FUND for my contribution?"),
// which keeps genuine fund-selection questions on the callback path.

/** Personalized investment-advice / recommendation requests. */
export const ADVICE_RE = /\b(what|which|any|recommend|suggest|your)\b[^?.!]{0,50}\b(stock|stocks|fund|funds|invest|investment|investments|portfolio|allocation)\b|\b(should i (buy|sell|invest|put|move)|what should i do with|where should i (invest|put)|investment advice|financial advice|best (stock|stocks|fund|funds|investment|investments)|hot (stock|stocks|tip|tips))\b/i;

/**
 * Questions about how much may be contributed to a retirement account — contribution
 * totals, limits, remaining room, catch-up, over-contribution, deadlines.
 */
const CONTRIBUTION_ROOM_RE = new RegExp(
  [
    // explicit contribution vocabulary
    String.raw`\bcontribut\w+\b`,
    String.raw`\bcatch.?up\b`,
    String.raw`\bmax(?:ed|ing)?\s+out\b`,
    // "how much can I STILL put in my IRA", "what can I still invest in my Roth"
    String.raw`\b(?:how much|what)\b[^?.!]{0,40}\b(?:still|left|remaining|room|more)\b[^?.!]{0,40}\b(?:ira|roth|sep|401\s?k|retirement)\b`,
    // "my IRA limit", "Roth deadline", "is my SEP maxed"
    String.raw`\b(?:ira|roth|sep|401\s?k|retirement)\b[^?.!]{0,40}\b(?:limit|room|remaining|left|deadline|maxed)\b`,
  ].join('|'),
  'i',
);

/**
 * Advice markers strong enough to override the carve-out: these are asking WHICH
 * investment to choose, which stays a licensed-advisor question even when the sentence
 * also mentions a contribution.
 */
const STRONG_ADVICE_RE = /\b(recommend|suggest|investment advice|financial advice|should i (buy|sell|invest|put|move)|what should i do with|where should i (invest|put)|best (stock|stocks|fund|funds|investment|investments)|hot (stock|stocks|tip|tips)|which (fund|funds|stock|stocks))\b/i;

/**
 * True when a message is a personalized-investment-advice request that must be routed
 * to a licensed advisor. Use this instead of testing ADVICE_RE directly.
 */
export function isAdviceRequest(message: string): boolean {
  if (!message) return false;
  if (CONTRIBUTION_ROOM_RE.test(message) && !STRONG_ADVICE_RE.test(message)) return false;
  return ADVICE_RE.test(message);
}
