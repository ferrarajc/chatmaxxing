// ── The advisory judge ───────────────────────────────────────────────────────
//
// ADVISORY ONLY. It annotates; it never grades. Deterministic assertions alone decide
// pass/fail.
//
// That constraint is not squeamishness — it is the lesson from the system this repo
// already shelved. That loop ran one conversation per scenario, had an LLM judge produce
// a score, and fed the score into automatic prompt edits. Each "fix" regressed something
// the last one passed, until the whole run of edits was rolled back and the tool was
// abandoned. The judge was the noise source; the feedback path turned noise into
// production changes.
//
// The good idea in there was `violatedTurns` — per-turn pointers, so a human reading a
// transcript is taken straight to the moment. That is kept. The feedback path is not.
//
// Two structural guarantees, enforced in code rather than trusted to the prompt:
//   1. A closed code enum. Anything outside it is dropped.
//   2. Any note that mentions a file, a prompt, a line number or an edit is DROPPED.
//      A code suggestion physically cannot reach the report.

const CODES = new Set([
  'CONFUSING_QUESTION', 'TONE_OFF', 'REPEATED_SELF', 'IGNORED_WHAT_CLIENT_SAID',
  'UNEXPLAINED_JARGON', 'MISSING_CONTEXT_THE_CLIENT_NEEDED', 'RECAP_INACCURATE',
  'ROBOTIC_OR_TEMPLATED', 'ASKED_FOR_SOMETHING_ALREADY_GIVEN', 'LEFT_CLIENT_HANGING',
]);

/** The anti-resurrection filter. If a note reads like a patch, it is not a note. */
const LOOKS_LIKE_A_CODE_EDIT =
  /\.ts\b|\.mjs\b|handler|prompt|line \d+|should (be )?chang|add a (rule|line)|edit|patch|diff|regex|const |function /i;

const SYSTEM = `You are an ADVISOR reviewing a customer-service chat transcript from a mutual-fund company.

You do NOT decide pass or fail. Do not output a score, a grade, a percentage, or the words "pass" or "fail".
Do not propose code, prompt text, file names, or diffs. Describe what a USER would experience, and stop.

You are shown ONLY what the customer saw. Do not speculate about internal machinery.

Flag only things a real customer would actually notice and care about. Prefer NO notes over speculation.
At most 6 notes. Every note must cite the turn index or indices where it is visible.

IMPORTANT — these are NOT problems:
- The agent proactively suggesting a related product or service the customer might want. That is
  intentional and valued.
- One chat handling more than one request in sequence.
- A recap that restates details before acting.

Return ONLY JSON:
{"notes":[{"code":"<CODE>","turns":[0],"note":"<=25 words quoting the transcript","confidence":"high|medium|low"}]}

Valid codes: ${[...CODES].join(', ')}`;

export async function judgeTranscript({ apiKey, model = 'gpt-4o', clientView, goal, snapshot, alreadyFound = [] }) {
  const lines = clientView.map(t => `[${t.i}] ${t.role === 'you' ? 'Customer' : 'Agent'}: ${t.text}`).join('\n');
  const known = alreadyFound.length
    ? `\n\nAlready reported by automated checks (do NOT repeat these):\n` +
      alreadyFound.map(f => `- turn ${f.turnIndex}: ${f.code}`).join('\n')
    : '';

  const user =
`The customer wanted: ${goal.taskName}.
Facts they had: ${goal.fields.map(f => `${f.label}=${f.value}`).join(', ')}.
Facts the agent could have known: ${(snapshot.accounts ?? []).map(a => `${a.type} ${a.id} total $${a.balance}, cash $${a.cash}`).join('; ')}.

TRANSCRIPT (this is everything the customer saw):
${lines}${known}`;

  let parsed;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 900,
      }),
    });
    if (!res.ok) return { notes: [], error: `judge HTTP ${res.status}` };
    const data = await res.json();
    parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
  } catch (e) {
    return { notes: [], error: String(e.message ?? e) };
  }

  const maxTurn = clientView.length - 1;
  const notes = (parsed.notes ?? [])
    .filter(n => n && CODES.has(n.code))
    .filter(n => Array.isArray(n.turns) && n.turns.length &&
                 n.turns.every(t => Number.isInteger(t) && t >= 0 && t <= maxTurn))
    .filter(n => typeof n.note === 'string' && n.note.trim() && !LOOKS_LIKE_A_CODE_EDIT.test(n.note))
    .slice(0, 6)
    .map((n, k) => ({
      noteId: `J${k + 1}`,
      code: n.code,
      turns: n.turns,
      note: n.note.trim().slice(0, 200),
      confidence: ['high', 'medium', 'low'].includes(n.confidence) ? n.confidence : 'medium',
      severity: 'advisory',
      source: 'advisory',
    }));

  return { notes, dropped: (parsed.notes ?? []).length - notes.length };
}

/** Explode multi-turn notes into per-turn annotations sharing a noteId. */
export function judgeAnnotations(notes) {
  return notes.flatMap(n => n.turns.map(t => ({
    code: n.code, severity: 'advisory', turnIndex: t,
    message: n.note, noteId: n.noteId, confidence: n.confidence, source: 'advisory',
  })));
}
