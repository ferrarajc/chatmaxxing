# Quality Evaluation Heuristics — Bob's Mutual Funds AI Systems

Derived from transcript analysis. Apply to customer bot, agent autopilot, and next-best-response conversations.

---

## Source Transcripts (Reference)

### bb736f72 — Robert Martinez, Beneficiary Change (~4.5 min, 20 messages)
Customer asked to copy Roth IRA beneficiaries to SEP-IRA. Bot escalated immediately after hearing the change request, before fully confirming the intent. Agent then asked for allocation percentages the customer had already specified ("same as Roth") and which the agent had access to via tool. Agent produced three mutually inconsistent statements about the math in four turns, ultimately arriving at the correct outcome through a muddled path. Confirmation stated final state only, not what changed.

Key failures: H2, H3, H4, H5, H10, H12, H13.

### 4b56e6e3 — Robert Martinez, Beneficiary Change (~1.5 min, 15 messages)
Customer asked to add Marco and Sofia Martinez as beneficiaries to SEP-IRA alongside Elena. Bot offered self-service link then escalated — inconsistent routing. During collection, bot announced handoff to agent before finishing gathering information, creating a confusing mid-message pivot. Customer said 25% each for Marco and Sofia; nobody noted Elena's allocation would drop from 100% to 50%. Confirmation omitted all allocation percentages. Grammatical error in one bot message.

Key failures: H3, H6, H9, H10, H11.

---

## Heuristics

### H1 — Factual Accuracy
**Criterion:** Every specific client data point stated (balance, account name, beneficiary name, percentage, transaction amount, contact info) must match what the system retrieved via tool call or pre-loaded context.  
**Failure signal:** A stated figure that does not appear in any tool result in the conversation.  
**Severity:** Critical

---

### H2 — Mathematical Integrity
**Criterion:** Any time allocation percentages, totals, or derived figures are discussed, they must be arithmetically correct. When a change affects existing values (e.g., adding a beneficiary reduces an existing one's share), the impact must be explicitly acknowledged and confirmed before execution.  
**Failure signals:**
- Percentages that don't sum to 100% go unaddressed
- Adding Marco and Sofia at 25% each without noting Elena drops from 100% to 50%
- "Sofia and Marco need to sum to 0%" in the same turn Elena is described as being at 60%  
**Severity:** Critical

---

### H3 — Change Transparency (Before → After)
**Criterion:** When a change is confirmed and executed, both the prior state and the new state must be explicitly stated. "Updated to X" is not sufficient — it must be "Changed from Y to X."  
**Failure signals:**
- Confirmation: "Updated beneficiaries on Robert Martinez's SEP-IRA to Elena at 60%..." (no mention of Elena's prior 100%)
- Confirmation: "include Marco and Sofia Martinez" (no allocation percentages at all)  
**Severity:** High

---

### H4 — Information Gathering Efficiency
**Criterion:** The AI must not request information already present in the conversation or retrievable from available tools.  
**Failure signal:** Agent asks "What allocation percentages would you like?" after the customer said "same as the Roth" and the agent has access to Roth beneficiary data.  
**Grading:** Each unnecessary information request = 1 demerit; >2 in a conversation = fail.  
**Severity:** Medium

---

### H5 — Intent Capture Fidelity
**Criterion:** The AI's interpretation of the customer's intent must remain consistent with what the customer actually said, including through corrections and ambiguous statements. The AI must not infer a meaning that contradicts the plain reading of the request.  
**Failure signal:** Customer says "she stays on" (meaning "include her in the updated list") and agent interprets it as "keep her at 100%."  
**Severity:** High

---

### H6 — Handoff Clarity (Bot → Agent Transition)
**Criterion:** The bot must not announce a handoff to a live agent and then continue gathering information as if it is the active conversation handler. The handoff announcement should come only once all information collection is complete. The agent, upon joining, must demonstrate awareness of context already established.  
**Failure signals:**
- "I'll pass those details to a live agent... Please provide the full names, relationships, and allocation percentages..." (handoff announced, then collection continues in the same message)
- Agent joins and re-asks questions already answered in the bot session  
**Severity:** Medium

---

### H7 — Escalation Timing
**Criterion:** The customer-facing bot should escalate after gathering enough context to be useful to the agent, not immediately on first mention of a change request.  
**Grading:**
- Escalated with full confirmed intent = Pass
- Escalated with partial intent (agent must rework collection) = Marginal
- Escalated with no intent captured = Fail  
**Failure signal:** Bot escalates immediately on hearing "I'd like to make them the same" without confirming which accounts or what the target state is.  
**Severity:** Medium

---

### H8 — Role Honesty (Bot Capability Claims)
**Criterion:** The customer-facing bot must never imply it can execute account changes, process transactions, or take actions that require a human agent. It may gather information and confirm intent, but must frame execution as something the agent will do.  
**Failure signals:**
- "We can make those changes for you!"
- "Shall I proceed?"
- "Please hold on while I process this change."  
**Pass examples:**
- "I'll gather those details and pass them to a live agent who will take care of it."
- "Once confirmed, an agent will process this for you."  
**Severity:** High

---

### H9 — Routing Consistency (Self-Service vs. Agent)
**Criterion:** When the bot offers a self-service path for a task, it must not then escalate to a live agent for that same task without explaining why self-service is insufficient.  
**Failure signal:** Bot: "You can add beneficiaries directly at [Beneficiaries] – it only takes a minute." Three turns later: escalates to live agent to add beneficiaries.  
**Severity:** Medium

---

### H10 — Confirmation Completeness
**Criterion:** The post-execution confirmation message must include: (1) what was changed, (2) the final resulting state with all relevant values for all parties, (3) a reference number. It should be complete enough that a customer could read it alone and verify the correct action was taken.  
**Failure signals:**
- Confirmation omits allocation percentages for any party
- No reference number
- Account name not specified  
**Severity:** Medium

---

### H11 — Language Quality
**Criterion:** Bot and agent messages must be free of grammatical errors, typos, and broken syntax. LLM-generated messages have no excuse for consistent errors.  
**Failure signal:** "Please ask provide their relationships to you" (should be "Please provide").  
**Grading:** Each error = 1 demerit; >1 in a conversation = fail.  
**Severity:** Low-Medium

---

### H12 — Turn Economy
**Criterion:** The total number of turns to resolve a request should be proportionate to its complexity.  
**Benchmarks:**
- Simple factual lookup: 2–4 turns
- Single account change with clear parameters: 4–8 turns
- Complex change requiring negotiation: 8–14 turns  
**Failure signal:** 20 turns for "copy Roth beneficiaries to SEP-IRA" — a request stated unambiguously in turn 3.  
**Severity:** Medium

---

### H13 — Internal Consistency
**Criterion:** Within a single conversation, the AI must not contradict itself. Statements about data, math, or customer intent must remain coherent turn to turn.  
**Failure signal:**
- Turn 10: "Adding these totals 100%, which would effectively remove Elena"
- Turn 12: "Sofia and Marco need to sum to 40%"
- Turn 15: "Sofia and Marco need to sum to 0%"
(Three different treatments of the same arithmetic in four turns.)  
**Severity:** High

---

## Scoring Summary Template

| # | Heuristic | Severity | Pass / Marginal / Fail | Notes |
|---|-----------|----------|------------------------|-------|
| H1 | Factual Accuracy | Critical | | |
| H2 | Mathematical Integrity | Critical | | |
| H3 | Change Transparency | High | | |
| H4 | Info Gathering Efficiency | Medium | | |
| H5 | Intent Capture Fidelity | High | | |
| H6 | Handoff Clarity | Medium | | |
| H7 | Escalation Timing | Medium | | |
| H8 | Role Honesty | High | | |
| H9 | Routing Consistency | Medium | | |
| H10 | Confirmation Completeness | Medium | | |
| H11 | Language Quality | Low-Med | | |
| H12 | Turn Economy | Medium | | |
| H13 | Internal Consistency | High | | |

---

## Reference Scores (Source Transcripts)

| # | bb736f72 | 4b56e6e3 |
|---|-----------|-----------|
| H1 | Pass | Pass |
| H2 | Fail | Marginal |
| H3 | Fail | Fail |
| H4 | Fail | Pass |
| H5 | Fail | Pass |
| H6 | Pass | Fail |
| H7 | Marginal | Pass |
| H8 | Pass | Pass |
| H9 | N/A | Fail |
| H10 | Fail | Fail |
| H11 | Pass | Fail |
| H12 | Fail | Pass |
| H13 | Fail | Pass |

---

## Notes on Future Implementation

The natural next step is an automated LLM evaluator that runs after every saved transcript and scores each heuristic, then writes results back to DynamoDB (or CloudWatch). Options:

- **Post-save Lambda trigger:** After `save-transcript` writes to DynamoDB, invoke an `evaluate-transcript` Lambda that runs an LLM pass over the conversation and scores each heuristic. Flags Critical/High failures to a CloudWatch alarm.
- **Batch review:** Nightly scan of all transcripts saved in the last 24 hours; aggregate scores by heuristic to surface trends (e.g., H3 failing 80% of the time = systemic confirmation template problem).
- **Transcript UI integration:** Show the heuristic score card alongside each transcript in the review UI (`/transcripts/index.html`). Color-coded: green/yellow/red per heuristic.
- **Weighting:** Critical heuristics (H1, H2) count double. A conversation with any Critical fail is flagged regardless of overall score.
