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
- **Proposed Action card:** When the autopilot has collected all fields for a task, a structured card appears showing every collected value. The agent can edit any field before submitting. On approval, the action executes and a confirmation is sent to the client.

**Incoming contact management:**
- New contacts arrive as an alert card with a countdown timer
- The alert shows the client name, AI-generated intent summary, and account types held
- Agents can accept or skip incoming contacts
- Bonus opportunity badges are displayed when a contact qualifies for an incentive

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

**Knowledge Base (`lambda/shared/kb.ts`):** 30 financial topics with 120 pre-written Q&A pairs covering IRA rules, RMDs, rollovers, tax topics, fund information, account types, and more.

**Predict Intent (`predict-intent`):** Given the client's current page and recent messages, suggests which KB topics are most likely to be relevant. Powers the topic button row in the agent's AI support panel.

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

- `save-transcript` Lambda: called at chat end, writes the full message history to a `Sessions` DynamoDB table with client ID, contact ID, timestamp, and a 30-day TTL
- `get-transcripts` Lambda: retrieves transcripts for a given client, used in the transcript review interface
- A transcript viewer UI exists (separate from the main agent app) for post-hoc conversation review and quality analysis

---

### 8. After-Call Work (ACW) Generation

`generate-acw` Lambda: takes the full chat transcript and client profile, returns:
- **Wrap-up code** — one of 30 standardized codes (e.g., "Beneficiary Change", "Distribution Request")
- **Agent coaching** — one sentence of specific positive feedback and optionally one actionable improvement point, both written in second person
- **Conversation summary** — 3–5 factual sentences covering what was discussed, what was done, and the outcome

Agents review and submit; they never write ACW by hand.

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
| CI/CD | GitHub Actions (deploys customer-app and agent-app to gh-pages on push to main) |

---

## Data Architecture

### DynamoDB — Clients Table
Keyed by `clientId`. Stores:
- Client profile: name, phone, accounts (type, balance, id), totalBalance
- `beneficiaries`: array of `{ accountId, name, relationship, percentage, type }`
- `autoInvest`: array of recurring investment schedules
- `rmd`: RMD delivery and withholding preferences
- `intents`: recent chat intent history (for personalization)

### DynamoDB — Sessions Table
Keyed by `contactId`. Stores:
- clientId, timestamp, status
- Full message array
- 30-day TTL (`expiresAt`)

---

## Infrastructure (CDK)

**BobsDataStack:** DynamoDB tables, IAM roles for Lambda access.

**BobsLambdaStack:** API Gateway + all 16 Lambda functions, EventBridge scheduler role, all environment variable wiring.

Deploy command:
```powershell
$env:OPENAI_API_KEY = "sk-..."   # required — omitting breaks autopilot silently
cd cdk
npx cdk deploy BobsLambdaStack --require-approval never
```

Frontend deployment: automatic via GitHub Actions on push to main (separate workflows for customer-app and agent-app). Manual deployment: build locally, copy dist to `.gh-pages-deploy` worktree, push to gh-pages branch.

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
- **OpenAI key required at deploy time.** If `OPENAI_API_KEY` is not set in the shell before `cdk deploy`, the autopilot Lambda deploys without it and AI responses fail silently.
