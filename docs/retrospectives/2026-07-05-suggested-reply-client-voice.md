# Retrospective — Suggested reply written in the client's voice

| | |
|---|---|
| **Date observed** | 2026-07-05 |
| **Area** | Agent desktop → AI "Suggested reply" (Next-Best-Response) |
| **Component** | `lambda/next-best-response/handler.ts` (the `SYSTEM_PROMPT`) |
| **Severity** | Low–medium — quality/trust defect, no data or availability impact; agent-facing only (a human reviews every suggestion before sending) |
| **Status** | Fixed and shipped to production (PR #115, 2026-07-05) |

## Summary

The AI "Suggested reply" shown to a human agent — a draft of what the **agent** should send to the **client** — was occasionally written as if it were the **client** speaking. The trigger was a newly added "auto-refresh on send" behavior that invokes the suggestion engine at a moment its prompt was never designed for (immediately after the agent speaks). The fix was a targeted hardening of the suggestion prompt so it always writes in the agent's voice.

## What we observed

During POAT of the new suggested-reply features, an agent (John Ferrara) sent this message to the client, Alex:

> "Hey Alex, it's John Ferrara from Bob's Mutual Funds. Looks like you're dealing with an overcontribution to your Roth IRA and need some help figuring out what to do next. **Do I have that right?**"

The Suggested reply box then displayed, for the agent to send next:

> "**Yes, that's correct.** To address the overcontribution, we can discuss your options for withdrawing the excess amount or any other steps you may need to take. What would you like to focus on first?"

The defect: **"Yes, that's correct"** is the *client's* line — it answers the agent's own "Do I have that right?" as though the AI had stepped into Alex's shoes. A suggested reply must always be phrased as the agent speaking *to* the client; it should never adopt the client's voice or answer the agent's own question.

## Root cause

The Next-Best-Response (NBR) engine is prompted to "suggest the reply the agent should send next." That instruction carries an **implicit assumption**: that the most recent message in the transcript is from the *client*, so the model is drafting the agent's reply *to that client message*. Under that assumption the model reliably writes in the agent's voice.

Earlier in the same work, we added **auto-refresh on send**: when the agent sends a message, the suggestion is immediately regenerated, because the previously shown suggestion is now stale. This fires the NBR request with a transcript whose **last line is the agent's own message** — the exact case the prompt's implicit assumption did not cover.

With the agent's question ("Do I have that right?") sitting as the final transcript line, the model treated it as a message to respond to and "answered" it — sliding into the client's perspective ("Yes, that's correct") before continuing as the agent. The prompt contained no explicit guardrail against writing in the client's voice, and no guidance for the "agent spoke last, awaiting the client" state.

**In short:** a pre-existing prompt-robustness gap that was harmless under the old invocation timing (always after a client message) became visible once a new feature began invoking the engine right after the agent speaks.

## How it was diagnosed

1. **Report + artifact.** The issue was reported with a screenshot showing the suggested reply ("Yes, that's correct…") directly following the agent's own question.
2. **Temporal signature.** The tell was that the suggestion had been generated against a transcript **ending on the agent's message**, with no client reply after it. That state only arises from the just-added auto-refresh-on-send path — which immediately implicated the new feature as the *trigger* (not the cause).
3. **Data-flow trace.** Followed the path: agent send → `runNbrRefresh` → `POST /next-best-response` (default "suggest" mode) → `SYSTEM_PROMPT`. Reading the prompt confirmed it said "suggest the reply the agent should send next" but never (a) forbade the client's voice or (b) handled a transcript whose last speaker is the agent.
4. **Conclusion.** The bug was in the prompt's assumptions, exposed by the new timing — not in the refresh feature's mechanics.

## What was changed

A single, targeted change to the NBR `SYSTEM_PROMPT` in `lambda/next-best-response/handler.ts`. It is additive guidance that leaves the normal case (client spoke last) unchanged.

**Before:**
> Suggest ONE concise, professional reply the agent should send next (1-2 sentences max). Do not include greetings or sign-offs.

**After:**
> Draft ONE concise, professional message the AGENT should send next to *{firstName}* (1-2 sentences max), written AS THE AGENT (a Bob's representative) speaking TO *{firstName}*. NEVER write in the client's voice or answer the agent's own question on the client's behalf (e.g. do NOT begin with "Yes, that's correct"). If the most recent message is already from the AGENT — they are simply awaiting *{firstName}*'s reply — draft a brief, natural follow-up the agent could add proactively; do NOT pretend *{firstName}* has answered. Do not include greetings or sign-offs.

Three deliberate additions:
- **Explicit voice/role constraint** — always the agent, never the client, never answering the agent's own question (with the observed failure phrase as a named anti-example).
- **Handling for "agent spoke last"** — when awaiting the client, produce a proactive agent follow-up rather than a fabricated client answer.
- **Personalization** — address the client by first name (a smaller consistency improvement carried in the same edit).

Because it hardens the shared suggest prompt, the fix benefits *every* suggestion path, not only the refresh-on-send one.

## How it was tested

1. **Deployed to the dev environment** via the guarded deploy (`npm run deploy:dev`).
2. **Reproduced the failing scenario** against the dev API: a transcript ending with the agent's "Do I have that right?" question. The suggestion was now correctly in the agent's voice:
   > "If you could provide a bit more detail about your situation, I can assist you better with the next steps regarding your Roth IRA overcontribution."
   No client-voice phrasing; a reasonable agent follow-up while awaiting the client.
3. **Regression check on the normal case** (client asks about fees, last line is the client's): still produced a proper agent reply — confirming the change did not disturb the primary flow.
4. Re-POATed in the live agent UI, then shipped to production in **PR #115**.

## Outcome

The suggested reply no longer speaks in the client's voice. The core suggestion prompt is now explicit about role and voice and is robust to the "agent spoke last" state that the auto-refresh-on-send feature made routine. Fixed on dev and shipped to prod on 2026-07-05.

## Lessons & follow-ups

- **A prompt encodes assumptions about *when* it runs.** Introducing a feature that changes the invocation context (here: invoking the suggester right after the agent speaks) can break assumptions a prompt silently relied on. When adding a new call site for an existing LLM, re-validate the prompt against the new context.
- **State role and voice explicitly.** "Write the agent's reply" is not the same as "write only ever in the agent's voice, never the client's." Small, explicit guardrails (plus a named anti-example drawn from the real failure) are cheap insurance against perspective drift.
- **Watch the awaiting-client suggestion for tone.** After a send, the engine now offers a *proactive follow-up* (the best it can do before the client responds). That is correct-voiced but could feel eager; worth monitoring in real use, and easy to soften or suppress if it reads as pushy.
