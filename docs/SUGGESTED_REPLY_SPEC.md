# Suggested Reply — Implementation Specification

**Audience:** an engineering team recreating this feature from scratch, with no access to the original codebase.
**Scope:** the agent-facing "Suggested Reply" panel, plus its two refinement affordances — **Change to…** and **🪄 Magic** — and the telemetry that measures them.
**Status:** describes the production behavior as shipped.

This document is deliberately detailed. Where a design choice is non-obvious, there is a **Why** note. Where a component exists to serve a specific goal, that goal is stated. You should be able to rebuild an equivalent system, on any comparable stack, from this document alone.

---

## 1. Purpose and goals

The product is a live chat platform for a financial-services contact center. A human **agent** handles up to four concurrent customer chats. Alongside each chat, an AI panel proposes the **next message the agent should send** — the *Suggested Reply*. The agent can send it as-is, edit it, refine it, or ignore it and type their own.

Design goals, in priority order:

1. **Always have a high-quality next message ready.** The agent should rarely start from a blank box. The suggestion must be *substantive* and *sendable*, not a vague placeholder.
2. **Keep the agent in control.** The AI proposes; the human disposes. Every suggestion is editable in place, and nothing is ever sent without an explicit agent action.
3. **Cheap refinement without retyping.** When the suggestion is *close but wrong*, the agent should be able to redirect it (**Change to…**) or restyle it (**🪄 Magic**) in one click, rather than rewriting.
4. **Accuracy and compliance.** The assistant must never invent client-specific figures and must route regulated topics (trades, personalized investment advice) to a licensed human.
5. **Measurability.** Every message the agent sends is logged with its provenance, so suggestion quality can be studied and improved over time.

**Why a human-in-the-loop suggestion instead of an autoresponder:** the domain is regulated and high-stakes; a wrong answer about a retirement account has real consequences. The suggestion model optimizes agent *speed and consistency* while preserving human judgment and accountability. (A separate, fully-autonomous "autopilot" mode also exists and reuses much of this machinery, but it is out of scope here except where noted.)

---

## 2. Architecture at a glance

```
┌─────────────────────────────────────────────┐         ┌──────────────────────────────┐
│  Agent SPA (React + Zustand)                 │         │  next-best-response (Lambda) │
│                                              │  HTTPS  │                              │
│  ChatColumn  ──── triggers ────►  runNbr…    │────────►│  POST /next-best-response    │
│  AISupport   ──── renders  ────►  Suggested  │  JSON   │   mode: suggest              │
│              ├─ Change to… (ChangeToMenu)    │◄────────│         change-options       │
│              └─ 🪄 Magic    (MagicMenu)       │         │         change-reply         │
│  agentStore  ──── holds ───────►  history[]  │         │         magic-rewrite        │
│                                              │         │            │                 │
│  replyLog    ──── fire&forget ─► /log-reply  │         │            ▼                 │
└─────────────────────────────────────────────┘         │  OpenAI gpt-4o-mini          │
                                                         │  + client-data "tools"       │
                                                         └──────────────────────────────┘
```

**Stack specifics as built** (substitute equivalents freely):

| Concern | Choice | Notes |
|---|---|---|
| Frontend | React + [Zustand](https://github.com/pmndrs/zustand) store | Single global store; one `ContactSlot` per concurrent chat. |
| Transport | HTTP API (API Gateway v2) → Lambda (Node 20) | One Lambda, four `mode`s. |
| LLM | OpenAI **`gpt-4o-mini`** | Chosen for cost; this path is latency-sensitive and runs on every turn. Temperature **0.3**. |
| Tool calling | OpenAI function-calling, max **3** iterations | Lets the model pull live client data mid-generation. |
| Telemetry | DynamoDB table `bobs-reply-events`, via `/log-reply` Lambda | Append-only; fire-and-forget from the client. |

**Why one Lambda with a `mode` switch instead of four endpoints:** all four modes share the same profile hydration, the same knowledge-base index, the same tool executor, and the same JSON-parsing/guardrail helpers. Splitting them would duplicate that scaffolding and the deploy surface for no benefit. The `mode` field defaults to `'suggest'`, so the primary path needs no extra parameter.

---

## 3. Core data model

### 3.1 `Suggestion` (one entry in the per-chat history)

Every suggested reply the system ever produces for a chat is retained as an immutable-ish record in an ordered history (see §5.3). This is the atomic unit.

```ts
interface Suggestion {
  id: string;              // stable unique id (used to attach async data + re-find after paging)
  text: string;            // CURRENT text shown in the box (may have been edited by the agent)
  originalText: string;    // the text as first authored by the AI (for edit-detection in telemetry)
  source: 'greeting' | 'nbr' | 'change-to' | 'magic';  // how this entry was produced
  changeDirection?: string;  // present iff source === 'change-to' — the direction the agent picked
  magicStyle?: string;       // present iff source === 'magic' — the restyle chosen
  changeOptions: string[] | null;   // cached "Change to" directions for THIS entry; null = not yet generated
  changeOptionsLoading: boolean;    // true while those options are being generated
}
```

**Why `text` vs `originalText`:** the box is directly editable. We keep the AI's original wording so telemetry can report whether the agent trusted the suggestion verbatim, tweaked it, or replaced it. `wasEdited = (text !== originalText)`.

**Why `changeOptions` is stored per-entry and can be `null`:** the "Change to" directions are *specific to the suggestion on screen* (they are alternative ways to handle *this* draft). They are generated lazily and asynchronously after the suggestion appears (see §6.3), so each entry carries its own cache and its own loading flag.

### 3.2 Suggestion-related fields on `ContactSlot`

A `ContactSlot` is the full per-chat state object (one per concurrent conversation). The fields relevant to Suggested Reply:

```ts
interface ContactSlot {
  // … identity, messages[], autopilot fields, etc. …

  suggestionHistory: Suggestion[];   // every suggestion this chat, in order
  suggestionIndex: number;           // index of the entry currently displayed
  suggestionAutoAdvance: boolean;    // if true, a newly-arrived suggestion snaps the view to newest
  suggestionLoading: boolean;        // a /next-best-response fetch is in flight (drives header spinner)
  suggestionNewBadge: boolean;       // a newer suggestion arrived while the agent was paged back
  suggestedText: string;             // MIRROR of suggestionHistory[suggestionIndex].text (see Why)
  suggestedResources: Resource[];    // 0–3 KB links relevant to the conversation
  suggestedScope: AutopilotScope | null; // AI-suggested autopilot scope (side output; see §8)

  messages: ChatMessage[];           // full transcript: { role: 'CUSTOMER'|'AGENT'|'BOT'|'SYSTEM', content, … }
  lastCustomerMessageAt: number | null;  // timestamp; drives the refresh trigger (§5.2)
  clientId: string;
  clientName: string;
}
```

**Why `suggestedText` duplicates `suggestionHistory[suggestionIndex].text`:** the history + pagination model was added after other parts of the app (autopilot, an alternate "focusing" desktop layout, the insert flow) were already reading a single flat `suggestedText`. Rather than refactor every consumer, the store keeps `suggestedText` as a mirror that every suggestion-mutating action updates in lockstep. New implementations can skip the mirror and read `history[index].text` directly — just be consistent.

### 3.3 Telemetry record (`bobs-reply-events`)

```
PK  contactId            (string)
SK  eventSort            (string)  = `${ISO-8601 timestamp}#${random}`   // sortable + unique
    createdAt, createdAtIso
    clientId, agentUsername, agentName
    path        : 'suggested-send' | 'composer-send' | 'autopilot-send'
    source      : 'greeting' | 'nbr' | 'change-to' | 'magic' | null
    changeDirection, magicStyle : string | null
    originalText          : the AI-authored text (null for pure freehand)
    suggestionShownText   : for a freehand composer send, the suggestion that was on screen but ignored
    sentText              : what actually went to the customer
    wasEdited             : boolean | null
```

Append-only, `RETAIN` on delete. See §9.

---

## 4. The backend Lambda (`next-best-response`)

### 4.1 Endpoint contract

`POST /next-best-response`, body is JSON:

```ts
{
  mode?: 'suggest' | 'change-options' | 'change-reply' | 'magic-rewrite';  // default 'suggest'
  transcript: ChatMessage[];          // REQUIRED; { role, content }[]  (400 if empty/missing)
  clientProfile: ClientProfile;       // client identity + accounts; falls back to a demo profile if absent
  currentSuggestion?: string;         // the on-screen draft (change-options, change-reply, magic-rewrite)
  direction?: string;                 // the chosen direction (change-reply)
  style?: string;                     // the chosen restyle (magic-rewrite)
}
```

Responses (HTTP 200 with a JSON body; note **each mode returns a different shape**):

| mode | response body |
|---|---|
| `suggest` (default) | `{ suggestedText, resources: Resource[], suggestedScope, toolsUsed: string[] }` |
| `change-options` | `{ options: string[] }` |
| `change-reply` | `{ suggestedText, resources: Resource[] }` |
| `magic-rewrite` | `{ suggestedText }` |

`Resource = { id: string; title: string; url: string }`.

**Why the whole transcript and profile are sent on every call (stateless server):** the Lambda holds no session state. The client owns the conversation and passes it in full each time. This keeps the Lambda trivially horizontally scalable and lets the *same* endpoint serve the live grid, the alternate desktop, autopilot, and offline tests with no session store. The transcript is small (a chat), so the payload cost is negligible.

### 4.2 Profile hydration and the knowledge-base index

At the top of the handler:

- If `clientProfile` is missing, substitute a hardcoded demo profile. **Why:** lets the endpoint be exercised in isolation (tests, curl) without a real client record.
- Build `kbIndex: Map<id, Resource>` from the static `KNOWLEDGE_BASE`. Also precompute `RESOURCE_LIST` — a newline-joined `"<id>: <title>"` listing injected into the prompts so the model can only ever cite real article ids.

`ClientProfile` shape (only what the prompts use):
```ts
{ clientId, name, accounts: { type, balance, id }[], totalBalance, … }
```
`summarizeAccounts(accounts)` → e.g. `"Roth IRA: $45,230, Traditional IRA: $128,450"`. This one line of account context is injected into the header of every generation prompt. **Why so little profile in the prompt:** everything else (holdings, transactions, beneficiaries, balances) is available *on demand* through tools (§4.4), so the base prompt stays small and cheap, and the model pulls only what a given conversation needs.

### 4.3 The tool-calling wrapper (`invokeWithTools`)

Both substantive generation modes (`suggest`, `change-reply`) call a shared helper with this contract:

```
invokeWithTools(systemPrompt, messages, tools, toolExecutor, maxTokens, ctx, jsonMode) → { text, toolsUsed }
```

Behavior:

1. **Phase 1 — tool loop (≤ 3 iterations).** Call the model with `tools` and `tool_choice: 'auto'`, *without* a JSON response format (OpenAI disallows `response_format` together with tools). If the model requests tool calls, execute them **in parallel**, append the results as `tool` messages, and loop. Each executed tool name is recorded in `toolsUsed`.
2. **Phase 2 — final formatting call.** Once the model stops requesting tools (or the iteration cap is hit), make one final call **with** `response_format: { type: 'json_object' }` when `jsonMode` is true, to coerce a clean JSON object.
   - Edge case: if the model produced a prose answer on the *first* call and called *no* tools, that prose is pushed into the message list before the Phase-2 call so the reformat has something to structure. **Why:** with tools present, `gpt-4o-mini` intermittently ignores a "return only JSON" instruction; the dedicated no-tools JSON call reliably fixes the shape.
3. Safety net: if the loop hit max iterations with no content at all, return `{ text: '', toolsUsed: [] }`.

`temperature: 0.3` throughout — low, because we want stable, on-policy phrasing rather than creativity.

### 4.4 Tools (live client-data access)

The model is given ~10 read-only functions, each taking no arguments and returning a capped (≤ ~2000 char) text blob:

`get_contact_info`, `get_accounts`, `get_balance_history`, `get_holdings`, `get_transactions`, `get_beneficiaries`, `get_auto_invest`, `get_rmd`, `get_chat_history`, `get_funds`.

The **tool executor** is created per-request bound to `clientProfile.clientId`; it reads from the client database and the fund catalog. Tools are the *only* sanctioned source of client-specific numbers.

**Why tools instead of stuffing all data into the prompt:** (a) cost — most turns need none of it; (b) freshness — a tool reads current data at generation time; (c) safety — see the hallucination rule below, which is only credible *because* a real data path exists.

### 4.5 Cross-cutting guardrails

**Hallucination rule** (appended to every generation prompt):

> CRITICAL DATA RULE: You only know what is in this system prompt or what a tool returned. Never state specific financial figures (balances, holdings, transaction amounts, phone numbers, email addresses, or any client-specific numbers) that were not provided. Call the appropriate tool if you need that data.

**Why:** an LLM will happily fabricate a plausible balance. In this domain that is unacceptable. The rule + the tool path together mean "if you want a number, you must fetch it."

**Deterministic advice/trade → callback (suggest mode only).** After the model returns, regex-scan the **last customer message**. If it matches an advice pattern (`ADVICE_RE`) or a trade pattern (`TRADE_RE`), *force* `suggestedScope = 'callback'` regardless of what the model said.

**Why deterministic and not left to the model:** routing regulated requests to a licensed human is a compliance requirement, not a judgment call. A regex backstop guarantees it even if the model misclassifies. (The patterns catch "should I buy/sell", "best fund", "what should I do with…", "financial advice", "buy/sell/redeem/liquidate", etc.)

### 4.6 Fallbacks

Every mode is wrapped so a failure degrades gracefully rather than 500-ing the UI:

- `suggest`: on LLM error, return a safe generic holding line (`"I'd be happy to help with that. Could you give me a moment to look into it?"`) plus resources matched by a **keyword** fallback (`matchResources`, which scores KB tags against the conversation text).
- `change-options`: on any error, return `{ options: [] }` → the menu shows "No alternatives available."
- `change-reply`: on error, `{ suggestedText: '', resources: [] }` → the client simply doesn't append an entry.
- `magic-rewrite`: on error (or empty input), return the **original** text unchanged.

**Why never throw to the UI:** the suggestion is an assist, not a blocker. A failed suggestion must never break the agent's ability to keep chatting.

---

## 5. The base Suggested-Reply flow (`mode: 'suggest'`)

### 5.1 The prompt (verbatim)

Interpolations: `${name}` = full client name, `${firstName}` = first token of the name (or `"the client"`), `${summarizeAccounts(...)}` = the one-line account summary, `${RESOURCE_LIST}` = the id: title article listing.

```
You are an AI assistant supporting a live chat agent at Bob's Mutual Funds.
The client is ${name}. Their accounts: ${summarizeAccounts}.

Draft ONE concise, professional message the AGENT should send next to ${firstName}. Keep it SHORT —
1-2 sentences (a 3rd only if genuinely necessary). Be substantive but say it briefly: lead with the
single most useful point, not an exhaustive rundown. Write it AS THE AGENT (a Bob's representative)
speaking TO ${firstName}. NEVER write in the client's voice or answer the agent's own question on the
client's behalf (e.g. do NOT begin with "Yes, that's correct"). Do not include greetings or sign-offs.

HARD RULE — never send an empty placeholder whose only substance is an offer to help more, e.g.
"let me know if you have any questions", "feel free to ask", "is there anything else I can help
with?". These add nothing and are NOT acceptable as the suggestion. Every suggestion must carry
concrete substance.

If the most recent message is already from the AGENT (they are awaiting ${firstName}'s reply), OR
${firstName} has just been fully answered and the topic seems settled, do NOT stall — MOVE THE
CONVERSATION FORWARD in a sentence or two: surface the single most useful RELATED point, raise the
natural next decision ${firstName} is likely facing, ask a genuinely useful clarifying question, or
suggest a concrete next step. For example, after fully explaining a topic, briefly offer the natural
next step or one relevant related consideration — never merely ask whether they have more questions.
Do not pad it out, and do not pretend ${firstName} has answered.

Also suggest an autopilot scope if the conversation calls for one:
- "get-intent": the customer's need is not yet clearly defined
- "researching": the agent has indicated they need time to look into something
- "callback": topic requires phone escalation (trades, financial advice, complex account changes)
- "idle-check": the customer has not responded in a while
- "full-auto": the conversation is simple and AI could handle it end-to-end
- null: no autopilot scope is needed right now

Also select the 0–3 most relevant knowledge base articles for this conversation, ordered by relevance (most relevant first). Only include articles that are genuinely on-topic — return an empty array if nothing fits well.

Available articles:
${RESOURCE_LIST}

Return ONLY valid JSON: {"suggestedText": "...", "suggestedScope": "get-intent" | "researching" | "callback" | "idle-check" | "full-auto" | null, "resourceIds": ["kb-xxx", ...]}
```

The user message passed alongside is the transcript, flattened as `"<ROLE>: <content>"` lines joined by newlines (`formatTranscriptForBedrock`).

**Why the "HARD RULE" and the "MOVE THE CONVERSATION FORWARD" paragraph exist (the most important design lesson here):** the earlier version of this prompt said only *"1-2 sentences max"* and *"if the agent spoke last, draft a brief natural follow-up."* On any turn where the agent had just fully answered the customer, `gpt-4o-mini` treated *"let me know if you have any questions"* as the correct natural move and produced content-free filler. Two changes fixed it: (1) an explicit, prominently-placed ban on placeholder replies; (2) a positive instruction to advance the conversation with substance when the agent spoke last or the customer was just fully answered. Note the length cap ("1-2 sentences") is *retained* — an early over-correction dropped it in favor of "usefulness > brevity," which produced correct-but-verbose replies; the real cause of the filler was the *follow-up clause*, not the length limit, so the fix is to keep the tight cap **and** demand substance within it ("be substantive but say it briefly"). **Takeaway for re-implementers:** with a small model, (a) a strong specific rule buried mid-paragraph loses to a competing strong specific rule — make the behavior you want *prominent and positive*, and *explicitly forbid* the failure mode by example; and (b) fix the clause actually causing a symptom rather than relaxing an adjacent constraint (brevity) that wasn't the problem.

**Why the model also emits `suggestedScope` and `resourceIds`:** the same read of the conversation that yields a good reply also indicates (a) whether an autopilot mode should be offered and (b) which help articles are relevant. Bundling them into one call avoids two extra LLM round-trips. These are *side outputs*; the reply text is the primary product.

### 5.2 When the base suggestion is (re)generated — triggers

The client calls `runNbrRefresh(contactId)` at exactly these moments:

1. **On connect — the greeting.** When a chat first attaches and the agent hasn't spoken yet, the client **locally** composes a greeting (`"Hi <first>, my name is <agent> with Bob's Mutual Funds. <intentGreeting>"`) and seeds it as the first history entry with `source: 'greeting'`. This is *not* an LLM call — it's deterministic and instant, so the agent always has an opener. It also sets `suggestedScope: 'get-intent'` and kicks off Change-to option generation for that entry.
2. **On every customer message.** A store field `lastCustomerMessageAt` changes; an effect fires `runNbrRefresh`. This is the main path: each time the customer says something, a fresh suggestion is fetched. (This fires even while autopilot is active, to keep a human-ready suggestion warm.)
3. **Immediately after the agent sends** — whether they sent the suggestion (`onSend`) or typed freehand in the composer (`handleSend`). **Why:** the moment a message goes out, the on-screen suggestion is stale (it answered the *previous* state). Refreshing immediately means that by the time the customer replies, a relevant suggestion is often already there. (Sending a *resource link* does **not** refresh — a link isn't a conversational turn.)

`runNbrRefresh` sets `suggestionLoading: true` (header spinner), POSTs `{ transcript: liveMessages, clientProfile }`, and on success appends the result via `addSuggestion(..., 'nbr')`, stores `suggestedResources`, and adopts `suggestedScope` **only if** autopilot isn't already active. It reads the *live* transcript from the store at call time (not a stale closure) so the newest message is included.

### 5.3 History, pagination, and auto-advance

Every produced suggestion is appended to `suggestionHistory`; the agent can page through them with ‹ › chevrons. The semantics are subtle and worth reproducing exactly:

- **`addSuggestion(text, source)`** appends an entry. If it's the first ever, or `suggestionAutoAdvance` is true, the view snaps to the new entry (`suggestionIndex = last`) and `suggestionNewBadge` clears. Otherwise (the agent has paged backward to look at an older one) the entry is appended silently and `suggestionNewBadge` is set — a red dot on the › chevron signals "something newer arrived," without yanking the agent off what they were reading.
- **`paginateSuggestion(delta)`** clamps the index to `[0, len-1]`. `suggestionAutoAdvance` is re-enabled **only** when the agent returns to the newest entry; paging away from newest disables it. The new-badge clears when they reach newest.
- **`editCurrentSuggestion(text)`** mutates `history[index].text` in place (keeps `id`, `originalText`, `source`, options). Focusing the box to edit also sets `suggestionAutoAdvance: false`. **Why:** if you're editing entry #2 and a #5 arrives, you must not be teleported away mid-edit.

**Why keep a full history at all rather than just the latest:** (a) the agent may prefer an earlier phrasing after seeing a worse newer one; (b) **Change to** and **Magic** append *new* entries rather than overwriting, so the agent can always page back to the original; (c) it gives telemetry and future analysis the full branch of what the AI offered.

### 5.4 Rendering and sending (component `AISupport`)

The Suggested-Reply card renders when autopilot is off, no proposed-action card is pending, and `suggestionHistory.length > 0`. It contains:

- A header: **"Suggested reply"** label + an inline spinner while `suggestionLoading`, and the ‹ › pager (right) with the new-badge dot on ›.
- The **editable text** (`EditableReply` — a transparent, auto-growing `<textarea>`; plain text, faithful newlines). Editing writes through `editCurrentSuggestion`. Focus parks auto-advance; blur clears the local editing style.
- A bottom row: **Send** (left); **🪄 Magic ▼** and **Change to ▼** (right).

**Send** (`handleSendSuggestion`): logs a telemetry event (`path: 'suggested-send'`, with `source`, `changeDirection`, `magicStyle`, `originalText`, `sentText`, `wasEdited`), then sends the current text to the customer and triggers a refresh.

**Why the editable box is the same control the agent sends from (not a preview + copy):** zero friction. The suggestion *is* the draft. Edit in place, hit Send. There is no separate compose-vs-suggestion mode to reconcile.

---

## 6. "Change to…" — redirect the suggestion's *meaning*

### 6.1 Goal

Sometimes the suggestion is well-written but is the *wrong move* — the agent wants to acknowledge instead of explain, ask a clarifying question instead of answer, buy time to research, or give a materially different answer. **Change to** lets the agent pick a different *direction* from a short menu and get a brand-new reply authored along it — **new meaning**, not a restyle.

This is a **two-call** design: cheap *option generation* (what directions to offer) is separate from *authoring* (writing the chosen reply). Understanding why they're split is key.

### 6.2 The options prompt (`mode: 'change-options'`)

Generates the menu items. Cheap, **no tools** (directions are about stance/angle, not client data), JSON mode, `max_tokens ≈ 160`, on the plain (non-tool) `invokeNovaMicro` helper.

System prompt (interpolations as before):

```
You help a live chat agent at Bob's Mutual Funds pick a better next move with ${name}.
We drafted a reply for the agent to send, but assume it may be the wrong move for THIS moment.
Propose 3-4 alternative moves the agent could make instead — each a short imperative label, max 10
words (aim for ~5).

STAY TIGHTLY ON THE CURRENT TOPIC AND MOMENT of this exact conversation. Do NOT change the subject or
drift to tangential topics, products, or goals. Each option must be a genuinely different WAY TO HANDLE
THIS SAME POINT — for example:
- a pointed clarifying question about what ${firstName} just said (e.g. "Ask ${firstName} where the fee shows up")
- acknowledge or empathize with ${firstName}'s concern
- tell ${firstName} you need a moment to research it
- give a materially different answer to ${firstName}'s actual question
Name the client "${firstName}" rather than a pronoun like "they". Keep the options distinct from our
draft and from one another. Plain text, no numbering, no quotes.
Return ONLY valid JSON: {"options": ["...", "..."]}
```

User message: the transcript **plus** the current (assumed-wrong) draft:
```
Conversation so far:
<transcript>

The (wrong) reply we drafted for the agent:
"<currentSuggestion>"
```

Server post-processing: take up to 4 non-empty options, trim surrounding quotes/dashes/whitespace, cap each at 80 chars.

**Why "assume it may be the wrong move":** framing the current draft as *rejected* pushes the model to produce genuinely divergent alternatives rather than four paraphrases of the same reply.

**Why "STAY TIGHTLY ON THE CURRENT TOPIC":** without it, a small model drifts to generic sales moves ("offer a portfolio review") that are off the current point. The options must be different *handlings of the same moment*, not new topics.

### 6.3 When options are generated — pre-generation for zero perceived latency

Options for an entry are fetched **right after that entry is displayed**, not when the agent opens the menu:

- After the greeting is seeded → generate options for it.
- After every `runNbrRefresh` success → generate options for the new entry.
- After a Change-to or Magic reply is appended → generate options for *that* new entry too.

Flow: `setChangeOptionsLoading(entryId, true)` → POST `change-options` → `setChangeOptions(entryId, options)` (which also clears loading). Attached to the entry **by id**, because by the time the async call returns the agent may have paged elsewhere.

**Why pre-generate:** when the agent clicks **Change to ▼**, the alternatives are already there — the menu opens instantly. Generating on-open would add a visible spinner to every use. The trade-off (some options are generated for suggestions the agent never refines) is cheap because `change-options` is a tiny, tool-less call. If the options aren't back yet when the menu opens, it shows a "Finding alternatives…" spinner; `null` = not yet generated, `[]` = generated but none.

### 6.4 The authoring prompt (`mode: 'change-reply'`) — a *dedicated* prompt, and why

When the agent selects a direction, the client POSTs `{ mode: 'change-reply', transcript, clientProfile, direction, currentSuggestion }` (the last being the rejected draft). This authors the actual reply, **with tools**, JSON mode, `max_tokens ≈ 350` — same data access and output shape as the base suggest path.

**Critical design point:** this mode uses its **own** system prompt (`CHANGE_REPLY_SYSTEM`), *not* the base suggest prompt with the direction appended. Interpolations as before; `${direction}` is the chosen move; `${rejected}` is the prior draft.

```
You are an AI assistant supporting a live chat agent at Bob's Mutual Funds.
The client is ${name}. Their accounts: ${summarizeAccounts}.

The agent reviewed the conversation and DECIDED on their next move. Write the message the agent
will send to ${firstName} that carries out THIS instruction, which is the entire point of the reply:

  → ${direction}

Fully deliver on that instruction — do NOT dilute it into a generic "let me know if you have any
questions" or "feel free to ask" closer. If it asks you to explain or clarify something, actually
give that explanation with real substance (2-4 sentences is fine — brevity is secondary to
genuinely doing what the instruction says). If it asks you to ask ${firstName} something, ask it
directly. If it asks you to acknowledge or empathize, do that specifically.

Write AS THE AGENT (a Bob's representative) speaking TO ${firstName}. Even if the most recent
message in the transcript is the AGENT's, still write the message that performs the instruction —
the agent has chosen to send this proactively. NEVER write in the client's voice or answer on
${firstName}'s behalf (do not begin with "Yes, that's correct"). No greetings or sign-offs.

The agent rejected this earlier draft, so do not simply repeat it: "${rejected}"      ← included only when a rejected draft is present

Stay accurate and compliant: only state facts given in this prompt or returned by a tool; never
invent client-specific figures; do not give personalized investment advice or execute trades
(offer a licensed-advisor callback for those).

Also select the 0-3 most relevant knowledge base articles for this reply, ordered by relevance.
Only include genuinely on-topic articles — return an empty array if nothing fits.

Available articles:
${RESOURCE_LIST}

Return ONLY valid JSON: {"suggestedText": "...", "resourceIds": ["kb-xxx", ...]}
```
(The hallucination rule from §4.5 is appended.)

**Why a dedicated prompt and not "base prompt + 'now do X':** this is the bug that motivated the whole design. When the direction was merely appended to the base suggest prompt, the base prompt's own rules — "1-2 sentences max" and "if the agent spoke last, add a brief follow-up" — *overpowered* the appended instruction on `gpt-4o-mini`. Concretely: in a Roth-vs-Traditional conversation where the agent had just explained the difference (so the agent spoke last), picking **"Clarify the benefits of Roth IRAs further"** returned *"If you have further questions or need more details, feel free to ask."* — the exact filler, ignoring the direction. The fix makes the chosen direction *the entire task*, stated first, and *explicitly neutralizes* the two competing rules ("even if the agent spoke last, still perform the instruction"; "2-4 sentences is fine — brevity is secondary"). Passing the rejected draft lets the model avoid repeating it. **General principle:** when one instruction must dominate, give it its own prompt rather than layering it onto a prompt tuned for a different job.

### 6.5 Store + UI for Change to

- `addChangeToReply(text, direction)` appends a `source: 'change-to'` entry (with `changeDirection`) and **always jumps to it** (`autoAdvance` on, badge off) — the agent explicitly asked for this reply, so show it immediately. Then options are generated for the new entry.
- UI: `ChangeToMenu` is a body-portaled dropdown, right-aligned to the button, that opens downward if the full list fits below else upward (and scrolls if neither fits). It closes on outside-click or Esc. It renders: a spinner ("Finding alternatives…") when `options == null || loading`; "No alternatives available." when `[]`; otherwise the option rows. Selecting a row closes the menu and calls `onChangeTo(direction)` → `handleChangeTo` → the `change-reply` POST.

---

## 7. "🪄 Magic" — restyle the suggestion, *same meaning*

### 7.1 Goal

The suggestion says the right thing but the agent wants it *phrased* differently — more concise, more detailed, more casual, more formal, or any free-text style ("warmer", "explain like I'm new to investing"). **Magic** rewrites the current text's **style only**, preserving every fact, number, question, and offer.

**Why this is distinct from Change to:** Change to alters *what the message does* (meaning); Magic alters *how it reads* (presentation). Keeping them separate keeps each prompt single-purpose and each affordance predictable. Conflating them would produce a tool that sometimes changes meaning when the agent only wanted a tone tweak — dangerous in a compliance setting.

### 7.2 The prompt (`mode: 'magic-rewrite'`)

The cheapest mode: **no tools** (it only rephrases given text), no transcript needed, JSON not required (returns raw text), `max_tokens ≈ 400`, on `invokeNovaMicro`.

System prompt (constant — no interpolation):

```
You rewrite a chat reply's STYLE for a live support agent, WITHOUT changing its meaning.
Keep every fact, number, offer, question, and piece of information EXACTLY the same — do not add,
remove, soften, or change any substance. Only change how it is phrased/presented per the requested
style. Return ONLY the rewritten reply text: no quotes, no preamble, no explanation.
```

User message:
```
Requested style: ${style}

Reply to rewrite (keep the meaning identical):
"${currentSuggestion}"
```

Post-processing: trim, strip wrapping quotes. If input text or style is empty, or on any error, **return the original unchanged** (a restyle must never lose the message).

**Why `${style}` accepts both presets and free text:** the four presets (More concise / detailed / casual / formal) cover the common cases as one-click buttons; the free-text field ("Custom style…") handles everything else with the same backend path. The backend doesn't distinguish — `style` is just a string.

### 7.3 Store + UI for Magic

- `addMagicReply(text, style)` appends a `source: 'magic'` entry (with `magicStyle`) and jumps to it. Options are then generated for it (so you can *Change to* a Magic'd reply, or *Magic* it again — the affordances compose).
- UI: `MagicMenu` mirrors `ChangeToMenu`'s portal/positioning/close behavior. It lists the four presets and a custom `<input>` + **Go** (Enter submits). Selecting a preset or submitting custom text closes the menu and calls `onMagic(style)` → `handleMagic` → the `magic-rewrite` POST.

---

## 8. Side outputs: autopilot scope and resources

The base `suggest` call returns two extras beyond the reply:

- **`suggestedScope`** — a hint that the conversation could be handed to one of the autonomous "autopilot" modes (`get-intent`, `researching`, `callback`, `idle-check`, `full-auto`, or `null`). Rendered as a small animated label + a ✈ toggle in the AI-panel header. Adopted into the slot only when autopilot isn't already active. Forced to `callback` by the deterministic advice/trade backstop (§4.5). Full autopilot behavior is out of scope here; what matters is that the suggestion call *also* produces this routing hint for free.
- **`resources`** — 0–3 knowledge-base links (`{ id, title, url }`) relevant to the conversation, chosen by the model from `RESOURCE_LIST` (validated server-side against `kbIndex` so only real articles pass). Rendered as a "Relevant resources" list, each with a **Send** button that posts the link as a formatted markdown message. **Sending a resource does not trigger a refresh** (it isn't a conversational turn).

---

## 9. Telemetry (`/log-reply` → `bobs-reply-events`)

Every time the agent sends a customer message, the client fires a **fire-and-forget** POST to `/log-reply` (failures are swallowed; the UI never blocks or surfaces them). Three `path`s:

- `suggested-send` — sent from the Suggested-Reply box. Includes `source` (greeting/nbr/change-to/magic), `changeDirection`/`magicStyle` when applicable, `originalText` (AI's wording), `sentText` (final), `wasEdited`.
- `composer-send` — freehand from the message composer. Includes `suggestionShownText` (the suggestion that was on screen but ignored) so we can measure "how often the agent bypasses us and what they wrote instead."
- `autopilot-send` — an autopilot reply went out (edited-in-place captured too). Autopilot-specific; listed for completeness.

**Why capture original-vs-sent and the ignored suggestion:** this is the feedback loop that tells us whether suggestions are trusted verbatim, lightly edited, redirected, or abandoned — the raw material for improving the prompts. The Roth-filler bug in §6.4 is exactly the kind of failure this data surfaces in aggregate.

**Table:** DynamoDB, PK `contactId`, SK `eventSort = ${ISO}#${random}` (sortable within a chat, unique across events), append-only, `RETAIN`.

---

## 10. Reconstruction checklist (suggested build order)

1. **Backend skeleton.** `POST /next-best-response`, parse `{ mode='suggest', transcript, clientProfile, currentSuggestion, direction, style }`, 400 on empty transcript, demo-profile fallback, build `kbIndex` + `RESOURCE_LIST`.
2. **LLM + tools helper.** Implement `invokeWithTools` (3-iteration tool loop → final JSON-mode call; the "no tools called + jsonMode" reformat edge case). Implement the ~10 read-only client-data tools + a per-`clientId` executor. Add the hallucination rule.
3. **`suggest` mode.** The §5.1 prompt; parse `{ suggestedText, suggestedScope, resourceIds }`; validate resource ids against `kbIndex`; apply the deterministic advice/trade → `callback` backstop; graceful fallback.
4. **Frontend state.** `Suggestion` + the `ContactSlot` suggestion fields; store actions `addSuggestion`, `paginateSuggestion`, `editCurrentSuggestion` with the auto-advance/new-badge semantics of §5.3.
5. **Triggers.** Local greeting on connect; `runNbrRefresh` on each customer message and after each agent send (not after resource sends); read the live transcript at call time.
6. **`AISupport` panel.** Editable box (auto-grow textarea), header spinner, ‹ › pager + new-badge, Send.
7. **Change to.** `change-options` (tool-less, §6.2) + `change-reply` (dedicated prompt, §6.4); `setChangeOptions(Loading)`, `addChangeToReply`; pre-generate options after every display (§6.3); `ChangeToMenu` dropdown.
8. **Magic.** `magic-rewrite` (§7.2); `addMagicReply`; `MagicMenu` (presets + custom).
9. **Telemetry.** `/log-reply` + table; wire `suggested-send` / `composer-send` (with `suggestionShownText`).
10. **Harden.** Confirm every mode degrades to a safe default; confirm no client-specific number ever appears without a tool call behind it.

---

## 11. Failure modes and non-obvious decisions (index)

| Symptom / choice | Where | Why |
|---|---|---|
| Suggestion collapses to "feel free to ask" filler | §5.1, §6.4 | Small model let a mid-paragraph rule beat an appended one; fixed with a prominent ban + positive "move forward" instruction, and (for Change to) a dedicated prompt. |
| Change to appends instead of overwriting | §5.3, §6.5 | Preserve the original so the agent can page back. |
| Options fetched before the menu is opened | §6.3 | Zero perceived latency on click. |
| Options attached by entry `id`, not index | §3.1, §6.3 | The agent may page away before the async options return. |
| `suggestedScope` + resources bundled into the reply call | §5.1, §8 | One read of the conversation, three outputs — avoids extra LLM round-trips. |
| Advice/trade routing is a regex, not the model's call | §4.5 | Compliance requirement, not a judgment call. |
| Magic returns original text on any failure | §4.6, §7.2 | A restyle must never lose the message. |
| Server is stateless; full transcript sent each call | §4.1 | Horizontal scalability; one endpoint serves every surface. |
| `suggestedText` mirrors `history[index].text` | §3.2 | Legacy consumers read a flat field; kept in sync rather than refactored. |
| Telemetry is fire-and-forget | §9 | An assist feature must never block or break the agent on a logging failure. |

---

*End of specification.*
