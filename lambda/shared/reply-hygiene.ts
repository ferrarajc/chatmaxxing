// ── Reply hygiene: keep agent-internal text out of client-facing replies ─────
//
// PURE MODULE — no AWS imports, no I/O, no React. Safe to import anywhere.
//
// A task-expert turn returns two strings for two DIFFERENT audiences:
//
//   response     → sent VERBATIM to the client in the chat
//   exitMessage  → read only by the human agent, explaining why autopilot handed back
//
// EXIT_MESSAGE_INSTRUCTION shows the model an example exitMessage ("All fields
// collected — proposed action is ready for review."), and a task expert appended
// exactly that to its response. Mid-purchase, a client was told:
//
//   "Great, I'll proceed with that. All fields collected — proposed action is ready
//    for review."
//
// The first sentence is exactly right. The second exposes internal machinery the
// client has no idea exists, and reads like a system leak. The prompt now separates
// the two audiences explicitly — but a prompt is a suggestion, and this is the rule.

/**
 * Phrases that only ever belong to the AGENT's view of a task run. Deliberately
 * narrow: it must match the internal bookkeeping without catching ordinary words a
 * client reply legitimately uses ("I'll send you a statement to review").
 */
const INTERNAL_STATUS_RE =
  /\b(proposed action|all (?:required )?fields (?:are )?(?:collected|gathered)|ready for (?:your )?review|autopilot|field collection|shouldExitAutopilot|handing back control)\b/i;

/**
 * Remove internal, agent-facing status from a reply that is about to be sent to a
 * client. Returns the reply unchanged when there is nothing to strip.
 *
 * SENTENCE-GRANULAR on purpose: the surrounding reply is almost always good, and only
 * the bookkeeping clause has to go — so "Great, I'll proceed with that." survives.
 */
export function stripInternalStatus(response: string | undefined | null, exitMessage?: string | null): string {
  let out = (response ?? '').trim();
  if (!out) return '';

  // 1. The model echoing its own exitMessage verbatim is the common case.
  const exit = (exitMessage ?? '').trim();
  if (exit && out.includes(exit)) out = out.replace(exit, '').trim();

  // 2. Drop any remaining sentence that talks about internal machinery. Split on
  //    sentence ends but KEEP the delimiters, so surviving text still reads naturally.
  const parts = out.match(/[^.!?]+[.!?]*\s*/g) ?? [out];
  out = parts.filter(p => !INTERNAL_STATUS_RE.test(p)).join('').trim();

  // 3. Tidy what a removed clause leaves behind: a dangling dash, doubled spaces.
  out = out.replace(/\s*[—–-]\s*$/, '').replace(/\s{2,}/g, ' ').trim();

  return out;
}
