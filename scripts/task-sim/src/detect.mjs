// ── Deterministic problem detectors ──────────────────────────────────────────
//
// Every detector here corresponds to a bug that actually shipped and was found by a
// human reading a transcript. That is the design brief: automate the reading.
//
// They run ONLY over what the client saw. Agent-only material (SYSTEM markers,
// exitMessage, the Lambda's res.message, the proposed-action card) is captured for the
// report but never judged — a problem the client cannot see is not a user problem.
//
// SEVERITY. `fail` decides the run. `warn` annotates only. The fuzzy detectors ship as
// `warn` deliberately: a tool that cries wolf in its first week is ignored in its
// second. Promote one to `fail` once it has been watched being right.
//
// NOT A PROBLEM — read this before adding a detector:
//   • An unprompted CROSS-SELL is a feature. After a purchase the expert offering a
//     systematic investment plan, and the chat then running a second task, is the
//     product working as intended. Never flag it as an off-list question or a turn
//     blowout.
//   • A recap ("just to confirm…") legitimately restates answered fields.
//   • A multi-task chat is valid; the [TASK:] marker is last-wins for exactly that.

import { getFacts } from './facts.mjs';

/** The handler's catch-path fallbacks. Seeing one means the LLM call failed — usually a 429. */
const HOLDING_REPLIES = [
  "I'm pulling some information, give me just a few moments please.",
  'I can help with that — could I get a few details?',
  "Thanks — I'm getting that set up for you now.",
];

const INVENTED_PAST_TENSE = /\b(selled|buyed|withdrawed|sended|maked|payed|choosed|holded|costed)\b/i;
const RECAP_CUE = /just to confirm|to make sure|did you mean|is that right|before i (proceed|work)|let me confirm/i;
const CROSS_SELL_CUE = /you might (want|like)|would you like more information|consider(ing)? (setting up|a)|explore/i;

const norm = s => (s ?? '').toLowerCase().replace(/[^a-z0-9$., ]/g, ' ').replace(/\s+/g, ' ').trim();
const moneyIn = s => [...String(s ?? '').matchAll(/\$\s?([\d,]+(?:\.\d{1,2})?)/g)].map(m => Number(m[1].replace(/,/g, '')));

/**
 * @param {object} sim  { clientView, goal, snapshot, proposedAction, taskFields }
 * @returns {Array} findings — { code, severity, turnIndex, message, evidence }
 */
export async function detect(sim) {
  const facts = await getFacts();
  const out = [];
  const add = (code, severity, turnIndex, message, evidence) =>
    out.push({ code, severity, turnIndex, message, evidence, source: 'deterministic' });

  const { clientView, goal, snapshot } = sim;
  const agentTurns = clientView.filter(t => t.role === 'agent');

  // ── D11 rate-limit poisoning — checked FIRST, because it invalidates everything ──
  for (const t of clientView) {
    if (t.role !== 'agent') continue;
    if (HOLDING_REPLIES.some(h => (t.text ?? '').trim() === h)) {
      add('HOLDING_REPLY', 'inconclusive', t.i,
        'The expert returned a catch-path holding reply — the LLM call failed (usually a 429 rate limit). ' +
        'This simulation tells us nothing about product quality.',
        t.text);
    }
  }

  // ── D1 internal status reaching the client ──────────────────────────────────
  // Uses the SHIPPED strip. A hit means the production regex missed a new phrasing.
  for (const t of agentTurns) {
    // Compare CONTENT, not formatting: stripInternalStatus also collapses runs of
    // whitespace, so a plain equality check false-positives on every confirmation
    // (which contains a blank line by construction).
    const flat = x => (x ?? '').replace(/\s+/g, ' ').trim();
    const cleaned = facts.stripInternalStatus(t.text, null);
    if (flat(cleaned) !== flat(t.text)) {
      add('INTERNAL_STATUS_LEAK', 'fail', t.i,
        'Agent-facing status reached the client. reply-hygiene stripped it here, which means ' +
        'the shipped pattern did not catch it upstream.',
        t.text);
    }
  }

  // ── D2 empty client turn ────────────────────────────────────────────────────
  for (const t of agentTurns) {
    if (!(t.text ?? '').trim()) {
      add('EMPTY_CLIENT_TURN', 'fail', t.i, 'The client received an empty message.', '');
    }
  }

  // ── D6 invented past tense ──────────────────────────────────────────────────
  for (const t of agentTurns) {
    const m = (t.text ?? '').match(INVENTED_PAST_TENSE);
    if (m) {
      add('INVENTED_PAST_TENSE', 'fail', t.i,
        `"${m[0]}" is not a word. A summary or confirmation is being conjugated.`, t.text);
    }
  }

  // ── D3 offering funds the client does not hold ──────────────────────────────
  // Only meaningful for tasks that operate on an existing position.
  const operatesOnHoldings = /sale|sell|exchange|drip|redeem/i.test(goal.taskId);
  if (operatesOnHoldings) {
    const held = new Set((snapshot.holdings ?? [])
      .filter(h => h.accountId === goal.account?.id).map(h => h.ticker));
    for (const t of agentTurns) {
      const mentioned = [...new Set([...(t.text ?? '').matchAll(/\b(BF[A-Z0-9]{2,5})\b/g)].map(m => m[1]))];
      const unheld = mentioned.filter(tk => facts.FUND_PRICES[tk] && !held.has(tk));
      if (unheld.length >= 2) {
        add('OFFERED_UNHELD_FUND', unheld.length >= 4 ? 'fail' : 'warn', t.i,
          `Offered ${unheld.length} funds the client does not hold in ${goal.account?.id}: ${unheld.slice(0, 8).join(', ')}` +
          `${unheld.length > 8 ? '…' : ''}. They hold ${[...held].join(', ') || 'nothing there'}.`,
          t.text);
      }
    }
  }

  // ── D12 ungrounded money figures ────────────────────────────────────────────
  // Every $ the agent states should trace to real account data or something the client
  // said. This is the "$4,800 of cash that did not exist" detector.
  const grounded = new Set();
  for (const a of snapshot.accounts ?? []) {
    grounded.add(a.balance); grounded.add(a.cash);
    grounded.add(facts.investedValue(snapshot.holdings ?? [], a.id));
  }
  for (const h of snapshot.holdings ?? []) { grounded.add(h.value); grounded.add(Math.round(h.price)); }
  grounded.add(snapshot.totalBalance);
  for (const f of goal.fields) for (const n of moneyIn(f.value)) grounded.add(n);

  for (const t of clientView) {
    if (t.role !== 'agent') continue;
    const saidEarlier = clientView.filter(x => x.i < t.i && x.role === 'you').flatMap(x => moneyIn(x.text));
    for (const n of moneyIn(t.text)) {
      const ok = [...grounded, ...saidEarlier].some(g => typeof g === 'number' && Math.abs(g - n) <= 1);
      if (!ok) {
        add('UNGROUNDED_FIGURE', 'warn', t.i,
          `$${n.toLocaleString()} does not match any account balance, cash figure, holding value, ` +
          `or anything the client said. It may be arithmetic — or invented.`, t.text);
      }
    }
  }

  // ── D16 a figure described as CASH that isn't the cash ──────────────────────
  //
  // The original bug was not an invented number — it was a real one, mislabelled.
  // The expert told a client she had "$4,800 held in cash" when $4,800 was the
  // account's TOTAL and her cash was $877. D12 cannot see that, because 4,800 is a
  // perfectly real figure. This can: a sum described as cash must equal some account's
  // actual cash.
  //
  // The window between the amount and the word "cash" is deliberately tight, so that
  // "not enough for a $4,800 purchase … sell holdings to raise cash" is not a hit.
  const realCash = new Set((snapshot.accounts ?? []).map(a => a.cash).filter(c => typeof c === 'number'));
  for (const t of agentTurns) {
    for (const m of (t.text ?? '').matchAll(/\$\s?([\d,]+(?:\.\d{1,2})?)([^.!?$]{0,25}?)\bcash\b/gi)) {
      const stated = Number(m[1].replace(/,/g, ''));
      if (![...realCash].some(c => Math.abs(c - stated) <= 1)) {
        add('CASH_MISSTATED', 'fail', t.i,
          `Told the client $${stated.toLocaleString()} is cash. Their actual cash is ` +
          `${[...realCash].map(c => '$' + c.toLocaleString()).join(' / ') || 'none'}. ` +
          `A real figure described as the wrong thing is still wrong.`,
          t.text);
      }
    }
  }

  // ── D4 re-asking a field the client already answered ────────────────────────
  const answeredAt = new Map();
  for (const f of goal.fields) {
    const needle = norm(f.value);
    if (!needle || needle.length < 2) continue;
    for (const t of clientView) {
      if (t.role !== 'you') continue;
      if (norm(t.text).includes(needle)) { answeredAt.set(f.key, t.i); break; }
    }
  }
  // The match must be DISCRIMINATIVE, not merely strong.
  //
  // A task's field questions are nearly the same sentence — "Which account would you
  // like to sell from?", "Which fund would you like to sell?", "How much would you like
  // to sell?" — so raw token overlap fires everywhere. The first live run flagged
  // "Which fund would you like to sell from in your Traditional IRA?" as re-asking the
  // ACCOUNT, at 0.83 overlap, purely on the shared filler words.
  //
  // So: score the message against EVERY field, take the best, and only accuse the agent
  // of repeating itself when there is no innocent reading — i.e. when no still-unanswered
  // field matches just as well. An agent naming the fund while asking the amount is doing
  // its job, not repeating a question.
  // Score against the ASK, not the whole question string. Several field questions append
  // an option list — fund's is `Which fund would you like to sell? Options: BF500, BFGR,
  // BFBI, BFIN, BFESG, BFST.` — and those tickers inflate the denominator, so the fund
  // question could never score highly while the short account question scored ~1.0 and
  // won every argmax. That is why the first full run flagged "re-asked the Account" on
  // all ten simulations: a scoring artefact, not agent behaviour.
  const askHead = q => String(q ?? '').split(/[?:—–]/)[0];
  const score = (text, field) => {
    const qWords = new Set(norm(askHead(field.question)).split(' ').filter(w => w.length > 3));
    if (!qWords.size) return 0;
    const tWords = new Set(norm(text).split(' '));
    return [...qWords].filter(w => tWords.has(w)).length / qWords.size;
  };

  for (const t of agentTurns) {
    if (!/\?/.test(t.text ?? '')) continue;
    if (RECAP_CUE.test(t.text)) continue;             // a recap may restate anything
    if (CROSS_SELL_CUE.test(t.text)) continue;        // a cross-sell is a feature

    const scored = (sim.taskFields ?? [])
      .map(f => ({ f, s: score(t.text, f), answeredAt: answeredAt.get(f.key) }))
      .sort((a, b) => b.s - a.s);
    const best = scored[0];
    if (!best || best.s < 0.5) continue;
    if (best.answeredAt === undefined || best.answeredAt >= t.i) continue;

    // Two innocent readings, either of which is enough to stay quiet.
    //
    // (a) A still-unanswered field matches at least as well.
    // (b) The message NAMES a still-unanswered field. This is the reliable signal, and
    //     word overlap is not: "What fund would you like to sell from in your Taxable
    //     Account?" scored 0.83 against the account question and 0.80 against the fund
    //     one — flagged as re-asking the account purely because it said "What" rather
    //     than "Which". The word "fund" is right there; that is what a reader uses.
    const nounOf = f =>
      String(f.label ?? f.key).toLowerCase().trim().split(/\s+/).pop().replace(/id$/, '');
    const tWords = new Set(norm(t.text).split(' '));
    const unanswered = scored.filter(x => x.answeredAt === undefined || x.answeredAt >= t.i);

    if (unanswered.some(x => x.s >= best.s)) continue;
    if (unanswered.some(x => tWords.has(nounOf(x.f)))) continue;

    add('REASKED_ANSWERED_FIELD', 'warn', t.i,
      `Asked again for "${best.f.label}" — the client already answered it at turn ${best.answeredAt}.`,
      t.text);
  }

  // ── D5 asking for something we must never ask ───────────────────────────────
  const BANNED = /\b(social security|ssn|date of birth|driver'?s licen[cs]e|mother'?s maiden|routing number|full card number)\b/i;
  for (const t of agentTurns) {
    const m = (t.text ?? '').match(BANNED);
    if (m) {
      add('ASKED_BANNED_DETAIL', 'fail', t.i,
        `Asked the client for "${m[0]}" — the prompts explicitly forbid this.`, t.text);
    }
  }

  // ── D9 turn blowout ─────────────────────────────────────────────────────────
  // Generous, and only counts turns up to the proposed action — a cross-sell and a
  // second task legitimately extend a chat well past the first task's field count.
  const upToAction = sim.actionTurnIndex ?? clientView.length;
  const agentBeforeAction = agentTurns.filter(t => t.i <= upToAction).length;
  const budget = (sim.taskFields?.length ?? 3) + 3;
  if (agentBeforeAction > budget) {
    add('TURN_BLOWOUT', 'warn', upToAction,
      `Took ${agentBeforeAction} agent turns to collect ${sim.taskFields?.length ?? '?'} fields ` +
      `(budget ${budget}).`, '');
  }

  // ── D14 duplicate agent message ─────────────────────────────────────────────
  for (let a = 0; a < agentTurns.length; a++) {
    for (let b = a + 1; b < agentTurns.length; b++) {
      const x = norm(agentTurns[a].text), y = norm(agentTurns[b].text);
      if (x && x === y) {
        add('DUPLICATE_AGENT_MESSAGE', 'warn', agentTurns[b].i,
          'The agent sent an identical message twice.', agentTurns[b].text);
      }
    }
  }

  return out;
}

export const SEVERITY_ORDER = { fail: 0, inconclusive: 1, warn: 2, advisory: 3 };
