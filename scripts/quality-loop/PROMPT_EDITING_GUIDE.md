# Prompt Editing Methodology Guide

Rules for how to apply fixes identified by the quality loop. Failure to follow these produces overfitted, fragile, or incoherent prompt changes.

---

## 1. Generalization Test — Apply Before Every Edit

Before writing a rule or example, ask:

> "Would this rule apply correctly to a customer named Jane Smith, with completely different account values and beneficiary names, requesting something structurally similar but not identical to the test scenario?"

If the answer is no — the rule is responding to the symptom (this customer, this conversation) rather than the underlying behavior requirement. Rewrite it at the principle level.

**Also ask:** "Is this a thing a good human financial services agent would always do, regardless of who the customer is?" If yes, the rule belongs in the prompt. If it's only obviously right because of what the evaluator happened to flag, be skeptical.

---

## 2. Example Hygiene — Never Use Test Data

Examples in prompts are training signal. LLMs pattern-match on them. If an example uses names, values, or phrasing from the test scenarios, the model may apply the rule narrowly when it recognizes those specifics and less reliably when it doesn't.

**Forbidden in examples:**
- Client names from the test suite (Elena, Marco, Sofia, Sarah, Emma, Alex, Robert, Maria, Jordan, Casey)
- Specific emails from test scenarios (alex.johnson@email.com, alexj2025@gmail.com)
- Specific fund names/tickers from test scenarios paired with scenario-matching dollar amounts
- Account IDs from test data (acc-001, acc-401, etc.)

**Use instead:**
- Generic placeholders: `[Beneficiary]`, `[prior value]`, `[new value]`, `[Fund A]`, `[Fund B]`, `[Account Type]`
- Names clearly outside the test set: Alice, Bob, Carol, David (already used in ALLOCATION RULE — fine)
- Structural patterns: `[Person A] at X%`, `[prior frequency]`

**Check:** After writing an example, grep it against `scripts/quality-loop/scenarios.mjs`. If any token matches test scenario data, replace it.

---

## 3. Read the Evidence, Not Just NEXT_FIX.md

The reporter's NEXT_FIX.md instructions are generated from a static dictionary (`FIX_GUIDANCE` in `reporter.mjs`). They describe the root cause as it was understood at iteration 1 and do not update as the rule evolves. By iteration 3, the same H2 instructions may be stale because the rule was already added.

**Always read the actual evidence:**
- How many turns did the scenario run? (2 turns and exits = different problem than 18 turns going in circles)
- What does the evaluator's note say verbatim?
- What is the last agent turn excerpt?

A scenario that failed H2 but ran for 2 turns has a different bug than one that ran for 8 turns and got the math wrong. The same heuristic label does not mean the same root cause.

---

## 4. When to Fix the Bot Prompt vs the Evaluator

**Fix the bot prompt** when the bot's actual behavior in the transcript is wrong — it said something incorrect, skipped a required step, or produced a bad user experience.

**Fix the evaluator** when the evaluator's note describes correct bot behavior as wrong. Signs:
- Evaluator flags a mathematically valid state as a math error (e.g., 100% primary + 100% secondary = "incorrect")
- Evaluator applies a heuristic to a scenario where it's not applicable
- Evaluator note contradicts the scenario's ground truth

When fixing the evaluator, add the domain knowledge to the **system prompt** in `evaluator.mjs`, and if applicable, add an **EVALUATOR NOTE** to the scenario's `notes` field in `scenarios.mjs` so the user message also contains the ground truth.

**Never fix the bot prompt to pass an evaluator that is wrong.** That embeds the evaluator's misunderstanding into production behavior.

---

## 5. Exit Gate Framing

For any behavior that must happen before the bot exits, frame it as a gate on `shouldExitAutopilot=true`, not as a vague "before confirming" rule.

**Weak (exploitable):**
> "Before collecting confirmation of any ADD operation, disclose the percentage impact."

The bot may treat receiving the last piece of data as "collecting confirmation" and skip the step.

**Strong (gates the exit):**
> "You MUST NOT set shouldExitAutopilot=true for any ADD operation until all three steps below are complete: (1) compute, (2) state explicitly, (3) receive affirmative reply."

Frame the acknowledgment as a **required field** — not a courtesy step — so the bot treats its absence the same as a missing name or percentage.

---

## 6. Cross-Cutting vs. Task-Specific Placement

| Scope | Where to add it |
|-------|-----------------|
| Applies to all task experts | Add to `FORBIDDEN_TOPICS` (and `FORBIDDEN_TOPICS_NO_TRADES` for trade tasks) |
| Applies only to beneficiary changes | Add to `UPDATE_BENEFICIARIES_PROMPT` |
| Applies only to the customer-facing bot | Add to `FULL_AUTO_PROMPT` / `CUSTOMER_BOT_PROMPT` |
| Applies to get-intent / field collection | Add to `buildTaskFieldPrompt` or the shared task expert template |

**Warning:** `FORBIDDEN_TOPICS` is injected into all 19 task experts simultaneously. A rule added there will affect every task — including ones it wasn't written for. Verify the rule is truly universal before placing it there.

---

## 7. One Logical Change Per Iteration

When multiple heuristics are failing, it is tempting to fix all of them in one deployment. Resist this unless the fixes are in completely separate parts of the code and cannot interact.

**Why:** If two changes go in together and the score moves, it is ambiguous which change drove the improvement and which may have caused a regression. The feedback loop loses signal.

**Exception:** If Fix A is clearly a prerequisite for Fix B (e.g., H2 must clear before H3 is the primary blocker), they may go together if:
- They touch different rules/sections
- They address different heuristics
- Neither can mask the other's effect

Record the reasoning when bundling.

---

## 8. Updating the Reporter When Instructions Become Stale

The `FIX_GUIDANCE` dictionary in `reporter.mjs` contains static instructions per heuristic. Once a rule is added to the prompt, the instructions for that heuristic should be updated to reflect the current state — otherwise future iterations will generate misleading instructions for a rule that already exists.

After applying a fix that fully resolves a heuristic's root cause, update `FIX_GUIDANCE[heuristic].rootCause` and `.fix` in `reporter.mjs` to describe what the *next* failure mode for that heuristic would look like — not the one that was just fixed.

---

## 9. Evaluator Domain Knowledge

The GPT-4o evaluator has no intrinsic knowledge of this system's data model. Domain facts that are non-obvious must be explicitly added to the evaluator system prompt in `evaluator.mjs`.

Facts already added:
- Beneficiary tier separation (primary and secondary are independent pools; 100% in each tier simultaneously is valid)

Facts to consider adding if new evaluator errors emerge:
- How RMD calculations work (annual amount, taken-so-far, remaining)
- What "auto-invest" fields look like (amount, fund, frequency, day)
- What the bot can and cannot execute (it cannot execute — it hands off to an agent)

**Do not add facts preemptively.** Only add when an evaluator error confirms the gap.
