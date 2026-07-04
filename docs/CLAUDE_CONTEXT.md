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
├── phone-agent-app/       React SPA — phone-agent "Callback Console" cockpit (/chatmaxxing/phone)
│   └── src/
│       ├── components/    DossierView, LiveCallConsole (voicebot overlay), LiveCallPanel (live
│       │                  transcript + Teleprompter), GuidedScript (editable ScriptPreview),
│       │                  TranscriptFlipper (FlipperRow), AfterCallWork, UpcomingCallsBoard
│       ├── store.ts       Zustand: call state machine (ring→connecting→live→wrapup), scriptDrafts
│       ├── actors.ts      Universal actor colours (client/agent/bot/system)
│       ├── speech.ts      Web Speech API (listen + continuous live transcription)
│       └── dossier.ts     normalizeDossier + AGENT_NAME (John Ferrara placeholder)
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
│   ├── schedule-callback/ Creates EventBridge scheduled callback; fire-and-forget invokes prep-callback
│   ├── execute-callback/  Fires when callback time arrives
│   ├── prep-callback/     Agentic AI call-prep: researches the ask → writes the cockpit dossier
│   ├── agent-callbacks/   Phone-cockpit data API (list/get/complete/seed-demo/suggest)
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
└── .gh-pages-deploy/      gh-pages worktree (gitignored). NOT for app frontends (those deploy via
                           Actions) — only the gh-pages-only transcripts/ review tool.
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
| `schedule-callback` | Create EventBridge callback event; fire-and-forget invoke `prep-callback`. Also persists a link to the originating conversation — `originMessages` (the chat captured at scheduling time, since the transcript isn't saved until chat end) + `originTranscriptId` — so `prep-callback` can show the REAL transcript in the cockpit instead of a fabricated one. Accepts `scheduledTimeET` (an Eastern-Time wall-clock `YYYY-MM-DDTHH:mm`) and resolves it to the true UTC instant server-side via `fromZonedTime` (DST-safe), so time-slot pickers don't do TZ math. **Two callers:** the agent app (autopilot `callback` scope) and the customer chat's self-service scheduler (`customer-app/.../chat/CallbackScheduler.tsx`) — the latter now sends the **active persona** (`clientStore.activePersona`) + `clientName` + the live bot chat, not the old hardcoded `MOCK_CLIENT`. | No |
| `execute-callback` | Fire on scheduled callback time | No |
| `prep-callback` | **Agentic call-prep** for the phone cockpit: runs `invokeWithTools` over `client-tools.ts` (deeper iteration cap, latency-insensitive) to research the client's ask and write the `dossier` onto the callbacks-table item — worked answer + findings + gap list, coaching, a branching **editable** guided script, the **originating transcript** (the REAL conversation that led to the callback — see below — with LLM-marked highlight spans; falls back to a fabricated stand-in only for demo/seed callbacks with no real source), resources, client snapshot. The **intent headline + board `intentSummary`** are summarized from the REAL conversation via the SAME shared summarizer the live-agent escalation uses (`lambda/shared/intent-summary.ts` → `summarizeChatIntent`, i.e. `start-chat`'s `intentLabel` prompt), so they capture the client's underlying goal — not their last throwaway line — and the good summary is written back to `intentSummary` so the Upcoming-Calls board card updates too. Derives YTD returns from `balanceHistory`; honors client `pronouns`. | Yes — OpenAI |
| `agent-callbacks` | Phone-cockpit data API. POST `/agent-callbacks` action-based: `list` / `get` (lazy-preps if missing) / `complete` / `seed-demo` / `suggest` (LLM writes the teleprompter's next line) | Yes — OpenAI (`suggest`) |
| `reset-beneficiaries` | Dev: reset test client beneficiary data | No |
| `reset-all-data` | Dev: reset ALL fields for all 4 clients to defaults | No |
| `get-funds` | Read the static fund catalog (all 36 funds) from `bobs-funds`; GET `/funds`, module-cached 60 min | No |
| `reset-funds` | Seed `bobs-funds` from the bundled catalog; GET `/reset-funds?key=bobs-reset-2025` | No |
| `tts` | OpenAI text-to-speech for the "Talk to Bob" voice feature (POST `/tts` `{text,voice,instructions}` → base64 mp3) | No (OpenAI audio API) |
| `verify` | Real email/SMS verification for the My Account hub. POST `/verify` `{action,clientId,target,code?}`; `send-*-code` stores a hashed 6-digit code (TTL 10 min, `bobs-verification-codes`) and sends via **Amazon SES** (email) / **AWS End User Messaging SMS** (text); `confirm-*-code` flips `emailVerified` or the matching `phones[].verified`. Sender identity via SSM `bobs-ses-sender` / `bobs-sms-origination` (resolved at deploy like the OpenAI key; value `unset`/blank ⇒ graceful "not configured") | No |

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
| Autopilot controls (agent app) | `ChatColumn.tsx` — during autopilot the (unused) composer is replaced by a big **Pause Autopilot** button lifted above the green overlay (`zIndex:2`); paused → red **Exit** + green **Resume ▶** (resumes from the remaining time at pause). **There is no column click-to-exit** — autopilot is changed only by these buttons + the `AISupport` ✈ toggle, so clicking/resizing elsewhere never exits it. A live **send countdown** (flashes red in the final 10s, frozen `⏸` while paused) renders via `AutopilotCountdown.tsx` inside the "Autopilot sending…" box in `AISupport.tsx` (grid) + `FocusingDesktop.tsx` (focusing). State on `ContactSlot`: `autopilotPaused` / `autopilotSendAt` / `autopilotPausedRemainingMs`, reset at every autopilot clear/activate site. The `autopilotDelay` waiter is a 250 ms **pause-aware poll loop** (freezes on pause, shifts the deadline on resume) — the two-phase reading+typing delay durations are unchanged. |
| Typing indicators (both directions) | Customer→agent: `useChatSession.ts` (`notifyTyping`, `onTyping`) + `ChatInput.tsx`; agent shows it in `useConnectStreams.ts` (`chatSession.onTyping` → `slot.customerTyping`) + `ChatColumn.tsx` (`TypingDots`, 30s expiry). Agent→customer: `ChatColumn.tsx` (manual keystrokes + autopilot `autopilotSend` → `/send-agent-message` `event:'typing'`); customer shows it via `agentTyping` (60s expiry) in `ChatBody.tsx`. Autopilot cancel sends the `__BOBS_TYPING_STOP__` sentinel to clear it promptly. `autopilotSend` runs two phases via `autopilotDelay`: a **reading delay** (ellipsis hidden; `2000ms + 10ms×(clientMsgLen−200)`, min 2000ms, based on the client's most recent message) then the existing **typing delay** (`chars/15`s, ellipsis shown). Chat avatar: bot turns show **"B"** (navy); once a live agent is connected, agent bubbles + the typing ellipsis show the **agent's initials** (accent color) via `chatStore.agentName` (`initialsFromName` in `utils/initials.ts`). The agent sends its **full name** (first + last) on connect as a `__BOBS_AGENT_NAME__` control message (`useConnectStreams.ts`, intercepted/not rendered) because Connect's chat `DisplayName` is only the agent's first name; a multi-word `DisplayName` is a fallback. |
| Customer chat history (hamburger ☰ in chat header) | `ChatPanel.tsx` (view state chat/history/transcript; ☰ replaced the "B" logo, ← goes back), `ChatHistoryView.tsx` (90-day card list via `GET /get-transcripts?clientId=` + read-only transcript via `?transcriptId=` + Download; **only rows with the second-person `summary` recap are listed** — no fallback; **pin/unpin button** on each card → `POST /pin-transcript`; pinned cards sorted first + `primarySoft` bg section), `lambda/save-transcript` (stores `summary` on the row), `lambda/get-transcripts` (list projection incl. `summary, acwSummary, agentName, pinned`), `lambda/pin-transcript` (sets `pinned` on transcript row) |
| Chat end-of-life (minimize/close/persist; customer-left detection) | Customer: `ChatPanel.tsx` (minimize btn + close-confirm dialog), `chatStore.ts` (sessionStorage `persist`, `minimized`/`unreadCount`/`chatEnded`), `useChatSession.ts` (reconnect-on-load + `endChat()` real disconnect + stale-session guard on `onEnded`), `ChatBody.tsx` + `utils/transcriptDownload.ts` (Download transcript on chat end). Agent: `useConnectStreams.ts` (`participant.left` EVENT in `chatSession.onMessage` → `slot.customerDisconnected`; chatjs routes unmapped event types to onMessage), `ChatColumn.tsx` + `FocusingDesktop.tsx` ("Client closed the chat." notice + End chat → `bobs:endChat` → ACW; composer disabled) |
| Proposed Action card | `agent-app/src/components/ProposedActionCard.tsx` (Type 1 = "Submit Action"; Type 3 = "Send to client" → waiting note). Submit body shared via `agent-app/src/utils/submitProposedAction.ts` (reused by the Type 3 relay in `useConnectStreams.ts`). |
| Task submission type (who may submit) | `lambda/shared/tasks.ts` → `Task.submissionType` (`'agent'` default / `'licensed-agent'` reserved / `'client'` = Type 3). Stamped onto `proposedAction` in `autopilot-turn/handler.ts` (`withSubmissionType`, both return sites). `add-account-access` is the only `'client'` task. |
| Type 3 client approval flow | Agent `ProposedActionCard` "Send to client" → `__BOBS_APPROVAL_FORM__` control msg → customer `useChatSession.ts` renders `ApprovalFormCard.tsx` (via `chatStore.approvalForm`, threaded through ChatWidget/ChatPanel/ChatBody) → customer Submit sends `__BOBS_CLIENT_APPROVED__` back → agent `useConnectStreams.ts` runs the shared submit (confirmation identical to Type 1). Sentinels: `__BOBS_APPROVAL_FORM__`/`__BOBS_APPROVAL_CANCEL__` (agent→customer), `__BOBS_CLIENT_APPROVED__`/`__BOBS_CLIENT_DECLINED__` (customer→agent). |
| Proposed-action evidence highlighting | Lambda: `locate-evidence` scope in `autopilot-turn/handler.ts` (`locateEvidence`, `LOCATE_EVIDENCE_PROMPT`). Frontend: `ChatColumn.tsx` (`evidencePromise` in `runAutopilotTurn`, `bobs:evidenceJump` listener, `MessageBubble` highlights) + same render half in `FocusingDesktop.tsx` (`FocusMessageBubble`) + ⌖ buttons in `ProposedActionCard.tsx` + `utils/evidenceHighlight.tsx` (span renderer) + `EvidenceSpan`/`proposedActionEvidence` in `types/index.ts`. Highlights/⌖ only render while the card is visible; evidence is keyed by message `id` and cleared on submit/reject. |
| Client chat rendering | `customer-app/src/components/chat/ChatMessage.tsx` |
| Client routes | `customer-app/src/App.tsx` |
| My Account hub (DB-driven, editable) | Page `customer-app/src/components-v2/pages/account/AccountPage.tsx` is a hub composed of section components in `account/sections/` (`ProfileHeader`, `ContactInfoSection` [multi-phone + email + verify], `PersonalDetailsSection`, `SecuritySection`, `AuthorizedAgentsSection` [view-only/limited/full], `CommunicationSection`+`SmsConsentPanel` [TCPA/CTIA], `BankingSection` [micro-deposit verification], `TrustedContactSection`, `InvestorProfileSection`, `WatchlistSection`, `AgreementsSection` [opens real PDFs via `utils/pdf.ts`], `AccountServicesGrid`, `VerifyCodeModal`, shared `ui.tsx` incl. `ConfirmDialog`/`ModalShell` [intercepts drastic actions like bank/agent removal]). Data: new attributes on the `bobs-clients` item (`phones, emailVerified, personal, security, preferences, bankAccounts, trustedContact, investorProfile, watchlist, agreements, authorizedAgents`) typed in `customer-app/src/data/personas.ts` + `lambda/shared/client-defaults.ts`, seeded for all 4 personas + reset by `reset-all-data`. Reads via `client-data` `get-all`; **all edits use one generic `put-account-settings` action** (allowlisted dynamic SET). Store: `clientStore` `saveAccountSettings`/`toggleWatchlist`/`sendVerifyCode`/`confirmVerifyCode` (legacy `phone`/`displayPhone`/`email` kept in sync from the primary mobile). Cross-page hooks: RiskQuizPage "Save to my profile" → `investorProfile`; FundProfilePage ★ Watch toggle → `watchlist`. Phone masking via shared `customer-app/src/utils/mask.ts`. SMS Terms page `help/SmsTermsPage` (`/help/sms-terms`). Real verification = the `verify` Lambda (see Lambda Map). |
| Tools / calculators suite | Customer-facing `/tools` hub + 5 interactive calculators. Pages: `customer-app/src/components-v2/pages/tools/` (ToolsHubPage, FeeCalculatorPage, GrowthCalculatorPage, DcaCalculatorPage, RothVsTraditionalPage, RiskQuizPage). Shared layout/inputs/format helpers: `customer-app/src/components-v2/tools/` (`ui.tsx`, `inputs.tsx`, `format.ts`). Routes in `App.tsx` (`/tools`, `/tools/{fees,growth,dollar-cost-averaging,roth-vs-traditional,risk-profile}`); discoverable via the Library **Reference Library → Retirement & Tax Planning** link labeled "Tools & Calculators" (`LibraryPage.tsx` `REFERENCE`), which replaced the old direct Retirement Calculator link (that calculator is now reached through the hub). NOT in the global `TopNavV2` nav. Charts via **recharts**; all figures hard-sourced from `funds.ts` + `kb.ts` facts. Self-contained (does not import from RetirementCalculatorPage) so it's purely additive. |
| "Talk to Bob" voice assistant (experimental, flag-gated, customer-only) | Voice chat over the existing brain. **Feature-flag framework:** `customer-app/src/store/featureFlagsStore.ts` (localStorage, default off, extensible `EXPERIMENTS` registry) + `components-v2/common/ToggleSwitch.tsx` (mirrors the agent "On queue" toggle, `agent-app/.../TopBar.tsx`), surfaced in an **Experimental features** section of the `TopNavV2` avatar dropdown. **Voice code (all lazy-loaded; only when the flag is on):** `hooks/useVoice.ts` (Web Speech STT + mic AnalyserNode + OpenAI-audio-with-`speechSynthesis`-fallback), `components-v2/voice/*` (`TalkToBobOverlay` centerpiece, `VoiceOrb` canvas, `VoiceAnswerCard` balance/allocation/holding cards derived from `activePersona`, `voiceTts`→`/tts`, `voiceText`, `voiceCards`, `VoiceLaunchFAB`), `store/voiceStore.ts` (open state) + `store/voiceSettingsStore.ts` (user voice/character settings — the ⚙ Voice panel + presets). Mounted gated+lazy in `ChatWidget`; in-panel mic in `ChatInput`. **Brain = existing `/autopilot-turn`** (scope `customer-bot`, so it inherits `FORBIDDEN_TOPICS` — advice questions get a spoken compliant decline). **Backend:** `lambda/tts` (OpenAI `/v1/audio/speech`; POST `{text,voice,instructions}`). **Default voice = an "elderly gentleman" character** (`ash` + a punctuation-literal prompt), tunable per-env (`OPENAI_TTS_VOICE` / `OPENAI_TTS_INSTRUCTIONS`) or per-browser (the ⚙ Voice panel). OFF by default → no voice chunk loads, nothing runs. |
| Transaction tables + history + status | Data: `bobs-transactions` table (`cdk/lib/data-stack.ts`), generator `lambda/shared/transaction-history.ts`, statuses `lambda/shared/transaction-status.ts`. API: `lambda/client-data/handler.ts` (`get-recent-transactions`/`get-transactions-page`/`append-transaction`). Frontend: `customer-app/src/data/transactionStatus.ts` (display copy), `components-v2/common/StatusCell.tsx` (dotted-underline popover), `hooks/useRecentTransactions.ts`, recent tables in `PortfolioPage.tsx` + `account/AccountDetailPage.tsx`, full page `components-v2/pages/transactions/TransactionHistoryPage.tsx` (route `/transactions`). Writes: `execute-task/handler.ts` (`appendTransactionRows`). Seed/clear: `reset-all-data/handler.ts`. |
| Research fund lineup (36 funds) | **Canonical source: `customer-app/src/data/funds.ts`** (`FUNDS: FundDef[]`, pure data — keep it React-free). It is the single edit point, the **seed** for the `bobs-funds` DynamoDB table, and the frontend **offline fallback**. At runtime the table is the source of truth: served by `GET /funds` (`lambda/get-funds`, module-cached) and consumed via the **`useFunds()` hook** (`customer-app/src/hooks/useFunds.ts`, localStorage TTL + bundled fallback). Seed/refresh per-env with `GET /reset-funds?key=bobs-reset-2025` (`lambda/reset-funds`). The backend reaches `funds.ts` through the **only** cross-package bridge, `lambda/shared/fund-catalog.ts` (re-exports `FUNDS` + `FUND_PICKLIST`). AI access: the **`get_funds`** tool in `lambda/shared/client-tools.ts` (reads `bobs-funds`, available to bot + NBR + task experts), and task-expert prompts inject `FUND_PICKLIST`. Live prices/returns still come from `lambda/market-data/handler.ts` → `FUND_MAP` (ticker→Vanguard realSymbol, Yahoo quotes), which is now **derived from the catalog** (`FUNDS.map(...)` via `fund-catalog.ts`) — no longer hand-maintained, so it can't drift from the lineup. Pages that show fund data (`/help/fees`, `/help/fund-performance`, `/help/prospectus`, `/resources/tax-efficient-investing`, `OpenAccountPage`, plus Research/`FundProfilePage`) all read via `useFunds()`. |
| Content-page ordering rule | When a page mixes general explanatory content with a long, growing, data-driven list, put the general content **first** so list growth never buries it (e.g. FeesPage: Account Fees above the 36-row expense-ratio table). Long tables get a `maxHeight`+scroll. |
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

**Frontend — CANONICAL: automatic on merge to main.**
GitHub Actions (`deploy-customer-app` / `deploy-agent-app`) build and publish on merge — customer-app
to the gh-pages root, agent-app to `/agent` — stamped with the commit SHA (`window.__BUILD__`).
You do not build/copy frontends by hand.

**Frontend — manual (fallback only).** The `.gh-pages-deploy` worktree (now gitignored) is kept only
for the gh-pages-only **transcripts/** review tool, which has no main-branch source. App frontends go
via Actions; don't hand-deploy them. (To deploy the transcripts tool: edit `.gh-pages-deploy/transcripts/`
and push the gh-pages branch.)

**PR / deploy workflow:** branch off `main` → test on **dev** (`npm run deploy:dev` + `npm run dev`) →
PR (CI gates frontends + CDK typecheck + Lambda bundle) → merge → Actions auto-deploy to prod. Never
push directly to `main`. Full detail + how to see what's live + rollback: `docs/PROCESS.md`.

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
  // ── My Account hub (DB-driven, editable; seeded + reset by reset-all-data) ──
  phones: [{id, type, number, displayNumber, verified, sms:{accountAlerts, marketing, status, consentedAt?, disclosureVersion?, method?}}],
  emailVerified: bool,                 // email itself stays the top-level `email`
  personal: {dateOfBirth, maritalStatus, employmentStatus, employer, occupation, citizenship, memberSince},
  security: {twoFactorEnabled, twoFactorMethod, loginAlerts, lastPasswordChange, recentLogins?},
  preferences: {paperlessStatements, taxDocDelivery, tradeConfirms, prospectusDelivery, proxyDelivery, notifyEmail, notifySms, notifyPush, language, marketing},
  bankAccounts: [{id, bankName, accountType, maskedNumber, primary, verified?, pendingMicroDeposits?}],  // verified via micro-deposits
  trustedContact: {name, relationship, phone, email} | null,
  investorProfile: {riskProfile, riskScorePct, stocksPct, bondPct, cashPct, slices?, goals, timeHorizon, annualIncomeRange, netWorthRange, investmentExperience, updatedAt} | null,
  watchlist: [{ticker, addedAt}],
  agreements: [{id, title, version, type, signedAt, signature}],
  authorizedAgents: [{id, name, relationship, email, level: 'View only'|'Limited'|'Full', addedAt}],
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

Funds Table (`bobs-funds`): static fund-catalog reference data — one item per fund (PK `ticker`),
the full `FundDef` shape (name, group, expenseRatio, riskLevel, descriptions, sectorAllocation,
annualReturns, etc.). Runtime source of truth for content pages and AI; seeded from
`customer-app/src/data/funds.ts` via `GET /reset-funds?key=bobs-reset-2025`. ~36 small items that
change < once/day → read with a single Scan, module-cached in `get-funds` and the `get_funds` tool.
Live prices/returns are NOT stored here (those come from the `market-data` Lambda).

Verification Codes Table (`bobs-verification-codes`): short-lived one-time codes for real
email/SMS verification on the My Account hub. `{ codeId (PK) = "<clientId>#<channel>#<target>",
codeHash (sha256), expiresAt (TTL, ~10 min), createdAt, attempts, channel, target }`. Written +
read only by the `verify` Lambda; rows auto-expire via the `expiresAt` TTL so codes can't be reused.

---

## Live URLs

- Client app: `https://ferrarajc.github.io/chatmaxxing/`
- Agent app: `https://ferrarajc.github.io/chatmaxxing/agent`
- Phone-agent cockpit: `https://ferrarajc.github.io/chatmaxxing/phone`
- API: `https://0y3s5vq2v5.execute-api.us-east-1.amazonaws.com` (prod) · dev `https://1cppcq9q57.execute-api.us-east-1.amazonaws.com`
- Transcript Review: `https://ferrarajc.github.io/chatmaxxing/transcripts/` (append `?env=dev` to review dev/phone transcripts)
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

## Active Branch / Current State (as of 2026-06-30)

**Shipped (PR #106, merged + deployed to prod 2026-06-30): Phone-Agent "Callback Console" cockpit.**
A standalone, **simulation-first** SPA at `/chatmaxxing/phone` where a phone agent preps for and runs
AI-prepped scheduled callbacks — no telephony required, with a clean seam for real Amazon Connect
voice when DID numbers land (still blocked; see the DID saga). **The prep is the star:**
`prep-callback` runs an agentic research pass at scheduling time and writes a grounded `dossier`.

- **Backend (additive; reuses the existing callbacks/transcripts/clients tables):** new `prep-callback`
  + `agent-callbacks` Lambdas (see Lambda Map). `schedule-callback` now fire-and-forget invokes
  `prep-callback`. `save-transcript` accepts `transcriptType:'phone'` (phone calls recorded to the
  Transcript Review UI, which gained channel 💬/📞 + agent columns). Client profiles gained
  **`pronouns`** (honored, never inferred from name) and per-account **`balanceHistory`** (so the AI
  can *derive* metrics like YTD return); `clientSnapshot` gained accountCount / timeHorizon /
  investmentExperience. All in `lambda/shared/client-defaults.ts`, written via `reset-all-data`.
- **Frontend UI model:** base page = fixed-width Upcoming-Calls board (left) + relative-width dossier
  (right). Simulate → ringing (IncomingCallOverlay) → connecting (voicebot overlay: ringback,
  wait-for-hello, branching non-happy paths, mock voice verification, TTS) → **live**: the left column
  swaps the board for the live speech-to-text transcript + a pinned auto-advancing **Teleprompter**
  (executes the agent's edited script); right column stays the dossier. End call → **after-call work**
  in the dossier (wrap-up code + editable summary via `generate-acw`) → Complete & close records the
  transcript and returns to the board. One client at a time.
- **Dossier:** intent headline + originating-transcript flipper; "What I found for you" (answer +
  findings, "Still open" card-in-card, horizontal Recommended-resources tiles, coaching); Client
  snapshot flipper; editable **Script preview** (edits persist in `store.scriptDrafts`, executed live).
- **⚠ Prod-data gotcha:** the pronoun + YTD-derivation fidelity needs prod client data to carry
  `pronouns` + `balanceHistory`, which only land via **`GET /reset-client-data?key=bobs-reset-2025`**
  (run after this deploy). The cockpit still functions without it (pronouns default to they/them,
  YTD asks land in "Still open").
- **Simulation caveat:** free browser STT covers only the local mic, so the sim has a temporary
  Client/Agent/Off mic toggle to role-play both parties; a real Connect call splits two channels
  (Phase-4 transcription-engine decision deferred — Contact Lens vs self-hosted).

---

## Active Branch / Current State (as of 2026-06-17)

**Shipped (PR #103, merged + deployed to prod 2026-06-21): comprehensive My Account hub.**
Rebuilt the thin `/account` page into a full, **fully DB-driven, editable** profile/settings hub
(see the "My Account hub" Key Files row + the new client attributes/table in DynamoDB Schema +
the `verify` Lambda in the Lambda Map). Edit model = optimistic save (like Beneficiaries/RMD) via
one generic `put-account-settings` action; **real** email/SMS verification via the `verify` Lambda.
**Verification delivery is configured via SSM** (`bobs-ses-sender` / `bobs-sms-origination`, resolved
at deploy like the OpenAI key; value `unset`/blank ⇒ graceful "not configured" — never faked):
1. **Email (SES):** verify a sender identity (`aws sesv2 create-email-identity <addr>` then click the
   confirmation link, or a domain identity). To reach arbitrary recipients, request SES production
   access (free, ~24h); or stay in sandbox by also verifying the recipient. Then
   `aws ssm put-parameter --name bobs-ses-sender --value "Bob's <addr>" --type String --overwrite` + redeploy.
   *(Prod sender = `ferrarajc@me.com`, pending the owner clicking the SES confirmation link.)*
2. **SMS (AWS End User Messaging):** provision an origination identity (toll-free ~$2/mo); for the free
   demo path verify the owner's phone in the **SMS sandbox**; set `bobs-sms-origination` to the number/ARN
   + redeploy. Arbitrary numbers later need production access + toll-free/10DLC. *(Currently `unset`.)*

**`main` == production.** No other in-flight feature branches — everything below has merged and deployed. The earlier divergence (work deployed before its PR merged, so
`main` lagged prod) is resolved and structurally prevented. **For how we build/test/ship now,
`docs/PROCESS.md` is canonical** — it supersedes any older "deploy from a laptop / Lambda deploys are
immediate" phrasing elsewhere.

**Shipped (PRs #95–#101): "Talk to Bob" voice assistant (experimental, flag-gated, customer-only).**
An **Experimental features** toggle in the avatar menu (off by default) reveals a full-screen voice
experience: speak → Web Speech STT → existing `/autopilot-turn` brain → spoken answer via **OpenAI TTS**
(`lambda/tts`; browser `speechSynthesis` fallback) + a synchronized balance/allocation/holding card from
`activePersona`. The orb ("the BOrB") pulses on Bob's real syllables (mp3 → Web Audio AnalyserNode). All
voice code is lazy-loaded + flag-gated, so OFF = today's behavior with zero voice cost. An in-overlay
**⚙ Voice settings panel** (presets / base-voice dropdown / free-text character box / Preview, persisted
via `store/voiceSettingsStore.ts`) lets anyone retune live; the **default voice** is an "elderly gentleman"
character (`ash` + a punctuation-literal `instructions` prompt), overridable per-browser (the panel) and
per-env (`OPENAI_TTS_VOICE` / `OPENAI_TTS_INSTRUCTIONS`). User-tested live in prod. See the Key Files
"Talk to Bob" row.

Recently shipped (all merged to `main` + deployed):
- **Tools & calculators suite** (PR #93, frontend-only, 2026-06-17): customer-facing `/tools` hub + 5
  interactive calculators — Cost of Fees, Growth Projector, Dollar-Cost Averaging, Roth vs. Traditional IRA,
  and a Risk Profile quiz (→ a BFTM/BFIN/BFBI allocation). See the "Tools / calculators suite" row in Key
  Files for the file map. Purely additive — the only existing-page change is one swapped Reference link on
  `LibraryPage` (Retirement Calculator → "Tools & Calculators" → `/tools`); not in the global nav, per the
  product owner. Only the `Deploy Customer App` Action fired (CDK/agent deploys are path-filtered).
- **DB-driven fund catalog** (PR #89): the 36-fund lineup is seeded from `customer-app/src/data/funds.ts`
  into the `bobs-funds` DynamoDB table (via the `fund-catalog.ts` bridge); served by `GET /funds`
  (`get-funds`, module-cached) and consumed via the `useFunds()` hook; the `get_funds` tool exposes it
  to bot/NBR/autopilot. Seed/refresh a fresh env with `GET /reset-funds?key=bobs-reset-2025`.
- **Follow-up cleanup** (this batch): `market-data`'s `FUND_MAP` now **derives from the catalog**
  (no more hand-maintained sync); the dead Lex V2 fulfillment block in `predict-intent` was removed
  (Lex disassociated 2026-06-14). The cost incident (Lex + Amazon Q/Wisdom disassociated, Contact Lens
  off) is resolved; `connect-stack.ts` no longer re-enables Contact Lens.
- **Dev/prod environments + CI/CD + guardrails** (PR #86): CDK is stage-parameterized — prod is
  byte-identical, `STAGE=dev` gives an isolated `bobs-*-dev` env for testing before prod
  (`npm run deploy:dev`; local `npm run dev` → dev data via `.env.development`). Prod backend
  **auto-deploys from `main`** via GitHub OIDC (`deploy-cdk.yml` + `BobsCicdStack` role) through the
  destroy-guard (`cdk/scripts/safe-deploy.mjs`, also `npm run deploy:lambda` as manual fallback).
  `BobsBudgetStack` = $15/mo alert. PR check now also typechecks CDK + bundle-checks Lambdas
  (`build` + `backend` both required). Build SHA stamped into both apps.
- **Full transaction history + Status column** (PR #85): transactions live in the dedicated
  `bobs-transactions` table (see DynamoDB Schema); `/transactions` page (filter/search/sort/paginate);
  dotted-underline status popover (`StatusCell.tsx`); decades-deep deterministic seed for all 4
  personas; status exposed to chatbot + autopilot via `get_transactions`.
- **Type 3 client-submitted proposed actions** (PR #84) and **chat history pin/unpin** (PR #83).

Older historical batches (kept for reference) follow.

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
