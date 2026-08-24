// ── Recommended fixes: STATIC, human-written ─────────────────────────────────
//
// No LLM writes a recommendation. Ever.
//
// The tool's contract with the user is that it reports and he decides. A model-authored
// "recommended fix" is one short step from a model-applied one, and that step is exactly
// what got the previous system shelved. So each entry below was written by a person who
// understood the bug, and the report renders it verbatim.
//
// Adding a detector means adding an entry here. If you cannot say plainly what a finding
// means and where to look, the detector is not ready to ship.

export const FIXES = {
  INTERNAL_STATUS_LEAK: {
    means: 'Agent-facing status reached the customer. `response` goes verbatim to the client; `exitMessage` is for the agent. They were mixed.',
    where: 'lambda/autopilot-turn/handler.ts → EXIT_MESSAGE_INSTRUCTION; lambda/shared/reply-hygiene.ts',
    fix: 'The shipped strip caught it here, which means the upstream pattern missed a new phrasing. Add that phrasing to INTERNAL_STATUS_RE and re-read the EXIT MESSAGE RULE to see why the model reached for it.',
  },
  CASH_MISSTATED: {
    means: 'A real figure was described as the wrong thing — typically the account TOTAL presented as available cash.',
    where: 'lambda/shared/client-tools.ts → get_accounts; lambda/shared/types.ts → summarizeAccounts',
    fix: 'Check that every figure the model is handed carries a noun. The containment relation (total = invested + cash) must be stated as an equation, not implied by adjacency.',
  },
  UNGROUNDED_FIGURE: {
    means: 'The agent stated a money figure that matches nothing in the client record and nothing the client said.',
    where: 'lambda/autopilot-turn/handler.ts → HALLUCINATION_PROTECTION_RULE',
    fix: 'Confirm the expert called a tool for this number. It may be legitimate arithmetic — read the turn before treating it as invention.',
  },
  OFFERED_UNHELD_FUND: {
    means: 'The client was offered funds they do not own, for a task that can only act on what they hold.',
    where: 'lambda/autopilot-turn/handler.ts → PLACE_SALE_PROMPT / EXCHANGE_FUNDS_PROMPT',
    fix: 'These prompts take real positions via fetchHoldings(). Check the holdings reached the prompt and that FUND_PICKLIST has not crept back into the source-fund section.',
  },
  INVENTED_PAST_TENSE: {
    means: 'A non-word ("Selled", "Withdrawed") reached the client — something is conjugating a verb.',
    where: 'agent-app/src/utils/submitProposedAction.ts; the summary templates in autopilot-turn',
    fix: 'Summaries are noun phrases precisely so nothing needs conjugating. Find what reintroduced a verb-leading summary or a tense transform.',
  },
  EMPTY_CLIENT_TURN: {
    means: 'The client received an empty chat bubble.',
    where: 'lambda/autopilot-turn/handler.ts → the task-expert parse sites',
    fix: 'Both parse sites fall back to a neutral line when the response is empty. Check that fallback is still unconditional.',
  },
  ASKED_BANNED_DETAIL: {
    means: 'The expert asked for something the prompts explicitly forbid (SSN, date of birth, and similar).',
    where: 'lambda/autopilot-turn/handler.ts → buildTaskFieldPrompt STRICT FIELD LIST',
    fix: 'Serious. The field list is meant to be closed — work out how the model got permission to go outside it.',
  },
  REASKED_ANSWERED_FIELD: {
    means: 'The client was asked for something they had already given.',
    where: 'lambda/autopilot-turn/handler.ts → TASK_FIELD_RULES ("DON\'T RE-ASK WHAT YOU ALREADY KNOW")',
    fix: 'Read the turn first — a recap is legitimate and is meant to be exempt. If it is a genuine re-ask, the transcript-reading rule is not landing.',
  },
  SUCCESS_BUT_NOTHING_WROTE: {
    means: 'execute-task returned success with a reference number and the client record did not change. The customer was told something happened that did not.',
    where: 'lambda/execute-task/handler.ts',
    fix: 'The worst class in the system — this is how an $800 purchase vanished. Look for a value that failed to resolve (an account, a fund) and a code path that carried on regardless.',
  },
  SUMMARY_LEDGER_DISAGREEMENT: {
    means: 'The confirmation sent to the client states a different figure from the one the ledger actually moved.',
    where: 'agent-app/src/utils/submitProposedAction.ts',
    fix: 'The client is sent the LLM\'s summary; the Lambda\'s own res.message never reaches them. Nothing in production compares the two, so this check is the only guard.',
  },
  BALANCE_IDENTITY_BROKEN: {
    means: 'After the write, an account no longer satisfies balance = cash + holdings.',
    where: 'lambda/shared/account-math.ts; the mutating cases in lambda/execute-task/handler.ts',
    fix: 'Some path did its own arithmetic instead of calling recomputeAccounts(). Find the assignment to `balance`.',
  },
  EXITED_WITHOUT_ACTION: {
    means: 'The expert handed back to a human without producing anything to submit.',
    where: 'lambda/autopilot-turn/handler.ts → the Phase 2 exit guard',
    fix: 'Check whether a guard fired (advice, escalation, callback intent) and whether it was justified for this message.',
  },
  ROUTING_MISS: {
    means: 'The intent classifier sent this opener to a different expert.',
    where: 'lambda/shared/tasks.ts → the task\'s `keywords`',
    fix: 'Judgement call: either the opener is unusual phrasing worth adding to keywords, or another task is over-matching it.',
  },
  DUPLICATE_AGENT_MESSAGE: {
    means: 'The agent sent the same message twice.',
    where: 'agent-app/src/components/ChatColumn.tsx → the send-generation guard',
    fix: 'Usually a turn fired twice. Check autopilotGenRef and the retry path.',
  },
  TURN_BLOWOUT: {
    means: 'The expert took noticeably more turns than it had fields to collect.',
    where: 'lambda/autopilot-turn/handler.ts → the task prompt',
    fix: 'Read the transcript before acting — grouping related fields is allowed, and a cross-sell legitimately extends a chat. Only the turns up to the proposed action are counted.',
  },
  HOLDING_REPLY: {
    means: 'INFRASTRUCTURE, not product. The expert\'s LLM call failed (almost always a 429) and the handler returned its holding reply with HTTP 200.',
    where: 'not a code defect',
    fix: 'This simulation proves nothing and is excluded from the verdict. Re-run with a lower --tpm.',
  },
};

export function fixFor(code) {
  return FIXES[code] ?? {
    means: 'No catalogue entry for this code yet.',
    where: 'scripts/task-sim/src/fixes.mjs',
    fix: 'Add an entry so this finding explains itself next time.',
  };
}
