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
│   ├── predict-intent/    Chat topic pills for the current page (every page now; see kb.ts EXTRA_PAGE_TOPICS)
│   ├── predict-questions/ Question pills + pre-written answers for a chosen topic
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
│       ├── kb.ts           62 topics, 247 Q&A pairs (knowledge base)
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
| `send-agent-message` | Push agent message OR a typing event (`event:'typing'`) to client via Connect API | No |
| `agent-availability` | Is a given agent (by Connect username) currently on queue / Available? | No |
| `save-transcript` | Write transcript to Transcripts table (incl. AI retrospective `summary`, used by the customer chat-history cards); also write `lastAgentChat` continuation memory to Clients table | Yes — Nova Micro (recap) |
| `get-transcripts` | Read transcripts for a client | No |
| `client-data` | Read/write client profile | No |
| `client-log` | Log client-side events; on `context:'access-code-entered'` also sends an `urgent` Pager Doodie push (customer-site signin alert) | No |
| `agent-connection` | Manage agent Connect tokens | No |
| `schedule-callback` | Create EventBridge callback event | No |
| `execute-callback` | Fire on scheduled callback time | No |
| `reset-beneficiaries` | Dev: reset test client beneficiary data | No |
| `reset-all-data` | Dev: reset ALL fields for all 4 clients to defaults | No |

---

## Autopilot Architecture (most important — read this carefully)

**Two AI families, one Lambda:**
- **Nova Micro** (Amazon Bedrock): used for `full-auto`, `get-intent` task identification (Phase 1), ACW, NBR, intent label/greeting
- **OpenAI GPT** (via `OPENAI_API_KEY`): used for `get-intent` task expert turns (Phase 2). Experts run on **`gpt-4o`** (set by `taskExpertModel()` / `DEFAULT_TASK_EXPERT_MODEL`, overridable via `OPENAI_MODEL_TASK_EXPERT`); gpt-4o-mini was too weak for the experts' conversational rules (it hallucinated and stonewalled). Customer bot, NBR, and intent labels stay on the `gpt-4o-mini` default for cost.

**Scopes:**
- `full-auto` → FULL_AUTO_PROMPT → handles pre-agent bot Q&A, links to self-service pages, exits on escalation/account modification
- `get-intent` → two-phase task system (see below)
- `idle-check` → sends check-in message
- `locate-evidence` → NOT a chat turn. Post-hoc utility scope called by the agent app after a task expert returns a `proposedAction`: given `{transcript, proposedAction}`, one gpt-4o call (`LOCATE_EVIDENCE_MODEL`, env `OPENAI_MODEL_LOCATE_EVIDENCE`) picks the authoritative transcript span per field (client statement, else the client-confirmed agent recap — never post-confirmation echoes); the server validates every quote against the actual message text and returns `{evidence: [{fieldKey, messageId, start, end}]}`. Early-returns before all chat-turn logic; any failure → `{evidence: []}` (UI shows no highlights). Drives the Proposed Action evidence highlighting in the agent UI.
- `callback` → CALLBACK_PROMPT → arranges a phone callback. **The LLM never computes timestamps** — it emits `{dayReference, hour24, minute}` and the server (`resolveCallbackTime`, TZ-safe via `Intl`/`date-fns-tz`) resolves+validates the ET→UTC instant. The server also injects authoritative availability (`describeCallbackAvailability`) and composes the first-turn "why a callback" opener deterministically (gpt-4o won't lead with it). Financial-advice requests short-circuit to this scope (`ADVICE_RE`) before task identification so "best stocks to **buy**" isn't swallowed by place-purchase.

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
| Chat topic/question pills (any page) | `lambda/shared/kb.ts` → `KB` topics + `EXTRA_PAGE_TOPICS` map; page keys come from `pageKeyFromPath` in `customer-app/.../chat/ChatWidget.tsx`. A page can publish a finer key via `pageContextStore` (e.g. the Open an Account wizard publishes `open-account/<step>` / `open-account/setup-{ira,sep,taxable}` per step+branch so pills track the exact screen); ChatWidget prefers it over `pageKeyFromPath`. Open-account in-flow topics are **ungated** (relevant type = the one being opened, not the client's holdings) and never link back to `/open-account`. |
| "Continue this chat" card (resume recent agent chat) | `customer-app/.../chat/ContinueChatCard.tsx` + `ChatBody.tsx` (render) + `useChatSession.ts` (`continueChat`, `get-continuation` fetch); `lambda/agent-availability` (queue check); agent-side load in `agent-app/.../useConnectStreams.ts` (`loadContinuationTranscript`) |
| Bot pre-agent behavior | `lambda/autopilot-turn/handler.ts` → `FULL_AUTO_PROMPT` |
| Self-service page links | `lambda/autopilot-turn/handler.ts` → `SELF_SERVICE_PAGES` |
| Cross-cutting LLM rules | `lambda/autopilot-turn/handler.ts` → `FORBIDDEN_TOPICS` (affects all 19 tasks) |
| A specific task expert | `lambda/autopilot-turn/handler.ts` → find `[TASK_NAME]_PROMPT` function |
| Task field definitions | `lambda/shared/tasks.ts` → `TASKS` array |
| Adding a new task | `lambda/shared/tasks.ts` (add task) + `handler.ts` (add prompt + switch case) + `execute-task/handler.ts` (add execution) |
| Task execution logic | `lambda/execute-task/handler.ts` |
| Agent chat rendering | `agent-app/src/components/ChatColumn.tsx` |
| Typing indicators (both directions) | Customer→agent: `useChatSession.ts` (`notifyTyping`, `onTyping`) + `ChatInput.tsx`; agent shows it in `useConnectStreams.ts` (`chatSession.onTyping` → `slot.customerTyping`) + `ChatColumn.tsx` (`TypingDots`, 30s expiry). Agent→customer: `ChatColumn.tsx` (manual keystrokes + autopilot `autopilotSend` → `/send-agent-message` `event:'typing'`); customer shows it via `agentTyping` (60s expiry) in `ChatBody.tsx`. Autopilot cancel sends the `__BOBS_TYPING_STOP__` sentinel to clear it promptly. `autopilotSend` runs two phases via `autopilotDelay`: a **reading delay** (ellipsis hidden; `2000ms + 10ms×(clientMsgLen−200)`, min 2000ms, based on the client's most recent message) then the existing **typing delay** (`chars/15`s, ellipsis shown). Chat avatar: bot turns show **"B"** (navy); once a live agent is connected, agent bubbles + the typing ellipsis show the **agent's initials** (accent color) via `chatStore.agentName` (`initialsFromName` in `utils/initials.ts`). The agent sends its **full name** (first + last) on connect as a `__BOBS_AGENT_NAME__` control message (`useConnectStreams.ts`, intercepted/not rendered) because Connect's chat `DisplayName` is only the agent's first name; a multi-word `DisplayName` is a fallback. |
| Customer chat history (hamburger ☰ in chat header) | `ChatPanel.tsx` (view state chat/history/transcript; ☰ replaced the "B" logo, ← goes back), `ChatHistoryView.tsx` (90-day card list via `GET /get-transcripts?clientId=` + read-only transcript via `?transcriptId=` + Download; **only rows with the second-person `summary` recap are listed** — no fallback; **pin/unpin button** on each card → `POST /pin-transcript`; pinned cards sorted first + `primarySoft` bg section), `lambda/save-transcript` (stores `summary` on the row), `lambda/get-transcripts` (list projection incl. `summary, acwSummary, agentName, pinned`), `lambda/pin-transcript` (sets `pinned` on transcript row) |
| Chat end-of-life (minimize/close/persist; customer-left detection) | Customer: `ChatPanel.tsx` (minimize btn + close-confirm dialog), `chatStore.ts` (sessionStorage `persist`, `minimized`/`unreadCount`/`chatEnded`), `useChatSession.ts` (reconnect-on-load + `endChat()` real disconnect + stale-session guard on `onEnded`), `ChatBody.tsx` + `utils/transcriptDownload.ts` (Download transcript on chat end). Agent: `useConnectStreams.ts` (`participant.left` EVENT in `chatSession.onMessage` → `slot.customerDisconnected`; chatjs routes unmapped event types to onMessage), `ChatColumn.tsx` + `FocusingDesktop.tsx` ("Client closed the chat." notice + End chat → `bobs:endChat` → ACW; composer disabled) |
| Proposed Action card | `agent-app/src/components/ProposedActionCard.tsx` (Type 1 = "Submit Action"; Type 3 = "Send to client" → waiting note). Submit body shared via `agent-app/src/utils/submitProposedAction.ts` (reused by the Type 3 relay in `useConnectStreams.ts`). |
| Task submission type (who may submit) | `lambda/shared/tasks.ts` → `Task.submissionType` (`'agent'` default / `'licensed-agent'` reserved / `'client'` = Type 3). Stamped onto `proposedAction` in `autopilot-turn/handler.ts` (`withSubmissionType`, both return sites). `add-account-access` is the only `'client'` task. |
| Type 3 client approval flow | Agent `ProposedActionCard` "Send to client" → `__BOBS_APPROVAL_FORM__` control msg → customer `useChatSession.ts` renders `ApprovalFormCard.tsx` (via `chatStore.approvalForm`, threaded through ChatWidget/ChatPanel/ChatBody) → customer Submit sends `__BOBS_CLIENT_APPROVED__` back → agent `useConnectStreams.ts` runs the shared submit (confirmation identical to Type 1). Sentinels: `__BOBS_APPROVAL_FORM__`/`__BOBS_APPROVAL_CANCEL__` (agent→customer), `__BOBS_CLIENT_APPROVED__`/`__BOBS_CLIENT_DECLINED__` (customer→agent). |
| Proposed-action evidence highlighting | Lambda: `locate-evidence` scope in `autopilot-turn/handler.ts` (`locateEvidence`, `LOCATE_EVIDENCE_PROMPT`). Frontend: `ChatColumn.tsx` (`evidencePromise` in `runAutopilotTurn`, `bobs:evidenceJump` listener, `MessageBubble` highlights) + same render half in `FocusingDesktop.tsx` (`FocusMessageBubble`) + ⌖ buttons in `ProposedActionCard.tsx` + `utils/evidenceHighlight.tsx` (span renderer) + `EvidenceSpan`/`proposedActionEvidence` in `types/index.ts`. Highlights/⌖ only render while the card is visible; evidence is keyed by message `id` and cleared on submit/reject. |
| Client chat rendering | `customer-app/src/components/chat/ChatMessage.tsx` |
| Client routes | `customer-app/src/App.tsx` |
| Transaction tables + history + status | Data: `bobs-transactions` table (`cdk/lib/data-stack.ts`), generator `lambda/shared/transaction-history.ts`, statuses `lambda/shared/transaction-status.ts`. API: `lambda/client-data/handler.ts` (`get-recent-transactions`/`get-transactions-page`/`append-transaction`). Frontend: `customer-app/src/data/transactionStatus.ts` (display copy), `components-v2/common/StatusCell.tsx` (dotted-underline popover), `hooks/useRecentTransactions.ts`, recent tables in `PortfolioPage.tsx` + `account/AccountDetailPage.tsx`, full page `components-v2/pages/transactions/TransactionHistoryPage.tsx` (route `/transactions`). Writes: `execute-task/handler.ts` (`appendTransactionRows`). Seed/clear: `reset-all-data/handler.ts`. |
| Research fund lineup (36 funds) | `customer-app/src/data/funds.ts` (static profiles + `group` field) **and** `lambda/market-data/handler.ts` → `FUND_MAP` (ticker→Vanguard realSymbol for live Yahoo quotes). Keep the two in sync. The Research index page (`components-v2/pages/research/ResearchPage.tsx`) is a search/filter/sortable screener grouped by `group`. |
| Intent summary label | `lambda/start-chat/handler.ts` → intentLabel prompt |
| Agent greeting | `lambda/start-chat/handler.ts` → intentGreeting prompt |
| ACW generation | `lambda/generate-acw/handler.ts` |

---

## Deployment

**Full process (environments, dev/PR/auto-deploy loop, transparency, rollback): `docs/PROCESS.md`.**
Summary: **prod deploys automatically on merge to `main`** (GitHub Actions: `deploy-cdk.yml` via OIDC
for the backend, `deploy-customer-app`/`deploy-agent-app` for the frontends). There's an isolated
**dev** environment (`bobs-*-dev` tables + `BobsLambdaStack-dev`, API `1cppcq9q57…`) for testing before
prod — `cd cdk; npm run deploy:dev`, then `npm run dev` (which targets dev via `.env.development`).
The commands below are the manual escape hatch / dev deploy.

**Lambda (immediate) — use the GUARDED command, never raw `cdk deploy`:**
```powershell
cd cdk
npm run deploy:lambda          # DataStack + LambdaStack (typecheck + cdk diff + destroy-guard + deploy)
# specific stacks/flags:  npm run deploy -- <Stack> [<Stack>...] --require-approval never
```
`cdk/scripts/safe-deploy.mjs` typechecks, runs `cdk diff`, and **ABORTS if the deploy would remove or
replace a live resource** (Lambda/route/integration/permission/table/GSI) unless `ALLOW_DESTROY=1` is set.
This exists because deploying a branch that is missing a live resource makes CloudFormation DELETE it —
a stale-branch deploy once removed `PinTranscriptFn` + its route this way. If the guard blocks with a
REMOVE list, your branch is behind prod: rebase onto the current production tip (see Active Branch / Current
State) and redeploy — don't reach for `ALLOW_DESTROY` unless the removal is genuinely intended.
`OPENAI_API_KEY` is in AWS SSM (`bobs-openai-api-key`) — CloudFormation resolves it at deploy time, no shell variable needed.
The `client-log` Lambda likewise reads `bobs-pagerdoodie-api-base` + `bobs-pagerdoodie-api-key` from SSM (same deploy-time resolution) so it can page the owner (via Pager Doodie) when someone enters the customer-site access code. The customer `AccessGate` fires a PROD-only fire-and-forget `POST /client-log {context:'access-code-entered'}` on a correct code; the gate's existing `bobs_access` localStorage flag means it only fires on a fresh/cleared browser.
(The guarded deploy runs `tsc --noEmit` for you — no separate typecheck step needed.)

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
  name, phone, displayPhone, email, address,
  totalBalance,
  accounts: [{type, balance, id, change}],
  holdings: [{name, ticker, accountId, shares, price, change, value, drip?}],
  // transactions are NO LONGER stored here — they live in the bobs-transactions table
  // (one item per row, see below). The legacy array is REMOVEd on reset.
  beneficiaries: [{accountId, name, relationship, percentage, type}],
  autoInvest: [{id, accountId, accountType, fund, ticker, amount, frequency, dayOfMonth?, nextDate, active, type?}],
  rmd: {eligible, age?, annualRmd?, takenThisYear?, remainingThisYear?, nextDeadline?, distributions?, deliveryMethod?, frequency?, taxWithholding?, ...},
  recentChatHistory: [{date, topic, summary}],
  // Continuation memory for the customer "Continue this chat" card — written by save-transcript
  // at agent-chat end, REMOVEd by reset-all-data. Distinct from the permanent transcript log.
  lastAgentChat?: {transcriptId, endedAt, summary, agentUsername, agentName}
}
```

All fields for all 4 demo clients are seeded via `GET /reset-client-data?key=bobs-reset-2025`
(which also clears `lastAgentChat`). Factory defaults live in `lambda/shared/client-defaults.ts`.

Transactions Table (`bobs-transactions`): one item per transaction so histories can run
back to an account's inception without the 400KB client-item cap. `{ clientId (PK),
txnSort (SK) = "<ISOdate>#<seq>", acctKey = "<clientId>#<accountId>" (GSI `account-index` PK),
txnId, date, description, descLower, amount, account, accountId, status, type }`. Newest-first
= Query with `ScanIndexForward:false`. Statuses (`Scheduled/Pending/Settling/Completed/Canceled`)
come from `lambda/shared/transaction-status.ts` (`assignStatus` by date vs the frozen `DEMO_TODAY`
= 2025-04-15). Seeded by a deterministic generator (`lambda/shared/transaction-history.ts`) via
`reset-all-data` (~2,100 rows across the 4 personas; idempotent). Read via `client-data` actions
`get-recent-transactions` / `get-transactions-page` (paginated, base64 cursor) and the shared
`get_transactions` tool (now includes status). Live trades (`execute-task`, `clientStore.buyFund`)
PutItem a `Pending` row dated the real today.

Sessions Table: `{ contactId (PK), clientId, timestamp, status, expiresAt (TTL 30 days) }`

Transcripts Table (`bobs-transcripts`, RETAIN): per-chat record incl. `messages`, `intentSummary`,
`wrapUpCode`, `acwSummary`, and `agentUsername`/`agentName` (who handled it). GSI `clientId-savedAt-index`.

---

## Live URLs

- Client app: `https://ferrarajc.github.io/chatmaxxing/`
- Agent app: `https://ferrarajc.github.io/chatmaxxing/agent`
- API: `https://0y3s5vq2v5.execute-api.us-east-1.amazonaws.com`
- Region: `us-east-1`
- Demo access code: `BOBS2025`

---

## Heqya — Quality Evaluation System

Lives in `heqya/` (npm-extractable package). The Bob's implementation uses it via `scripts/quality-loop/`.

| File | Purpose |
|------|---------|
| `heqya/core/runner.mjs` | Generic conversation runner (adapter-based) |
| `heqya/core/evaluator.mjs` | Generic LLM evaluator (heuristics-config-driven) |
| `heqya/core/reporter.mjs` | Generic reporter (report-NNN.md, latest.json, NEXT_FIX.md, transcripts-NNN.json) |
| `heqya/core/loop.mjs` | Generic improvement loop |
| `heqya/adapters/http-json.mjs` | Configurable HTTP/JSON adapter |
| `scripts/quality-loop/bobs-adapter.mjs` | Bob's adapter (autopilot-turn API wiring) |
| `scripts/quality-loop/heqya.config.mjs` | Bob's config (heuristics, scenarios, thresholds) — loads from JSON files |
| `scripts/quality-loop/heuristics.json` | 13 heuristics (editable via dashboard) |
| `scripts/quality-loop/scenarios.json` | 11 test scenarios (editable via dashboard) |
| `scripts/quality-loop/client-profiles.json` | 4 client profiles (alex, maria, jordan, robert) |
| `scripts/quality-loop/app-profile.json` | Bot description used for AI scenario generation |
| `scripts/quality-loop/run-quality-loop.mjs` | Active entry point (one evaluation pass) |
| `scripts/quality-loop/improvement-loop.mjs` | Full loop with Claude API + CDK deploy |
| `scripts/quality-loop/server.mjs` | Dashboard server with CRUD for heuristics, scenarios, app profile |

The old `runner.mjs`, `evaluator.mjs`, `reporter.mjs`, and `scenarios.mjs` are **legacy/deprecated** — kept for reference but no longer imported by active scripts.

---

## Active Branch / Current State (as of 2026-06-13)

In flight (`feature/transaction-history`, branched on top of `feature/type3-client-submit`):
**Full transaction history + per-row Status column.** Transactions moved off the client item
into the dedicated `bobs-transactions` table (see DynamoDB Schema above) so histories run back to
each account's inception. New `/transactions` page (filter by account/status, description search,
date sort + client-side amount sort, cursor "Load more"); both recent-transactions tables gained a
**Status** column with a subtle dotted-underline label that pops a definition + "what to expect"
on click (`StatusCell.tsx`). Realistic decades-deep histories seeded for all 4 personas
(~2,100 rows, deterministic). Chatbot + agent autopilot see status via the shared `get_transactions`
tool. Lambdas (`BobsDataStack` + `BobsLambdaStack`) deployed + seeded via `/reset-client-data`.
Frontend pending gh-pages/PR merge. NOTE: this branch sits on top of `feature/type3-client-submit`
(the deployed-but-unmerged prod tip) — deploying a `main`-based branch would revert the
pin-transcript + Type 3 Lambdas, so any Lambda deploy must include that tip.

## Active Branch / Current State (prior — as of 2026-06-11)

In flight (uncommitted): **Type 3 (client-submitted) tasks — `add-account-access`**. Tasks now carry
a `submissionType` (`'agent'` default / `'licensed-agent'` reserved / `'client'`). For a Type 3 task
the agent's Proposed Action card button reads **"Send to client"**: clicking it sends the form to the
customer's chat (`__BOBS_APPROVAL_FORM__`) and shows a "Waiting for client to submit…" note (+ Cancel)
in the AI area. The customer sees a **"Your approval is required"** card (`ApprovalFormCard.tsx`,
editable fields, no evidence ⌖, **Submit action** + **Decline**). On Submit the customer sends
`__BOBS_CLIENT_APPROVED__` back; the agent app runs the **exact same submit path as Type 1**
(`submitProposedAction` util → `execute-task` → confirmation appended + `send-agent-message`), so the
confirmation is byte-identical and arrives via the normal Connect agent-message path. Decline returns
the card to the agent; agent Cancel / chat-end / client-left all clean up the pending state.
Idempotency guard on the relay (`awaitingClientApproval` flips false before the await). Only
`add-account-access` is Type 3; all other tasks are unchanged Type 1. **Needs**: Lambda deploy
(`autopilot-turn` + shared) + both frontends; live CCP round-trip verification (see plan
`~/.claude/plans/we-re-going-to-work-majestic-toucan.md`).

In flight (`feature/chat-history-pin-unpin`, PR open): **Chat history pin/unpin**.
Customers can pin chats in the hamburger ☰ history list for easy future reference.
- New Lambda `pin-transcript` (POST `{transcriptId, pinned}`) writes `pinned: boolean`
  to the `bobs-transcripts` table. Added to CDK + POST routes.
- `get-transcripts` projection updated to include `pinned` in both clientId query +
  scan paths.
- `ChatHistoryView.tsx`: pin button (SVG pushpin, filled accent when pinned) on each
  card, optimistic toggle with revert-on-error, pinned cards sorted first. Pinned section
  rendered in a `primarySoft` (#E8ECF3) background that extends flush to a 1px divider
  (`theme.color.border`); unpinned section sits on the normal `bg`. Scroll-to-top on pin
  (smooth, via `scrollRef`). Lambda deployed via CDK; customer-app deployed to gh-pages.

Just shipped (PR #80, merged + deployed 2026-06-11 — Lambda via CDK, agent-app via
Actions): **Proposed-action evidence highlighting** in the agent UI. When a task expert
returns a `proposedAction`, the agent app fires a parallel `locate-evidence` request
(additive scope on `autopilot-turn`; runs during the autopilot send delay) and stores
validated spans on `slot.proposedActionEvidence`. While the card is visible the
transcript highlights each field's authoritative span (client statement, else the
client-confirmed agent recap — never post-confirmation echoes), each card field gets a
⌖ scroll-to-span button (CustomEvent `bobs:evidenceJump`, container-scoped lookup
because `pre-*`/`prior-*` message ids repeat across columns; hidden focusing-mode
ChatColumns bail on `clientWidth === 0`), and unlocatable fields show a "not located in
transcript" hint. Verified on the live API by replaying conversation `439f6348-…`: all
three spans land exactly as specified, post-confirmation echoes are skipped, degenerate
payloads → `{evidence: []}`. Still pending: one manual UI pass in a live chat (grid +
focusing modes). Known pre-existing bug observed, untouched: ProposedActionCard's
`editedFields` state doesn't reset when FocusingDesktop switches between two contacts
that both have cards (fix would be `key={slot.contactId}`; separate PR).

Just shipped (PRs #69–#78, all merged + deployed — Lambdas via CDK, frontends via Actions):
- **Chat end-of-life batch** (see the two "Chat …" rows in Key Files above for file map):
  minimize button + docked minimized header bar with unread badge (`ChatMinimizedBar.tsx`);
  close-confirmation dialog (Minimize focused / End chat;
  tire-kickers and ended chats close silently); closing now genuinely disconnects the Connect
  participant; chatStore persists to sessionStorage (reload/off-site-nav resume, missed agent
  messages backfilled via getTranscript; tab close = chat over). Agent side detects the
  customer's `participant.left` event (chatjs routes unmapped event types to `onMessage`) →
  "Client closed the chat." notice + End chat button in all 4 UI modes. Connect ends the whole
  contact when the customer disconnects, so `contact.onEnded` holds the slot at 'active' when
  `customerDisconnected` is set (instead of jumping to ACW); the agent's End chat click makes
  the ACW transition. Customer gets a
  **Download transcript** (.txt) button when a live chat ends.
- **Customer chat history**: hamburger ☰ (replaced the header "B" logo) → 90-day list of past
  live-agent chats (bold date/time, (mm:ss) duration, recap line) → read-only transcript +
  Download. `save-transcript` now stores the AI recap `summary` on the transcript row; the
  history list shows ONLY rows that have it (older rows are hidden, not fallback-summarized).
- **Bot-phase ended-event fix (2026-06-10)**: non-escalated `/start-chat` contacts use the
  bot-disconnect flow, so Connect fires chatjs `onEnded` seconds after connect while the bot
  keeps answering via the fallback Lambda. `useChatSession.ts` therefore treats `onEnded` (and
  a failed rehydration reconnect) as "chat over" only in `CONNECTED_TO_AGENT`/`WAITING_FOR_AGENT`
  — otherwise the input would lock up moments after every chat open. Related gotcha: customer
  chatjs sessions end via `disconnectParticipant()` — there is NO `disconnect()` method (calling
  it throws, and a try/catch silently ate that for weeks, so "End chat" never actually ended the
  Connect session until 2026-06-10).
- **Retirement calculator fix**: NumberInput no longer min-clamps per keystroke (select-all +
  retype works); digits-only with `maxDigits` cap; ages are unclamped by design.
- **Summary backfill (2026-06-10, one-off)**: all 164 transcript rows in the 90-day window got
  the second-person recap `summary` generated retroactively (same prompt as `save-transcript`,
  conditional write), so the summary-only history filter shows real data.
- **Transcript review UI** (`https://ferrarajc.github.io/chatmaxxing/transcripts/`): source
  lives ONLY on the `gh-pages` branch under `transcripts/` (no main-branch source — edit
  `.gh-pages-deploy/transcripts/` and push gh-pages to deploy). 2026-06-10: gained `?id=`
  deep-linking (pushState/popstate) and a copy-conversation-ID button.
- **Rough-edge log**: `docs/transcript-review-notes.xlsx` classifies transcript problems
  (conversation IDs hyperlink into the review UI via `?id=`). Heqya is shelved per the user
  (2026-06-10, "making things worse") — log rough edges there instead of running the loop.
- Known logged-not-fixed issue: continued chats save TWO transcript rows (the pre-continuation
  segment and the full continued conversation) — duplicates in history/review lists.
- Manual-test note: the agent-side "Client closed the chat." flow still wants one live CCP
  test (customer ends chat while an agent is connected; should hold at the notice until the
  agent clicks End chat) — automation can't log into CCP.

Previous batch: `feature/open-account-step-pills` — per-step chat relevance in the
Open an Account wizard. The 8-step wizard lives on one route (`/open-account`) with
`step` in React state, so the chat saw one page for all steps/branches and showed
generic pills. Fix: a `pageContextStore` lets the wizard publish a finer page key per
step + account-type branch (`open-account/type|personal|contact|disclosures|setup-ira|
setup-sep|setup-taxable|funding|dca|review|confirmation`); `ChatWidget` prefers it over
`pageKeyFromPath`. Added 14 ungated `t-oa-*` topics (56 Q&A) mapped to those keys, plus
two new help pages (`/help/account-application`, `/help/privacy`). Repointed in-flow
answer links off `/open-account` (same-route navigate = no-op = "link did nothing").
Follow-up (`feature/open-account-back-forward`): the wizard's `step` (and terminal
`done` flag) are now driven by URL query params (`?step=N` / `?done=1`) via
`useSearchParams` instead of `useState`, so the browser Back/Forward buttons step through
the wizard and it survives refresh. All form state stays in component state (a query-param
change doesn't unmount the page), and `goTo`/`handleSubmit` push merged params. Single-file
change in `OpenAccountPage.tsx`; the per-step pills above are unaffected.

Previously in flight: `feature/continue-this-chat` — "Continue this chat" resume capability.
- Customer chat shows a card (above the topic pills) when the client had a live-agent chat in the
  last 7 days: date + one-sentence intent + "Continue this chat". Click → in-card loading
  annotations → `/agent-availability` checks if the *specific previous agent* is on queue → choose
  "wait for them" vs "first available" (or auto first-available if unavailable). Purely additive;
  degrades to the exact prior UI when there's no recent agent chat.
- Continuation memory = `lastAgentChat` attribute on the Clients table, written by `save-transcript`
  at chat end, cleared by `reset-all-data` (transcripts log is untouched).
- On agent accept, the prior transcript loads into the column above a "↩ Continued chat" divider
  (`loadContinuationTranscript` in `useConnectStreams.ts`).
- Routing for "wait for that agent" is currently **best-effort + metadata** (preferredAgentUsername
  on the contact); **true per-agent Connect routing is a documented follow-up** — see the plan file
  `~/.claude/plans/enchanted-singing-puzzle.md` ("Future work: TRUE per-agent routing").

Recent shipped features (last several PRs):
- Realistic account-opening flow (current branch `feature/bob-pod-episode-3`): `OpenAccountPage.tsx` rewritten as an 8-step wizard (account type → personal info → contact/address → FINRA/SEC disclosures → account-type-specific setup → funding + initial investment → free DCA opt-in → review/agreements/e-signature) with a confirmation timeline; account-type-aware branching (IRA beneficiaries w/ 100% allocation check, SEP business info, taxable joint owner + TOD). "Open an account" pill button added to the Portfolio page header. 4 new open-account KB topics (t-oa-funding, t-oa-dca, t-oa-disclosures, t-oa-sep) + expanded `EXTRA_PAGE_TOPICS['open-account']` to 8 topics. Chat FAB already global (App.tsx renders ChatWidget outside Routes).
- Prompt quality improvements (PR 42): account type labels, capability claims rule, no-repeat/frustrated-yes rule; also heuristic management UI + editable heuristics.json store
- On-demand LLM tool calling (PR 41): all three AI systems (customer bot, NBR, autopilot task experts) can fetch client data from DynamoDB via OpenAI function calling; two-phase agentic loop (tool gather → json_object reformat); 7 tools in `lambda/shared/client-tools.ts`; rotating TypingIndicator messages; "Data fetched from your account" annotation; hallucination protection rule in all system prompts; customer-bot cannot imply it can process account changes
- DB-driven portal (PR 40): all client data in DynamoDB; reset-all-data Lambda; 9 execute-task tasks upgraded to real writes; fetchAll() in clientStore; "↺ Reset all" button in TopNavV2
- Idle-check auto-trigger (PR 39): 3-min timer when agent asks question; fix Accept/Close in dev StrictMode

In-flight (uncommitted on `heqya/generalize`):
- Scenarios + app-profile management in dashboard (CRUD + AI generation via GPT)
- Transcript viewer in report modal (conversations tab shows full turn-by-turn transcripts)
- Per-heuristic threshold system: each heuristic has a `threshold` pass-rate field; reporter checks all, includes failures in NEXT_FIX.md
- start-chat fix: passes clientName explicitly to Nova Micro to prevent beneficiary-name confusion

---

## Important Rules

1. `OPENAI_API_KEY` lives in SSM (`bobs-openai-api-key`) and resolves at deploy time — no shell var needed
2. Never push directly to main — always use a PR
3. When modifying `FORBIDDEN_TOPICS`, remember it affects ALL 19 task experts simultaneously
4. Deploy the backend ONLY via `npm run deploy:lambda` / `npm run deploy -- …` (guarded: typecheck + cdk diff + destroy-guard). Never raw `cdk deploy`. Never deploy a branch that's behind prod (see Deployment section)
5. Lambda changes are live immediately after deploy; frontend changes require gh-pages push or PR merge
6. **Update this file and `docs/PRODUCT.md` whenever making significant architectural changes**

---

## Self-Maintenance Instruction

Whenever you make changes that affect architecture, task list, deployment, or significant behavior, update the relevant section of this file and `docs/PRODUCT.md`. Keep updates narrow — only touch the section that changed. The "Active Branch / Current State" section should be updated at the start of each significant feature batch and cleared/moved when the branch merges.
