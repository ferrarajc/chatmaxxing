# Claude Quick-Start Context — chatmaxxing

Read this at the start of any session to orient quickly. Sections are kept narrow so you only read what's relevant.

---

## What This Is

A financial services AI platform for Bob's Mutual Funds. Two React SPAs (client chat widget, agent workspace) + 16 AWS Lambdas + Amazon Connect. The AI handles chat turns autonomously; agents review and approve actions.

Full product description: `docs/PRODUCT.md`

---

## Repo Layout

```
chatmaxxing/
├── customer-app/          React SPA — client chat widget
│   └── src/
│       ├── components/chat/   ChatWidget, ChatPanel, ChatMessage, ChatBody
│       ├── components/pages/  All portal pages (account/, resources/, etc.)
│       ├── hooks/             useChatSession.ts (Connect integration)
│       ├── store/             chatStore.ts, clientStore.ts
│       └── types/index.ts     ChatMessage, ChatMessageLink, KBQuestionResult
│
├── agent-app/             React SPA — agent workspace
│   └── src/
│       ├── components/    AgentDesktop, ChatColumn, ProposedActionCard,
│       │                  IncomingAlert, AISupport, AfterCallWork, ResponseTimer
│       ├── store/         agentStore.ts
│       └── types.ts       ContactSlot, ProposedAction, ProposedActionField
│
├── lambda/
│   ├── autopilot-turn/    Core AI engine (~1900 lines) — see LAMBDA_MAP below
│   ├── start-chat/        Creates Connect session; generates intentLabel + intentGreeting
│   ├── execute-task/      Runs approved agent actions (some real DynamoDB, some mock)
│   ├── generate-acw/      Post-chat wrap-up code + coaching + summary
│   ├── next-best-response/ Agent response suggestions + autopilot scope hints
│   ├── predict-intent/    KB topic prediction from page + conversation
│   ├── predict-questions/ 3 likely next questions from current conversation
│   ├── send-agent-message/ Sends a message from agent to customer via Connect
│   ├── save-transcript/   Writes chat to Sessions DynamoDB table
│   ├── get-transcripts/   Reads transcripts for a client
│   ├── client-data/       Reads/writes client profile data
│   ├── client-log/        Logs client-side events
│   ├── agent-connection/  Manages agent Connect connection tokens
│   ├── schedule-callback/ Creates EventBridge scheduled callback
│   ├── execute-callback/  Fires when callback time arrives
│   └── reset-beneficiaries/ Dev utility — resets test client beneficiary data
│   └── shared/
│       ├── tasks.ts        TASKS array (19 tasks), matchTaskByIntent, filterFields
│       ├── kb.ts           30 topics, 120 Q&A pairs (knowledge base)
│       ├── types.ts        Shared types + summarizeAccounts, formatTranscript, matchResources
│       ├── bedrock-client.ts invokeNovaMicro + parseJsonFromBedrock
│       ├── dynamo-client.ts  DynamoDB DocumentClient
│       ├── beneficiary-defaults.ts  BeneficiaryEntry type + demo data
│       └── arize.ts        Optional Arize AI observability
│
├── cdk/                   AWS CDK — BobsDataStack + BobsLambdaStack
├── docs/
│   ├── PRODUCT.md         Full product description (human-readable)
│   └── CLAUDE_CONTEXT.md  This file
└── .gh-pages-deploy/      Git worktree pointing to gh-pages branch (manual frontend deploys)
```

---

## Lambda Map

| Lambda | Purpose | LLM? |
|---|---|---|
| `autopilot-turn` | All AI chat turns (full-auto + get-intent + idle-check) | Yes — Nova Micro + OpenAI |
| `start-chat` | Start Connect session; generate intentLabel + intentGreeting | Yes — Nova Micro |
| `execute-task` | Run approved agent action (real or mock) | No |
| `generate-acw` | Post-chat wrap-up code, coaching, summary | Yes — Nova Micro |
| `next-best-response` | Suggest agent reply + autopilot scope | Yes — Nova Micro |
| `predict-intent` | Suggest KB topics from page + conversation | Yes — Nova Micro |
| `predict-questions` | Predict client's next 3 questions | Yes — Nova Micro |
| `send-agent-message` | Push agent message to client via Connect API | No |
| `save-transcript` | Write transcript to Sessions table | No |
| `get-transcripts` | Read transcripts for a client | No |
| `client-data` | Read/write client profile | No |
| `client-log` | Log client-side events | No |
| `agent-connection` | Manage agent Connect tokens | No |
| `schedule-callback` | Create EventBridge callback event | No |
| `execute-callback` | Fire on scheduled callback time | No |
| `reset-beneficiaries` | Dev: reset test client beneficiary data | No |

---

## Autopilot Architecture (most important — read this carefully)

**Two AI families, one Lambda:**
- **Nova Micro** (Amazon Bedrock): used for `full-auto`, `get-intent` task identification (Phase 1), ACW, NBR, intent label/greeting
- **OpenAI GPT** (via `OPENAI_API_KEY`): used for `get-intent` task expert turns (Phase 2)

**Scopes:**
- `full-auto` → FULL_AUTO_PROMPT → handles pre-agent bot Q&A, links to self-service pages, exits on escalation/account modification
- `get-intent` → two-phase task system (see below)
- `idle-check` → sends check-in message
- `callback` → signals routing to callback scope

**get-intent Phase 1 (task identification):**
1. Keyword match via `matchTaskByIntent()` (zero LLM calls, fastest)
2. LLM fallback via `identifyTaskWithLLM()` if keywords miss
3. Task identified → builds `buildTaskSystemPrompt(profile, taskId)` → first expert turn

**get-intent Phase 2 (field collection, reactive):**
- Runs on every subsequent customer message
- Expert prompt handles: what fields remain, current account state, business rules, proposedAction JSON format
- Exits with `shouldExitAutopilot: true` + `proposedAction` when all fields confirmed
- Safety guard: if `shouldExitAutopilot && !proposedAction`, resets exit to false (prevents premature handoff)
- Catch block: on LLM error, sends "I'm pulling some information..." and sets `shouldExitAutopilot: true`

**Shared constants injected into all 19 task prompts:**
- `FORBIDDEN_TOPICS` — financial advice, trades, fraud, inheritance. Each has a scripted response. Also contains field follow-up rule and language rule for echoing customer-stated info.
- `FORBIDDEN_TOPICS_NO_TRADES` — same minus trade-execution clause (for tasks that handle trades)
- `SELF_SERVICE_PAGES` — in FULL_AUTO_PROMPT only. Lists all portal routes so bot gives direct links.

**19 task experts** (in `buildTaskSystemPrompt` switch):
update-contact-info, update-beneficiaries, add-account-access, open-account, place-purchase, place-sale, exchange-funds, toggle-drip, setup-auto-invest, update-auto-invest, pause-auto-invest, request-withdrawal, setup-systematic-withdrawal, update-rmd-settings, initiate-rollover, roth-conversion, request-tax-document, cancel-reschedule-callback, update-security

**Beneficiary task specifics:**
- `iraAccounts` filter: only IRA/SEP accounts (not Taxable) — used for BOTH the account list AND `summarizeAccounts` in the prompt header
- Fetches current beneficiaries from DynamoDB before building prompt
- Handles ADD/REMOVE/UPDATE/REPLACE-ALL semantics
- Enforces 100% allocation math, existing beneficiary acknowledgment rule

---

## Key Files to Edit for Common Tasks

| What you're changing | File(s) |
|---|---|
| Bot pre-agent behavior | `lambda/autopilot-turn/handler.ts` → `FULL_AUTO_PROMPT` |
| Self-service page links | `lambda/autopilot-turn/handler.ts` → `SELF_SERVICE_PAGES` |
| Cross-cutting LLM rules | `lambda/autopilot-turn/handler.ts` → `FORBIDDEN_TOPICS` (affects all 19 tasks) |
| A specific task expert | `lambda/autopilot-turn/handler.ts` → find `[TASK_NAME]_PROMPT` function |
| Task field definitions | `lambda/shared/tasks.ts` → `TASKS` array |
| Adding a new task | `lambda/shared/tasks.ts` (add task) + `handler.ts` (add prompt + switch case) + `execute-task/handler.ts` (add execution) |
| Task execution logic | `lambda/execute-task/handler.ts` |
| Agent chat rendering | `agent-app/src/components/ChatColumn.tsx` |
| Proposed Action card | `agent-app/src/components/ProposedActionCard.tsx` |
| Client chat rendering | `customer-app/src/components/chat/ChatMessage.tsx` |
| Client routes | `customer-app/src/App.tsx` |
| Intent summary label | `lambda/start-chat/handler.ts` → intentLabel prompt |
| Agent greeting | `lambda/start-chat/handler.ts` → intentGreeting prompt |
| ACW generation | `lambda/generate-acw/handler.ts` |

---

## Deployment

**Lambda (immediate):**
```powershell
cd cdk
npx cdk deploy BobsLambdaStack --require-approval never
```
`OPENAI_API_KEY` is in AWS SSM (`bobs-openai-api-key`) — CloudFormation resolves it at deploy time, no shell variable needed.
Typecheck first: `cd cdk; npx tsc --noEmit`

**Frontend (customer-app or agent-app — manual):**
```powershell
cd customer-app   # or agent-app
npm run build
# Then copy dist to .gh-pages-deploy:
# For customer-app: copy dist/assets/*.js to .gh-pages-deploy/assets/, copy dist/index.html to .gh-pages-deploy/
# For agent-app: copy dist/* to .gh-pages-deploy/agent/
cd .gh-pages-deploy
git add [files]; git commit -m "Deploy [app] — [description]"; git push origin gh-pages
```
`.gh-pages-deploy` is a git worktree on the gh-pages branch. DO NOT nest assets into subdirectories.

**Frontend (automatic on merge to main):**
GitHub Actions deploys customer-app to root of gh-pages, agent-app to `/agent`. Triggered by changes to their respective directories.

**PR workflow:** All changes must go through a PR — never push directly to main. Feature branches → PR → merge.

---

## DynamoDB Schema (Clients Table)

```
{
  clientId: string (partition key),
  name, phone, accounts: [{type, balance, id}], totalBalance,
  beneficiaries: [{accountId, name, relationship, percentage, type}],
  autoInvest: [{id, accountId, fund, amount, frequency, dayOfMonth, status}],
  rmd: {eligible, deliveryMethod, frequency, taxWithholding},
  intents: [recent intent strings]
}
```
Sessions Table: `{ contactId (PK), clientId, timestamp, status, expiresAt (TTL 30 days) }`

---

## Live URLs

- Client app: `https://ferrarajc.github.io/chatmaxxing/`
- Agent app: `https://ferrarajc.github.io/chatmaxxing/agent`
- API: `https://0y3s5vq2v5.execute-api.us-east-1.amazonaws.com`
- Region: `us-east-1`
- Demo access code: `BOBS2025`

---

## Active Branch / Current State (as of 2026-05-09)

Branch: `feature/focusing-ui`
Recent changes on this branch (not yet merged to main):
- Font sizes scaled 25% across all column components
- ProposedActionCard: confirmation message is now structured (Confirmation / Ref / past-tense description) and renders as a green card in client chat
- ChatMessage.tsx: markdown `[text](url)` links render as in-app navigation buttons
- FULL_AUTO_PROMPT: SELF_SERVICE_PAGES block — bot gives direct links instead of "fill out a form"
- FORBIDDEN_TOPICS: field follow-up rule + language rule for restating customer-stated info
- start-chat: intentGreeting no longer says "connect with a live agent"; intentLabel no longer includes escalation request language
- UPDATE_BENEFICIARIES_PROMPT: taxable accounts excluded from account listing
- autopilot-turn catch block: sets taskShouldExit=true on LLM error (prevents indefinite stall)

---

## Important Rules

1. Always set `OPENAI_API_KEY` before `cdk deploy` or autopilot silently breaks
2. Never push directly to main — always use a PR
3. When modifying `FORBIDDEN_TOPICS`, remember it affects ALL 19 task experts simultaneously
4. When editing task prompts, typecheck before deploy: `cd cdk && npx tsc --noEmit`
5. Lambda changes are live immediately after deploy; frontend changes require gh-pages push or PR merge
6. **Update this file and `docs/PRODUCT.md` whenever making significant architectural changes**

---

## Self-Maintenance Instruction

Whenever you make changes that affect architecture, task list, deployment, or significant behavior, update the relevant section of this file and `docs/PRODUCT.md`. Keep updates narrow — only touch the section that changed. The "Active Branch / Current State" section should be updated at the start of each significant feature batch and cleared/moved when the branch merges.
