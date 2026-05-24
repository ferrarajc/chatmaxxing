# Quality Evaluation Heuristics — Bob's Mutual Funds AI Systems

Derived from transcript analysis. Apply to customer bot, agent autopilot, and next-best-response conversations.

---

## Source Transcripts (Reference)

### bb736f72 — Robert Martinez, Beneficiary Change (~4.5 min, 20 messages)
Customer asked to copy Roth IRA beneficiaries to SEP-IRA. Bot escalated immediately after hearing the change request, before fully confirming the intent. Agent then asked for allocation percentages the customer had already specified and which the agent had access to via tool. Agent produced three mutually inconsistent statements about the math in four turns, ultimately arriving at the correct outcome through a muddled path. Confirmation stated final state only, not what changed.

Key failures: H2, H3, H4, H5, H10, H12, H13.

### 4b56e6e3 — Robert Martinez, Beneficiary Change (~1.5 min, 15 messages)
Customer asked to add two new beneficiaries to an IRA alongside an existing one. Bot offered self-service link then escalated — inconsistent routing. During collection, bot announced handoff to agent before finishing gathering information, creating a confusing mid-message pivot. Customer stated percentages for the new beneficiaries; nobody noted the existing beneficiary's allocation would drop as a result. Confirmation omitted all allocation percentages. Grammatical error in one bot message.

Key failures: H3, H6, H9, H10, H11.

---

## Heuristics

### H1 — Factual Accuracy
**Criterion:** Every specific client data point stated (balance, account name, beneficiary name, percentage, transaction amount, contact info) must match what the system retrieved via tool call or pre-loaded context. The AI must not state figures it does not have.  
**Failure signal:** A stated value (dollar amount, percentage, name, ticker) that does not appear in any tool result or pre-loaded profile in the conversation.  
**Severity:** Critical

---

### H2 — Mathematical Integrity
**Criterion:** Any time allocation percentages, totals, or derived figures are discussed, they must be arithmetically correct. When a change affects existing values (e.g., adding a beneficiary reduces an existing one's share), the impact must be explicitly computed, stated, and confirmed before the bot exits.  
**Failure signals:**
- Percentages in the final state that don't sum to 100% go unaddressed
- Adding new beneficiaries at stated percentages without noting that an existing beneficiary's share decreases as a result
- Contradictory arithmetic across turns about the same set of values  
**Severity:** Critical

---

### H3 — Change Transparency (Before → After)
**Criterion:** When a change is confirmed (in the bot's exit response), both the prior state and the new state must be explicitly stated. "Updated to X" is not sufficient — it must be "Changed from Y to X."  
**Failure signals:**
- Confirmation states only the new value: "Updated frequency to Quarterly" (prior frequency not mentioned)
- Confirmation lists the final beneficiaries without stating what they replaced
- Confirmation says "adding [person]" without saying what the account looked like before  
**Severity:** High

---

### H4 — Information Gathering Efficiency
**Criterion:** The AI must not request information already present in the conversation transcript or retrievable from available tools.  
**Failure signal:** Asking a customer for a value that: (a) the customer already stated earlier in the conversation, (b) the system has on file and accessible via tool, or (c) is directly derivable from information already provided.  
**Grading:** Each unnecessary information request = 1 demerit; >2 in a conversation = Fail.  
**Severity:** Medium

---

### H5 — Intent Capture Fidelity
**Criterion:** The AI's interpretation of the customer's intent must remain consistent with what the customer actually said, including through corrections and ambiguous statements. The AI must not infer a meaning that contradicts the plain reading of the request.  
**Failure signal:** Customer makes a statement with a clear plain-language meaning (e.g., "she stays on the account") and the bot interprets it in a way that contradicts that meaning (e.g., treating "stays on" as "keeps her current percentage unchanged" when the customer explicitly said the new people get specific percentages).  
**Severity:** High

---

### H6 — Handoff Clarity (Bot → Agent Transition)
**Criterion:** The bot must not announce a handoff to a live agent and then continue gathering information as if it is the active conversation handler. The handoff announcement should come only once all information collection is complete. The agent, upon joining, must demonstrate awareness of context already established.  
**Failure signals:**
- "I'll pass those details to a live agent... [immediately followed by] Please provide the full names, relationships, and percentages..." (handoff announced, then collection continues)
- Agent joins and re-asks questions already answered in the bot session  
**Note on test coverage:** This heuristic requires a scenario where the bot hands off mid-session to a live agent who then continues the conversation. Current automated tests do not cover this transition — they test the bot and agent phases separately. Mark N/A for scenarios where no handoff occurs.  
**Severity:** Medium

---

### H7 — Escalation Timing
**Criterion:** The customer-facing bot should escalate after gathering enough context to be useful to the agent, not immediately on first mention of a change request.  
**Grading:**
- Escalated with full confirmed intent = Pass
- Escalated with partial intent (agent must rework collection) = Marginal
- Escalated with no intent captured = Fail  
**Failure signal:** Bot escalates immediately on hearing that a change is wanted, before confirming what account, what change, or what the target state is — leaving the agent with a cold handoff.  
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
**Failure signal:** Bot: "You can do this directly at [self-service link]." Then, without the customer declining or explaining a complication, the bot escalates to a live agent for the same task.  
**Severity:** Medium

---

### H10 — Confirmation Completeness
**Criterion:** The bot's exit message (the last message before handing off to the agent) must be a complete summary of the proposed change: (1) what is being changed, (2) the full final state with all relevant values for all parties, and (3) what happens next (e.g., "a live agent will review and process this"). It should be complete enough that a customer could read it alone and verify the correct action will be taken.  
**Failure signals:**
- Exit message says only "Got it — I have everything I need" with no summary of the change
- Exit message omits values for one or more affected parties (e.g., lists new beneficiaries but not retained ones)
- Exit message does not mention the account being changed  
**Note:** Reference numbers are generated by the execution system, not the bot. Do not penalize the bot for lacking a reference number in its pre-execution handoff message. Penalize only if the message is substantively incomplete as a summary of intent.  
**Severity:** Medium

---

### H11 — Language Quality
**Criterion:** Bot and agent messages must be free of grammatical errors, typos, and broken syntax.  
**Failure signal:** Any message containing a grammar error, garbled construction, or apparent autocomplete artifact (e.g., "Please ask provide their relationships to you").  
**Grading:** Each error = 1 demerit; >1 in a conversation = Fail.  
**Severity:** Low-Med

---

### H12 — Turn Economy
**Criterion:** The total number of turns to resolve a request should be proportionate to its complexity.  
**Benchmarks:**
- Simple factual lookup: 2–4 turns
- Single account change with clear parameters: 4–8 turns
- Complex change requiring negotiation (multiple parties, ambiguous intent): 8–14 turns  
**Failure signal:** Turn count significantly exceeds the benchmark for the complexity level, typically caused by repeated re-asking of answered questions, failure to act on already-provided information, or circular clarification loops.  
**Severity:** Medium

---

### H13 — Internal Consistency
**Criterion:** Within a single conversation, the AI must not contradict itself. Statements about data, math, or customer intent must remain coherent across turns.  
**Failure signal:** The AI states a value or interpretation in one turn and contradicts it in a later turn without acknowledging the correction. Examples: computing a total as 100% in one turn and 40% in another; describing a beneficiary as "staying on" then later treating them as removed.  
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
