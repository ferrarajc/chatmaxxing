# Bob's Mutual Funds — AI-Assisted Service Platform
### Product Description · Internal Document

---

## Executive Summary

Bob's Mutual Funds AI-Assisted Service Platform is a web-based financial services system that combines a client-facing AI chatbot, a real-time live-agent workspace, and a task-driven AI autopilot engine. The platform dramatically reduces average handle time, allows a single agent to manage multiple simultaneous conversations, and gives clients instant self-service access to the most common account actions — with seamless escalation to a live agent when needed.

The system is built entirely on AWS serverless infrastructure and deployed as two separate React single-page applications: one for clients and one for agents. A suite of sixteen Lambda functions mediate every AI and data operation. No persistent servers are required.

---

## Product Vision

Give every Bob's Mutual Funds client the experience of speaking to a knowledgeable, responsive representative — immediately, any time — while giving agents the tools to handle complex requests efficiently and with confidence, knowing an AI handles the routine work automatically.

The guiding principle: **the AI does the work, the agent does the judgment.** The system collects, validates, and summarizes everything; the agent reviews and approves.

---

## User Personas

### Client (Retail Investor)
A Bob's Mutual Funds account holder visiting the web portal. They may have one or more accounts (Roth IRA, Traditional IRA, SEP-IRA, Taxable). They want fast answers and the ability to make account changes without calling in or filling out paper forms. They range from self-directed investors to retirees who need guidance.

### Agent (Financial Services Representative)
A Bob's Mutual Funds service representative managing up to four simultaneous client chats. They want to spend their time on judgment calls — not on typing, transcribing, or looking up account data. They benefit from AI-drafted responses, proposed actions that are ready to review and approve, and post-call work that writes itself.

---

## Platform Components

### 1. Client Chat Widget (Customer App)

**What it is:** A floating chat button on the Bob's Mutual Funds web portal that expands into a full chat panel. Clients can initiate a chat from any page.

**How it works:**
- The chat is powered by Amazon Connect. When a client opens the widget, a Connect chat session is created via the `/start-chat` Lambda.
- The initial interaction is handled by an AI bot (autopilot) running in "full-auto" mode. The bot can answer general questions, direct clients to self-service pages, and handle simple informational requests end-to-end without agent involvement.
- If the client's request requires account action or they ask to speak to an agent, the bot offers escalation. The client can choose live chat or schedule a callback.
- When escalating to live chat, the system generates an intent summary and a suggested agent greeting using a secondary LLM call, pre-populating the agent's workspace with context before the first human word is typed.
- **Continue a recent agent chat:** if the client spoke with a live agent within the last 7 days, opening the chat shows a card above the topic pills noting the date and a one-sentence summary of that prior conversation, with a **"Continue this chat"** button. Clicking it checks whether the *specific* agent they previously spoke with is currently available and lets the client wait for that agent or take the first available one; either way, when an agent accepts, the previous transcript is loaded into their workspace marked as a continued conversation. This is purely additive — the card is absent (and the experience identical to before) when there's no recent agent chat, and the demo "Reset all" clears this memory while leaving the saved transcripts intact.
- **Live typing indicators:** when connected to a live agent, the client sees an animated ellipsis whenever the agent is composing a reply — including while the autopilot has drafted the next message and is holding it for a human-realistic delay. To make autopilot replies indistinguishable from a human agent, the autopilot first waits a "reading" delay before the ellipsis even appears (time a person would spend reading the client's last message — a 2-second minimum plus more for longer messages), and only then begins the "typing" delay during which the ellipsis is shown. The indicator fades after 60 seconds of agent inactivity and reappears the moment they resume; if the agent cancels autopilot, it disappears immediately. Mirrored on the agent side: each column shows an animated ellipsis when that client is typing, fading after 30 seconds of silence.
- **Chat avatars:** while the client is talking to the AI assistant the avatar is a "B" for Bob's; once the chat is connected to a human agent, every agent message and the typing ellipsis show the connected agent's initials (e.g. "JF" for John Ferrara) for the rest of the conversation.
- **Minimize, close, and persistence:** the panel header has a minimize button that collapses the chat to a docked header bar at the bottom of the screen while the session stays fully live (the bar shows an unread badge for messages that arrive meanwhile; clicking it restores the panel). Clicking **×** after the client has engaged shows a confirmation — minimize (default) or **End chat**, which genuinely disconnects the Connect participant; opening-and-closing without engaging, or closing an already-ended chat, skips the dialog. Chat state persists per browser tab, so a reload or a trip to another website and back resumes the conversation (missed agent messages are backfilled); closing the tab ends it.
- **End-of-chat transcript:** when a live-agent chat ends, the client sees "Chat ended." plus a **Download transcript** button that saves the conversation as a plain-text file (date, agent, duration, timestamped lines).
- **Chat history:** a hamburger menu in the chat header (replacing the old logo) opens a list of the client's live-agent chats from the last 3 months, newest first — each card shows the date and start time in bold, the duration as (mm:ss), and the same short second-person recap the "Continue this chat" card uses ("You granted your wife limited access…"). Chats without that recap (saved before it existed) are not listed at all. Clicking a card opens the full read-only transcript with a Download link. Bot-only conversations that never reached an agent are not listed (they're never saved as transcripts).
- Clickable in-app navigation links are supported within chat messages, allowing the bot to direct clients to specific pages on the portal (e.g., `/account/beneficiaries`) without leaving the chat.
- Confirmation messages from completed agent actions are rendered as a distinct green confirmation card (rather than a plain chat bubble) with a structured header, reference number, and past-tense description.

**Bot capabilities (full-auto mode):**
- Answer general questions about account types, IRA rules, RMDs, rollovers, contributions, and tax topics
- Direct clients to self-service pages with clickable links
- Recognize escalation intent and offer live agent or callback
- Detect and hard-route trade requests and financial advice questions to licensed channels
- Handle idle sessions and proactively check in with quiet clients

**Technology:** React + Vite, Amazon Connect ChatJS SDK, AWS API Gateway, deployed on GitHub Pages.

---

### 2. Agent Workspace (Agent App)

**What it is:** A dedicated four-column dashboard for service agents. Each column represents one client conversation slot.

**Column anatomy:**
- **Client info panel:** Name, account summary, intent label (AI-generated at escalation), and account details
- **Chat thread:** Full conversation history, real-time messages, and AI-generated confirmation cards
- **AI support panel:** Next-best-response suggestions, predicted topic buttons, recommended KB articles, and autopilot controls
- **Autopilot controls:** While a column is running on autopilot, the message composer is replaced by a large **Pause Autopilot** button. Pausing *freezes* the countdown to the next auto-send without exiting — the paused state offers **Exit** (end autopilot for that column) and **Resume ▶** (continue from exactly where it left off). Clicking elsewhere in the column, or dragging the AI-panel resize handle to read a longer draft, no longer exits autopilot — only these controls do. The pending auto-send shows a live countdown that flashes red in its final 10 seconds so the agent can intervene in time.
- **Editable AI replies & suggestion history:** Both AI-drafted replies in the agent panel are editable in place — the agent clicks into the text and edits it like any text box. Editing the pending autopilot reply automatically pauses autopilot, and the edited version is what sends. The **Suggested reply** box keeps a browsable history of every suggestion in the conversation — ‹ › chevrons step through it, a spinner shows while the next one is being written, and a small "new" dot appears when a fresher suggestion arrives while the agent is reading an earlier one. Its button is **Send**, which delivers the shown (optionally edited) reply to the client immediately.
- **Proposed Action card:** When the autopilot has collected all fields for a task, a structured card appears showing every collected value. The agent can edit any field before submitting. On approval, the action executes and a confirmation is sent to the client.
- **Who may submit (task types):** Every task carries a submission type. Most are **Type 1** — any agent may submit on the client's behalf (the standard "Submit Action" button). **Type 2** (reserved) will require a licensed agent. **Type 3** tasks may only be submitted by the **client themselves**: the agent's button reads **"Send to client"**, and clicking it places a **"Your approval is required"** card directly in the client's chat (with the same fields, editable, but no evidence buttons) while the agent's panel shows a "Waiting for client to submit…" note. When the client clicks **Submit action** (or **Decline**), the action executes and the client receives the exact same confirmation as Type 1. **Adding an authorized account user** is the first Type 3 task — granting account access is a decision only the account owner can authorize.
- **Evidence highlighting:** While the Proposed Action card is showing, the transcript highlights the exact span where each collected value was established — the client's own statement, or the agent recap the client confirmed (not later echoes). Each card field has a locate button (⌖) that scrolls the transcript to its span and flashes it; a field whose value can't be traced to the transcript shows a "not located in transcript" hint so the agent knows to scrutinize it. Spans are found by a dedicated post-hoc LLM call and validated server-side against the actual message text; if the lookup fails, the card simply renders without highlights.

**Incoming contact management:**
- New contacts arrive as an alert card with a countdown timer
- The alert shows the client name, AI-generated intent summary, and account types held
- Agents can accept or skip incoming contacts
- Bonus opportunity badges are displayed when a contact qualifies for an incentive

**Client disconnect detection:**
- If the client closes/ends the chat on their side, the column doesn't silently jump to after-chat work: the AI support area is replaced by a clear "Client closed the chat." notice with an explicit **End chat** button, the composer is disabled, and any running autopilot stops. Clicking End chat moves the column to ACW as usual. Works in all four UI modes.

**After-call work (ACW):**
- When a chat ends, the AI automatically generates a wrap-up code, a summary, and coaching feedback for the agent
- Agents review and submit the ACW — they do not type it

**Technology:** React + Vite, Amazon Connect CCP (Contact Control Panel), deployed on GitHub Pages at `/agent`.

---

### 3. AI Autopilot Engine (`autopilot-turn` Lambda)

This is the core intelligence of the platform. It is a single Lambda function (~1,900 lines) that handles every AI-driven chat turn for both the pre-agent bot and the live-agent autopilot.

**Autopilot scopes:**

| Scope | When Used | Behavior |
|---|---|---|
| `full-auto` | Pre-agent bot | Handles conversation end-to-end; exits when escalation needed |
| `get-intent` | Live agent autopilot | Identifies which of 19 tasks the client needs, then drives structured field collection |
| `idle-check` | Agent autopilot | Sends a check-in to a quiet client |
| `callback` | Routing | Signals that a callback scope is warranted |
| `researching` | Agent manual | Holds pattern while agent investigates |

**The get-intent two-phase architecture:**

*Phase 1 — Task Identification:*
1. Keyword matching against the TASKS catalog (fast, zero LLM calls)
2. LLM fallback via Bedrock Nova Micro when keywords don't match (e.g., "give his wife access")
3. Once the task is identified, the full task-expert system prompt is invoked for the first agent turn

*Phase 2 — Field Collection (reactive):*
- A dedicated expert prompt for the identified task handles all subsequent customer messages
- Each task expert knows: which fields to collect, the client's current account state, field validation rules, and how to format the `proposedAction` JSON payload
- The expert only re-runs when the customer sends a new message (reactive, not polling)
- When all fields are collected, the expert sets `shouldExitAutopilot: true` and populates `proposedAction`

**Cross-cutting rules (applied to all 19 task experts via shared constants):**
- Field follow-up: if multiple pieces of info were asked and only some answered, follow up before moving on
- Language for restating: use "Got it — X will be Y" for client-stated info; reserve "I see X is currently" for database-sourced info
- Forbidden topics: financial advice, trades, fraud/security incidents, inheritance — each has a scripted exit response

**Task catalog (19 tasks):**
Update Contact Info · Change Beneficiary Designations · Add Account Access · Open Account · Buy/Contribute · Sell Shares · Exchange Funds · Toggle DRIP · Set Up Auto-Invest · Modify Auto-Invest · Pause/Resume Auto-Invest · Request Distribution · Set Up Recurring Distributions · Update RMD Settings · Initiate Rollover · Roth Conversion · Request Tax Document · Cancel/Reschedule Callback · Update Security Settings

Each task has: keyword list for fast matching, field schema with conditional logic (skip if, requires account type, requires multiple accounts), and an `executionType` of `real` (writes to DynamoDB) or `mock` (returns a simulated response).

---

### 4. Task Execution System

When the agent approves a Proposed Action, the `execute-task` Lambda executes it.

**Real executions (write to DynamoDB):**
- `update-beneficiaries` — atomically replaces beneficiaries for a specific account while preserving other accounts' data
- `setup-auto-invest` — creates a new auto-invest schedule record
- `update-auto-invest` — modifies an existing schedule
- `pause-auto-invest` — pauses or resumes a schedule
- `update-rmd-settings` — writes RMD delivery and withholding preferences

**Mock executions (return realistic confirmation messages without database writes):**
All other tasks (buys, sells, exchanges, rollovers, Roth conversions, tax docs, etc.) return well-formed confirmation messages and reference numbers to complete the demo loop without requiring brokerage system integration.

Every execution returns a `referenceNumber` (format: `REF-XXXXXX`) for traceability. The client's chat receives a structured confirmation message: a green card with the reference number and a past-tense description of the completed action.

---

### 5. Knowledge Base and Predictive Questions

**Knowledge Base (`lambda/shared/kb.ts`):** 62 financial topics with 247 pre-written Q&A pairs covering IRA rules, RMDs, rollovers, tax topics, fund information, account types, and more. Topics are mapped to the page (and, where a flow has steps, the exact step) so the pills stay tightly relevant. The Open an Account wizard is fully step-aware: each of its 8 steps — and the IRA / SEP / taxable branches of the setup step — surfaces its own topics (e.g. beneficiary designation on the IRA setup step, business/EIN questions on the SEP step, funding-method questions on the funding step).

**Predict Intent (`predict-intent`):** Given the client's current page (or published sub-page/step context) and recent messages, suggests which KB topics are most likely to be relevant. Powers both the customer chat's topic pills and the topic button row in the agent's AI support panel.

**Predict Questions (`predict-questions`):** Given the current conversation, suggests the 3 most likely questions the client might ask next. Each suggested question can be injected into the agent's chat input with one click.

**Next-Best Response (`next-best-response`):** Suggests a concise one-to-two sentence reply for the agent's next turn, plus an autopilot scope recommendation. Displayed in the AI support panel as a draft the agent can adopt, edit, or ignore.

---

### 6. Callback Scheduling

When the client or agent opts for a callback instead of live chat:
- `schedule-callback` Lambda creates a scheduled EventBridge event for the requested time
- `execute-callback` Lambda fires at the scheduled time (in production, would trigger an outbound call)
- `cancel-reschedule-callback` task handles modification via the standard autopilot task flow
- The agent app displays a callback confirmation with scheduled time and reference number

---

### 7. Transcript Storage and Review

- `save-transcript` Lambda: called at chat end, writes the full message history to the `Transcripts` DynamoDB table (client ID, contact ID, timestamps, wrap-up code, ACW summary, and the **agent who handled the chat**). It also records the client's most recent agent chat as continuation memory on the client record, powering the "Continue this chat" capability. The permanent transcript log is retained independently and is not affected by the demo "Reset all".
- `agent-availability` Lambda: reports whether a given agent (by Connect username) is currently logged in and Available — used when a client chooses to continue with the specific agent they previously spoke to.
- `get-transcripts` Lambda: retrieves transcripts for a given client (or a single transcript by ID), used in the transcript review interface and to reload a prior conversation when a chat is continued
- A transcript viewer UI exists (separate from the main agent app) for post-hoc conversation review and quality analysis

---

### 8. After-Call Work (ACW) Generation

`generate-acw` Lambda: takes the full chat transcript and client profile, returns:
- **Wrap-up code** — one of 30 standardized codes (e.g., "Beneficiary Change", "Distribution Request")
- **Agent coaching** — one sentence of specific positive feedback and optionally one actionable improvement point, both written in second person
- **Conversation summary** — 3–5 factual sentences covering what was discussed, what was done, and the outcome

Agents review and submit; they never write ACW by hand.

---

### 9. Phone-Agent Callback Console (shipped 2026-06-30)

A dedicated cockpit for **phone** agents — a distinct role from the chat agent — living at its own URL
(`/chatmaxxing/phone`). It turns a scheduled callback into a call the agent can walk into fully prepared.
It is **simulation-first**: the entire experience is demoable in a browser with no telephony, and is
built so real Amazon Connect outbound voice drops in later without reworking the UI.

**The prep is the star.** The moment a callback is scheduled, an AI research pass ("`prep-callback`")
uses the same account/holdings/transaction/fund/knowledge tools the chat bot uses to actually *work the
client's question* — drafting a complete answer where it can, and honestly listing what it couldn't
resolve and why. By call time the agent's homework is done; their job shifts from researching to
verifying and delivering.

The experience:
- **Upcoming Calls board** — scheduled callbacks with a live countdown; open any to prep early.
- **The dossier** — a ready briefing: the client's objective; **"What I found for you"** (the worked
  answer, the facts behind it, and an honest "Still open" list); the originating chat/IVR transcript
  (with the meaningful phrases highlighted); a client snapshot; coaching; recommended reference
  articles; and an **editable script preview** the agent can tailor before the call.
- **The call** — a simulated automated outbound call rings the client, greets them, runs a
  (mock) voice-identity check, and connects. Non-happy paths are handled (wrong party, opt-out,
  bad time, no answer). Once connected, the console becomes a **teleprompter**: it shows the next
  thing to say one line at a time, follows along with a live transcript of the conversation, and
  advances on its own as the agent speaks — improvising the next line on request when the call goes
  off script.
- **After-call work** — the same wrap-up-code + summary flow as chat, auto-drafted from the call and
  editable; completing it files the call transcript into the Transcript Review tool alongside chats.

The client-side automated script is exactly what becomes a real Amazon Connect outbound IVR flow when
phone numbers are approved — the cockpit does not change.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend (client) | React 18, Vite, TypeScript, Zustand, React Router, Amazon Connect ChatJS |
| Frontend (agent) | React 18, Vite, TypeScript, Zustand, Amazon Connect CCP |
| Hosting | GitHub Pages (gh-pages branch) |
| API | AWS API Gateway HTTP API |
| Compute | AWS Lambda (Node.js 20, TypeScript via esbuild) |
| Primary AI | Amazon Bedrock — Amazon Nova Micro (`amazon.nova-micro-v1:0`) |
| Secondary AI | OpenAI GPT (via `OPENAI_API_KEY` env var) — used in autopilot-turn for task expert LLM calls |
| Contact center | Amazon Connect (chat + CCP) |
| Database | Amazon DynamoDB (two tables: Clients, Sessions) |
| Scheduling | Amazon EventBridge Scheduler |
| Infrastructure | AWS CDK (two stacks: BobsDataStack, BobsLambdaStack) |
| Observability | AWS CloudWatch Logs; Arize AI integration (optional, in `lambda/shared/arize.ts`) |
| CI/CD | GitHub Actions (path-filtered: deploys customer-app, agent-app, and phone-agent-app to gh-pages, and the CDK backend, on push to main) |

---

## Data Architecture

### DynamoDB — Clients Table
Keyed by `clientId`. Stores:
- Client profile: name, phone, accounts (type, balance, id), totalBalance
- `beneficiaries`: array of `{ accountId, name, relationship, percentage, type }`
- `autoInvest`: array of recurring investment schedules
- `rmd`: RMD delivery and withholding preferences
- `intents`: recent chat intent history (for personalization)
- **My Account hub** fields: `phones` (multiple numbers, each with verification status + SMS consent),
  `emailVerified`, `personal` (DOB, marital/employment, citizenship), `security` (2FA, login alerts,
  recent activity), `preferences` (paperless/e-delivery, notifications, language, marketing),
  `bankAccounts`, `trustedContact`, `investorProfile` (risk tolerance + goals), `watchlist`, and
  `agreements` (signed e-sign records)

### My Account hub (self-service profile & settings)
The customer **My Account** page is a comprehensive, fully database-driven profile and settings center
comparable to a Vanguard/Schwab/Fidelity profile hub. Every value is editable and persisted to the
Clients Table (optimistic save, the same pattern as the Beneficiaries/RMD/Auto-Invest pages), spanning:
contact information (multiple phone numbers + email), personal & employment details, a security center,
communication & delivery preferences, linked bank accounts, a FINRA-style trusted contact, an investor
profile (populated from the risk-tolerance quiz), an investment watchlist, and a vault of signed
agreements — plus a services grid linking to Beneficiaries, Auto-Invest, RMD, Tax Documents, and
Transaction History. **Contact verification is real:** changing or adding an email/phone marks it
*unverified*, and a one-time code (Amazon SES for email, AWS End User Messaging for text) proves
ownership before it clears — there is no cosmetic/fake "verified" state. The text-messaging section
carries a full TCPA/CTIA-compliant consent experience (separate account-alert vs. marketing opt-in,
required disclosures, STOP/HELP, an SMS Terms page, and stored consent records).

### DynamoDB — Transactions Table
Keyed by `clientId` + a date-ordered sort key (one item per transaction), with a per-account
secondary index. Holds each client's full transaction history back to account inception (seeded
decades deep for all four demo personas), so the portal can page and filter large histories
quickly instead of loading everything at once. Every transaction carries a **status** —
*Scheduled, Pending, Settling, Completed,* or *Canceled* — reflecting the real mutual-fund order
lifecycle (daily NAV pricing, next-business-day settlement). The client portal surfaces this on
every transaction table (the Portfolio and account "Recent Transactions" lists plus a dedicated
**Transaction History** page with filtering, search, sorting, and pagination); each status label
has a subtle dotted underline and, on click, explains what the status means and what happens next.
The chatbot and agent autopilot read the same data (including status) so they can answer "where's
my trade?" accurately.

### DynamoDB — Sessions Table
Keyed by `contactId`. Stores:
- clientId, timestamp, status
- Full message array
- 30-day TTL (`expiresAt`)

### DynamoDB — Funds Table
Keyed by `ticker`. Holds the static profile for every fund in the lineup (all 36) — name, asset-class
family, expense ratio, risk level, descriptions, and historical profile data. This is the **single
source of truth** for fund information: the same data drives the customer content pages (fees, fund
performance, prospectus library, the Research screener and per-fund profile pages), the fund pickers
in the account-opening and investment flows, and all three AI systems (the customer chatbot, agent
Suggested Reply, and Autopilot) via a fund-lookup capability. Updating a fund once propagates
everywhere, so pages and the AI can never disagree about what funds exist or what they cost. (Live,
intraday prices and returns are sourced separately from a market-data service.)

---

## Infrastructure (CDK)

**BobsDataStack:** DynamoDB tables, IAM roles for Lambda access.

**BobsLambdaStack:** API Gateway + all 16 Lambda functions, EventBridge scheduler role, all environment variable wiring.

**Environments & deployment.** Two environments built from the same CDK code: **prod** and an
isolated **dev** (`bobs-*-dev`, ~$0 idle) for testing before prod. **Everything deploys from `main`:**
merging triggers GitHub Actions that deploy the backend (CDK via OIDC, `deploy-cdk.yml`) and the
frontends (gh-pages). Deploys are guarded — `cdk/scripts/safe-deploy.mjs` typechecks, diffs, and
refuses to delete/replace a live resource — so a stale-branch deploy can't silently remove prod
infrastructure. `OPENAI_API_KEY` resolves from AWS SSM at deploy time (no shell variable). Engineers
test backend changes on dev (`npm run deploy:dev` + `npm run dev`) before opening a PR. A $15/month
budget alarm guards spend. **Full developer process: `docs/PROCESS.md`.**

---

## Key Design Decisions

**Why LLM-expert-per-task (not a single general agent):** Each of the 19 tasks has unique field validation logic, domain-specific rules (e.g., beneficiary allocation math, IRA account filtering), and edge cases. A single general LLM with a long prompt would blur these distinctions. Separate expert prompts keep each task narrow and testable.

**Why reactive autopilot (not polling):** The get-intent autopilot only runs when the customer sends a new message. This eliminates race conditions, avoids sending two messages in a row, and keeps the system stateless between turns.

**Why the safety guard (`if (taskShouldExit && !taskProposedAction) taskShouldExit = false`):** The system should never exit autopilot without a concrete proposed action ready for the agent to review. If the LLM declares completion before all fields are populated, the guard prevents a premature handoff.

**Why `FORBIDDEN_TOPICS` is a shared constant:** All 19 task expert prompts include the same forbidden topics block, ensuring consistent handling of financial advice, trades, and security incidents regardless of which task is active.

**Why taxable accounts are excluded from beneficiary prompts:** Beneficiary designations are a feature of IRAs and qualified accounts, not taxable brokerage accounts. The beneficiary prompt filters `profile.accounts` to `iraAccounts` before constructing the account list, so the LLM never sees or mentions the taxable account in that context.

---

## Current Deployment

| Artifact | URL |
|---|---|
| Client app | `https://ferrarajc.github.io/chatmaxxing/` |
| Agent app | `https://ferrarajc.github.io/chatmaxxing/agent` |
| API base URL | `https://0y3s5vq2v5.execute-api.us-east-1.amazonaws.com` |
| AWS region | `us-east-1` |

---

## Known Limitations and Scope Boundaries

- **Trade execution is intentionally out of scope for chat.** Buy/sell/exchange tasks exist in the task catalog and can be initiated by an agent via the Proposed Action card, but the actual brokerage execution is mocked. A licensed broker must complete real trades.
- **Financial advice is hard-blocked.** The bot and all task experts will refuse to provide personalized investment recommendations and will route to a callback with a financial advisor.
- **Most tasks are mock executions.** Five tasks write to real data (beneficiaries, auto-invest x3, RMD settings). All others return confirmation messages without database writes. This is intentional for the demonstration environment.
- **The client app requires a demo access code** (`VITE_DEMO_CODE`) to gate access.
- **OpenAI key is sourced from SSM at deploy time** (`bobs-openai-api-key`), resolved by CloudFormation — no shell variable required.
