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

/**
 * Personalized investment-advice / recommendation requests.
 *
 * Two additions beyond the original pattern, both mirroring shapes already here and
 * both closing gaps the original missed (verified against it):
 *   - "get rid of / dump / switch out of" join the should-i verb list, so
 *     "Should I get rid of the bond fund I own?" is caught like "Should I sell...".
 *   - a REVERSED "best" branch, so "Of the funds I hold, which is best?" is caught like
 *     "What's the best fund?". It still requires an investment noun in the sentence, so
 *     a bare "which is best?" about something else does not trip it.
 */
export const ADVICE_RE = /\b(what|which|any|recommend|suggest|your)\b[^?.!]{0,50}\b(stock|stocks|fund|funds|invest|investment|investments|portfolio|allocation)\b|\b(stock|stocks|fund|funds|investment|investments|portfolio|allocation)\b[^?.!]{0,40}\bbest\b|\b(should i (buy|sell|invest|put|move|get rid of|dump|switch)|what should i do with|where should i (invest|put)|investment advice|financial advice|best (stock|stocks|fund|funds|investment|investments)|hot (stock|stocks|tip|tips))\b/i;

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
 * THE CURRENT-HOLDINGS CARVE-OUT: what a client ALREADY owns is a fact about their own
 * account, not a recommendation. ADVICE_RE's first branch is
 * "(what|which|...) ... (fund|stock|invest...)", which matched "Which fund do I hold
 * right now" on the substring "Which fund" and force-routed a running task expert to a
 * callback mid-conversation. The client was answering the expert's own question about
 * which fund to buy; we replied that we're not permitted to give advice.
 *
 * Holdings questions are answerable — get_holdings exists precisely for this, and the
 * task experts and customer bot are supposed to use it. So a question phrased around
 * holding / owning / being invested is exempted UNLESS it also carries a strong advice
 * marker ("which of my funds SHOULD I sell?"), which keeps genuine selection questions
 * on the callback path.
 */
const HOLDINGS_FACT_RE = new RegExp(
  [
    // "do I hold / own / have", "am I invested in", "did I buy"
    String.raw`\b(?:do|did|am|are|have|has)\s+(?:i|we|my|our)\b[^?.!]{0,40}\b(?:hold|holding|own|owns|invested|buy|bought|have)\b`,
    // "which fund(s) I hold", "what I own", "funds I'm invested in"
    String.raw`\b(?:i|we)\b\s*(?:'m|'re|am|are)?\s*(?:currently\s+)?\b(?:hold|holds|holding|own|owns|owning|invested)\b`,
    // possessive framing: "my funds", "my holdings", "my positions", "my portfolio right now"
    String.raw`\bmy\s+(?:current\s+)?(?:fund|funds|holding|holdings|position|positions)\b`,
    // "what's in my Roth", "what is in my taxable account"
    String.raw`\bwhat(?:'s| is| are)\b[^?.!]{0,20}\bin\s+my\b`,
  ].join('|'),
  'i',
);

/**
 * Advice markers strong enough to override the contribution carve-out: these are asking
 * WHICH investment to choose, which stays a licensed-advisor question even when the
 * sentence also mentions a contribution.
 */
const STRONG_ADVICE_RE = /\b(recommend|suggest|investment advice|financial advice|should i (buy|sell|invest|put|move)|what should i do with|where should i (invest|put)|best (stock|stocks|fund|funds|investment|investments)|hot (stock|stocks|tip|tips)|which (fund|funds|stock|stocks))\b/i;

/**
 * Asking what to DO, rather than what IS. This is what overrides the holdings carve-out:
 * "which fund do I hold" is a lookup, but "which of my funds should I sell" is advice,
 * and both match HOLDINGS_FACT_RE. Deliberately verb- and superlative-based — it must
 * NOT contain a bare "which fund", or it would re-break the very phrasing being fixed.
 */
const SELECTION_INTENT_RE = /\b(recommend|suggest|advice|should i|should we|what should|which should|best|better|worth (buying|selling|keeping)|get rid of|ought to)\b/i;

/**
 * True when a message is a personalized-investment-advice request that must be routed
 * to a licensed advisor. Use this instead of testing ADVICE_RE directly.
 *
 * ADVICE_RE remains the final authority — the carve-outs can only ever EXEMPT a message,
 * never promote one — so narrowing here cannot create new false positives elsewhere.
 */
export function isAdviceRequest(message: string): boolean {
  if (!message) return false;
  // What the client already holds is a fact, unless they're asking what to do about it.
  if (HOLDINGS_FACT_RE.test(message) && !SELECTION_INTENT_RE.test(message)) return false;
  // Contribution limits are tax rules, unless the question is really fund selection.
  if (CONTRIBUTION_ROOM_RE.test(message) && !STRONG_ADVICE_RE.test(message)) return false;
  return ADVICE_RE.test(message);
}
