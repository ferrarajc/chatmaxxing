# task-sim

Simulate one task expert end to end, ten times, against **dev** — then read the whole
transcript with the problems marked inline.

**It reports. It never fixes.** Nothing here writes to source, and no LLM is ever asked
for a code change. Every recommended fix in the report is hand-written and marked as a
suggestion for a human to accept or reject.

```
node scripts/task-sim/run.mjs --list          # derivability for every task — free, offline
node scripts/task-sim/run.mjs place-sale      # 10 simulations, submits, full report
node scripts/task-sim/run.mjs place-sale --dry   # 1 sim, no submit, no reseed
```

Requires `OPENAI_API_KEY` — it pays for the simulated customer (`gpt-4o-mini`) and the
advisory judge. The expert turns themselves bill through the Lambda's own key.

## Why it exists

Every significant bug fixed in the buy/sell experts during August 2026 was found by a
human reading a transcript, not by a test. The suite that existed passed throughout, and
could not have caught them: it asserted only that fields were non-empty (the string
`"TBD"` would have passed ~40 of its ~55 checks), it discarded the transcript it built,
and not one of its 19 harnesses ever called `/execute-task` — so the entire write path,
where an $800 purchase silently vanished, was untested end to end.

This automates the reading.

## What a run does

For each of 10 simulations: reseed dev → derive a satisfiable goal from the task registry
and the client's real data → hold a conversation with a simulated customer → submit →
snapshot the ledger before and after → check that what moved is what was promised.

Then one advisory pass per transcript, then `report.html` + `run.json` in `runs/`.

## Design commitments

**Generic over the registry.** A new task in `lambda/shared/tasks.ts` is testable with no
new test code, provided its fields are shapes the deriver understands. `--list` tells you,
for free, before you spend anything. Only what genuinely cannot be inferred gets an entry
in `src/goal-overrides.mjs` — currently five, all data.

**Assertions import production rules.** `src/facts.mjs` is the only boundary; nothing is
re-implemented. An assertion cannot drift from shipped behaviour because it *is* shipped
behaviour. (The suite this replaced hand-copied a `reason` assertion and went red when the
field was correctly deleted.)

**Ground truth.** The goal is generated, so we know what the client asked for and can
check the expert collected the right *values*, not merely something.

**Only what the client saw.** Detectors and the judge read the client view alone. Agent-
only material — SYSTEM markers, `exitMessage`, the Lambda's `res.message`, the proposed-
action card — is captured for the report but never judged. A problem the client cannot
see is not a user problem.

**The judge is advisory, structurally.** Deterministic assertions alone decide pass/fail.
The judge gets a closed code enum, and any note mentioning a file, a prompt, a line number
or an edit is dropped in code. A code suggestion physically cannot reach the report. This
is not squeamishness: the system this repo already shelved coupled an LLM judge to
automatic prompt edits, and each fix regressed what the last one passed until the whole
run was rolled back.

**Dev only, with no override.** The tool submits and reseeds. The default is dev,
hardcoded; `LAMBDA_URL` is deliberately not read (that env var defaulting to prod is
exactly how the old harnesses ended up aimed at production); the prod host is blocklisted.
Before simulation 1 it reseeds and verifies a known seed value, so "pointed at a stack I
don't understand" fails before a token is spent.

**Rate limiting is infrastructure, not a defect.** `autopilot-turn` catches a 429 and
returns HTTP 200 with a holding reply, so an un-paced run quietly produces transcripts of
an agent going vague and reports them as product failures. Runs are serial and paced; a
holding reply marks the simulation `INCONCLUSIVE`, never `FAIL`.

## Not problems — read before adding a detector

- **An unprompted cross-sell is a feature.** The expert offering a related service after
  completing a task, and the chat then running a second task, is the product working.
- A recap that restates answered fields is legitimate.
- A multi-task chat is valid; the `[TASK:]` marker is last-wins for exactly that.

A naive off-list-question or turn-count rule fires on all three. The turn budget is
therefore measured to the proposed action, not to the end of the chat.

## Cost and time

Roughly **$2 a run**, dominated by the expert turns (~80 `gpt-4o` calls billed through the
Lambda). Your own key pays about **$0.19** of that. Wall clock is bounded by the 30k TPM
ceiling: **25–40 minutes**.

## Layout

```
run.mjs              CLI
src/facts.mjs        the only import boundary into lambda/ — production rules, imported
src/goal.mjs         derive a satisfiable, varied ask for any task
src/goal-overrides.mjs   the five things generic derivation can't infer
src/customer.mjs     the simulated client — cooperative, varied in ask and phrasing
src/sim.mjs          one simulation: the turn loop, the client/agent split, the submit
src/ledger.mjs       snapshot, diff, per-task expectation, summary-vs-ledger
src/assert.mjs       ground-truth assertions (these decide pass/fail)
src/detect.mjs       deterministic detectors → inline annotations
src/judge.mjs        the advisory pass, with its contract enforced in code
src/fixes.mjs        static, human-written recommendations
src/report.mjs       run.json → self-contained HTML
src/pace.mjs         rolling-window TPM limiter
runs/                output (gitignored)
```

Tests: `test-goal.mjs`, `test-detect.mjs`, `test-report.mjs` — all offline, all free.
