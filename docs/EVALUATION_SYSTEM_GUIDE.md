# AI Conversation Quality Evaluation System
## A Guide to the Test-Evaluate-Improve Loop

---

## What This System Is

A conversation quality evaluation system is an automated loop that repeatedly does three things:

1. **Runs** — simulates realistic customer conversations against a live AI system
2. **Evaluates** — scores each conversation against a defined set of quality heuristics using an LLM judge
3. **Improves** — produces actionable instructions for fixing the AI system's prompts or behavior, then reruns

The loop continues until the system meets a defined quality threshold, or until a human decides the remaining failures require manual judgment.

This is not a unit test suite. It is an empirical quality measurement tool. The conversations are non-deterministic; the evaluations are probabilistic; and the goal is not 100% pass rate but meaningful, measurable improvement over time.

---

## Why It Works

### The core insight: LLMs can evaluate LLMs

A capable LLM (GPT-4o, Claude Opus) can assess a conversation transcript for qualities that are easy to define in English but hard to capture in code — things like "the agent repeated itself unnecessarily" or "the confirmation stated the new value but not the old one." This judgment is imperfect, but it is far more scalable than human review of every conversation, and far more expressive than hard-coded assertion logic.

### The second insight: simulated customers are good enough

A second LLM, prompted to play a realistic customer with a specific goal and personality, produces conversations that surface real failure modes. The simulator doesn't need to be perfect. It needs to be representative enough to trigger the behaviors you care about. Scenarios should be designed to probe specific heuristics, not to produce idealized conversations.

### The third insight: the improvement loop closes on prompts, not code

Most conversational AI quality problems are prompt problems — the AI wasn't told to do the right thing, or was told in a way that's exploitable. The loop produces instructions for a human (or another AI) to edit the system prompt and redeploy. The cycle time is a deployment, not a retrain.

---

## System Components

### 1. Heuristics (`QUALITY_HEURISTICS.md`)

A heuristics document defines *what good looks like*. Each heuristic has:
- A name and short code (H1, H2, ...)
- A criterion stated in plain language
- Failure signals — specific examples of what a bad response looks like
- A severity level (Critical, High, Medium, Low)

The heuristics serve two purposes: they guide the evaluator, and they guide the humans writing and fixing prompts. They should be derived from real failure patterns observed in production or testing, not constructed speculatively. Add a heuristic when you have evidence of a recurring failure; not before.

**Design principles for heuristics:**
- State the criterion as an always-applicable rule, not a description of a specific failure instance
- Include failure signals to make the evaluator's job concrete
- Keep the severity level honest — not everything is Critical
- Review heuristics periodically and retire ones that haven't fired in many iterations

See `docs/QUALITY_HEURISTICS.md` for the current heuristic set.

### 2. Scenarios (`scenarios.mjs`)

A scenario defines one test conversation. It has:
- A unique ID (slug)
- A client profile (which test account to use)
- A scope (which AI mode is being tested)
- An opening message (the customer's deterministic first message)
- A customer simulator prompt (guides the LLM playing the customer role)
- A list of heuristics this scenario is designed to probe

Scenarios are the most important design decision in the system. Good scenarios:
- Target specific known failure modes
- Use realistic but varied customer phrasing
- Cover the full range of task types, not just the happy path
- Include some adversarial cases (impatient customers, ambiguous corrections, frustrated replies)

Poor scenarios:
- Always elicit well-behaved, cooperative customers
- Use phrasing that matches the prompt's own examples too closely
- Test the same task repeatedly with only surface variation

**The key principle:** A scenario that always passes is either testing something the system does reliably (good to confirm, retire after a few clean iterations) or testing something too easy to be interesting (redesign it).

### 3. Runner (`runner.mjs`)

The runner simulates each conversation by alternating between two roles:
- **Customer simulator** — an LLM prompted to play the customer, given the opening message and a goal
- **AI system under test** — the actual production API being evaluated

For each turn: send the customer's message to the AI, get a response, pass that response to the customer simulator, get the next customer message, repeat. Continue until the AI system signals completion (e.g., `shouldExitAutopilot=true`) or a maximum turn count is reached.

**Critical:** The runner must reset any shared state between scenarios (e.g., database records) to ensure isolation. A scenario that depends on the previous scenario's data produces unreliable results.

### 4. Evaluator (`evaluator.mjs`)

The evaluator receives a completed conversation transcript and the heuristics document, then produces a score for each applicable heuristic: Pass, Marginal, or Fail — with a brief explanation.

The evaluator is itself an LLM call. It has its own system prompt that:
- Explains the evaluation task
- Provides domain knowledge the evaluator wouldn't otherwise have (e.g., "primary and secondary beneficiary pools are independent; 100% in each is valid")
- Instructs it to cite specific turn numbers and quote text in its explanations
- Tells it when a heuristic is not applicable to a given scenario (mark N/A rather than Pass)

**Critical discipline:** The evaluator will make mistakes. When an evaluator flags something as a failure that is actually correct behavior, fix the evaluator — add the missing domain knowledge to its system prompt. Never fix the AI system's behavior to satisfy a wrong evaluator. That embeds the evaluator's misunderstanding into production.

### 5. Reporter (`reporter.mjs`)

The reporter takes the evaluator's scores and produces two outputs:

**`report-NNN.md`** — a human-readable summary showing:
- Overall score and threshold status
- Per-scenario results with evaluator notes
- A ranked list of the worst-performing heuristics

**`NEXT_FIX.md`** — instructions addressed to whoever is implementing the next change:
- Which heuristic to fix and why
- What the root cause appears to be
- Which specific scenarios are failing and what the evidence says
- A suggested prompt change (kept general — the implementer must apply it correctly)

The reporter's fix guidance is generated from a static dictionary (`FIX_GUIDANCE`) that maps heuristic codes to root-cause descriptions and fix strategies. This dictionary must be kept current: after a fix resolves a heuristic's root cause, update the entry to describe what the *next* failure mode for that heuristic would look like.

### 6. Improvement Loop

The loop ties everything together:

```
Run → Evaluate → Report → Implement fix → Deploy → Repeat
```

Exits when all threshold conditions are met, or when maximum iterations are reached (at which point remaining failures require manual review — they may reflect evaluator limitations, genuinely hard edge cases, or conflicting requirements).

**Threshold design:** Set thresholds that represent meaningful quality, not perfect quality. A 100% pass-rate threshold will never be met (the evaluator is probabilistic, and some scenarios have inherent variability). Tiered thresholds — "zero Critical failures, ≥75% High-severity pass rate, ≥80% overall" — are more useful than a single percentage.

---

## What Makes a Good Heuristic vs a Good Scenario

These are different things and the distinction matters.

| | Heuristic | Scenario |
|---|---|---|
| **What it is** | A quality criterion | A test case |
| **Scope** | Cross-cutting; applies to many conversations | Specific; probes one task/path |
| **Derived from** | Observed failure patterns across multiple conversations | A specific use case or known failure mode |
| **When to add** | When you see a recurring bad behavior that a criterion would catch | When you have a task type or failure mode not covered by existing scenarios |
| **When to retire** | When it hasn't fired in many iterations and the behavior is stable | When the failure mode it was testing no longer exists |

---

## The Prompt Editing Discipline

The improvement loop produces instructions for changing AI system prompts. Applying these changes well is a skill. The core rules:

**Generalize before you write.** Before adding any rule or example to a prompt, ask: "Would this rule apply correctly to a customer with a completely different name, different account values, and a structurally similar but not identical request?" If not, you're responding to the test scenario's surface features rather than the underlying behavior requirement.

**Never use test data in examples.** Examples in prompts are training signal. If an example uses a name or value from the test suite, the model may apply the rule narrowly when it recognizes those specifics and less reliably when it doesn't. Use generic placeholders: `[Person A]`, `[prior value]`, `[X%]`.

**Read the evidence, not just the instructions.** The reporter's fix instructions are generated from a static dictionary and don't update as rules evolve. By iteration 3, the "root cause" description for H2 may already have been addressed and the current failure is something different. Always read the actual evaluator notes and turn excerpts before writing a fix.

**Fix the bot, or fix the evaluator — not both.** When a heuristic fails, determine first whether the bot's behavior was actually wrong. If the evaluator flagged correct behavior as a failure, fix the evaluator. Never modify production behavior to satisfy a wrong evaluator.

**Frame requirements as exit gates.** For any behavior that must happen before the AI moves on, frame it as a blocking condition on the exit signal — not as a vague "before completing, do X" instruction. Vague instructions get skipped under pressure. A gate that says "you MUST NOT proceed until steps 1, 2, and 3 are all complete" is much harder to skip than "remember to check the allocation before confirming."

**One logical change per iteration.** When multiple heuristics are failing, fix the most severe one. If you fix two things at once and the score moves, you won't know which change helped and which may have caused a regression.

See `scripts/quality-loop/PROMPT_EDITING_GUIDE.md` for the full methodology.

---

## Adapting This System to a New Application

The system as built is specific to this codebase's API format, database, and task types. The methodology is general. To adapt it:

**1. Define your heuristics first.** Don't start with scenarios. Think about what good behavior looks like in your domain and write 6–10 heuristics that cover the most important failure modes. Add more as evidence accumulates.

**2. Identify your task taxonomy.** What are the distinct things users ask your system to do? Each major task type should have at least one scenario. Start with the highest-value or highest-risk tasks.

**3. Build the runner for your API.** The runner just needs to be able to send a message to your system and get a response. The turn-alternation logic is the same regardless of the underlying API.

**4. Write a customer simulator prompt per scenario.** The simulator needs: a persona, a goal, a starting context (what does the customer already know?), and behavioral instructions (how patient are they? do they give clear answers or ambiguous ones?). The more realistic the simulator, the more useful the scenario.

**5. Write an evaluator system prompt with your domain knowledge.** The evaluator must know things that aren't obvious from the transcript — your data model, what the system is allowed to do, what counts as a valid state. Add domain facts as you discover the evaluator making mistakes.

**6. Set thresholds based on your risk tolerance.** Critical heuristics (factual accuracy, math integrity) should have zero-failure thresholds. Moderate heuristics can tolerate some failure rate while improvement continues.

**7. Run the loop.** Don't over-engineer the tooling before you have real results. Run a few passes, see where the system is actually failing, then decide what infrastructure to build.

---

## What This System Is Not

- **Not a regression test suite.** Conversations are non-deterministic. A scenario that passed in iteration 3 may fail in iteration 4 due to natural model variance. Use the trend, not individual data points.
- **Not a replacement for production monitoring.** The scenarios are synthetic. Real customers will ask things the scenarios don't cover. The quality loop catches systemic prompt issues; production transcripts catch real-world edge cases.
- **Not a way to achieve perfection.** The evaluator is fallible. The simulator is artificial. Some failure modes will only be discovered in production. The goal is a measurably high-quality baseline with a fast improvement cycle — not a bug-free system.

---

## Quick Reference

| Component | File | Purpose |
|-----------|------|---------|
| Heuristics | `docs/QUALITY_HEURISTICS.md` | Defines what good looks like |
| Scenarios | `scripts/quality-loop/scenarios.mjs` | Test conversations |
| Runner | `scripts/quality-loop/runner.mjs` | Simulates conversations |
| Evaluator | `scripts/quality-loop/evaluator.mjs` | Scores conversations |
| Reporter | `scripts/quality-loop/reporter.mjs` | Produces report + NEXT_FIX |
| Loop | `scripts/quality-loop/improvement-loop.mjs` | Orchestrates run → fix → redeploy |
| Dashboard | `scripts/quality-loop/server.mjs` | Web UI (`localhost:3456`) |
| Prompt editing | `scripts/quality-loop/PROMPT_EDITING_GUIDE.md` | Rules for applying fixes |
