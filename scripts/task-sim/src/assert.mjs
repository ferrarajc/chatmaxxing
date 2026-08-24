// ── Deterministic assertions on the proposed action ──────────────────────────
//
// These decide pass/fail. The advisory judge never touches this.
//
// Because the goal was GENERATED, we know exactly what the client asked for — so we can
// check that the expert collected the right VALUES, not merely that it collected
// something. The suite this replaces asserted only non-emptiness: the string "TBD" would
// have passed roughly 40 of its ~55 checks, and no harness ever verified that `amount`
// was the amount the persona actually said.
//
// Comparison is SEMANTIC, via the production resolvers. "Taxable Account (acc-302)"
// must count as a correct answer for acc-302, because resolveAccount accepts it and so
// does the handler. Asserting string equality would fail the expert for being right.

import { getFacts } from './facts.mjs';

const LEADING_VERB = /^(Sell|Buy|Purchase|Withdraw|Send|Grant|Update|Remove|Open|Exchange|Invest|Convert|Cancel|Reschedule|Roll|Set|Add|Change|Transfer|Enable|Disable|Replace|Modify|Close|Schedule|Pause|Resume)\b/;

export async function assertProposedAction({ goal, proposedAction, taskFields, snapshot, task }) {
  const facts = await getFacts();
  const out = [];
  const A = (id, ok, message, detail) => out.push({ id, ok: !!ok, message, detail, source: 'assertion' });

  if (!proposedAction) {
    A('PROPOSED_ACTION_PRESENT', false, 'The expert never produced a proposed action.');
    return out;
  }
  A('PROPOSED_ACTION_PRESENT', true, 'A proposed action was produced.');
  A('TASK_ID_CORRECT', proposedAction.taskId === goal.taskId,
    `proposedAction.taskId should be "${goal.taskId}"`, `got "${proposedAction.taskId}"`);

  const expectedSubmission = task?.submissionType ?? 'agent';
  A('SUBMISSION_TYPE_STAMPED', (proposedAction.submissionType ?? 'agent') === expectedSubmission,
    `submissionType should be "${expectedSubmission}" (stamped server-side)`,
    `got "${proposedAction.submissionType ?? 'agent'}"`);

  const byKey = Object.fromEntries((proposedAction.fields ?? []).map(f => [f.key, f.value]));

  // Every field the Lambda would require must be present and non-empty.
  for (const f of taskFields) {
    const v = byKey[f.key];
    A(`FIELD_PRESENT:${f.key}`, v != null && String(v).trim() !== '',
      `"${f.label}" must be collected`, v == null ? 'missing' : 'empty');
  }

  // No invented fields. `ben_N_*` is a legitimate dynamic family.
  const allowed = new Set(taskFields.map(f => f.key));
  for (const k of Object.keys(byKey)) {
    if (allowed.has(k) || /^ben_\d+_/.test(k)) continue;
    A(`NO_EXTRA_FIELD:${k}`, false, `"${k}" is not a field of this task`, String(byKey[k]).slice(0, 60));
  }

  // ── The values must match what the client actually asked for ───────────────
  for (const gf of goal.fields) {
    const actual = byKey[gf.key];
    if (actual == null) continue;                       // already reported as missing
    const want = String(gf.value);

    if (/accountid$/i.test(gf.key)) {
      const resolved = facts.resolveAccount(snapshot.accounts ?? [], String(actual));
      A(`VALUE_MATCHES:${gf.key}`, resolved?.id === want,
        `account should resolve to ${want}`,
        `"${actual}" → ${resolved?.id ?? 'UNRESOLVABLE'}`);
      continue;
    }

    if (/fund$/i.test(gf.key) || /ticker/i.test(gf.key)) {
      const norm = s => {
        const up = String(s).trim().toUpperCase();
        if (facts.FUND_PRICES[up]) return up;
        const hit = Object.entries(facts.FUND_PRICES).find(([tk, info]) =>
          info.name.toUpperCase() === up || up.includes(tk));
        return hit?.[0] ?? up;
      };
      A(`VALUE_MATCHES:${gf.key}`, norm(actual) === norm(want),
        `fund should be ${want}`, `got "${actual}"`);
      continue;
    }

    if (/amount|initial|estimated/i.test(gf.key)) {
      const ceiling = goal.position?.value ?? goal.account?.balance ?? 0;
      const a = facts.resolveAmount(String(actual), ceiling);
      const w = facts.resolveAmount(want, ceiling);
      A(`VALUE_MATCHES:${gf.key}`, Number.isFinite(a) && Number.isFinite(w) && Math.abs(a - w) <= 1,
        `amount should be ${want}`, `got "${actual}" (${a})`);
      continue;
    }

    // Everything else: case-insensitive, whitespace-tolerant containment either way.
    const na = String(actual).toLowerCase().trim();
    const nw = want.toLowerCase().trim();
    A(`VALUE_MATCHES:${gf.key}`, na === nw || na.includes(nw) || nw.includes(na),
      `"${gf.label}" should be "${want}"`, `got "${actual}"`);
  }

  // ── The summary is what the CLIENT reads on the confirmation ───────────────
  const summary = String(proposedAction.summary ?? '');
  A('SUMMARY_PRESENT', summary.trim().length > 0, 'A summary must be written.');
  if (summary.trim()) {
    const head = summary.replace(/^\[[^\]]*\]\s*/, '');
    const nounPhrase = /^\w+\s+of\s/.test(head) || !LEADING_VERB.test(head);
    A('SUMMARY_IS_NOUN_PHRASE', nounPhrase,
      'The summary must be a noun phrase — it is shown before AND after submission.',
      `starts with "${head.split(' ')[0]}"`);
    A('SUMMARY_NOT_TOO_LONG', summary.length <= 160, 'Summary should stay under ~160 chars.',
      `${summary.length} chars`);

    // If the ask involved money, the client's confirmation should name it.
    const goalMoney = goal.fields.filter(f => /amount/i.test(f.key))
      .flatMap(f => [...String(f.value).matchAll(/([\d,]+)/g)].map(m => m[1].replace(/,/g, '')));
    if (goalMoney.length) {
      const flat = summary.replace(/,/g, '');
      A('SUMMARY_NAMES_THE_FIGURE', goalMoney.some(n => flat.includes(n)),
        'The summary should state the amount the client agreed to.', summary);
    }
  }
  return out;
}

export function assertExecution({ result }) {
  const out = [];
  const A = (id, ok, message, detail) => out.push({ id, ok: !!ok, message, detail, source: 'assertion' });
  A('EXECUTE_SUCCEEDED', result?.success === true,
    'execute-task must report success.', result?.message);
  if (result?.success) {
    A('REFERENCE_NUMBER', /^REF-[A-Z0-9]{6}$/.test(result.referenceNumber ?? ''),
      'A well-formed reference number must be issued.', result?.referenceNumber);
  }
  return out;
}
