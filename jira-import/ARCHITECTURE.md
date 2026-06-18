# Vanguard AI-Assisted Service Platform - Architecture

Companion to the [backlog](./README.md). Diagrams are authored in **Mermaid** (render inline on GitHub /
GitLab / Confluence / Jira) and exported to **SVG** so they stay crisp at any zoom and open in any browser -
see [`diagrams/`](./diagrams). Five views:

1. System overview (color-coded, with a numbered walkthrough) + the **How it works** narrative
2. Runtime sequence - autopilot task collection + agent approval
3. Runtime sequence - escalation and live-agent handoff
4. Data model (DynamoDB)
5. Environments & CI/CD

> **The platform in one sentence:** two React SPAs (an investor portal+chat and an agent console) talk to a
> fleet of AWS Lambdas behind an HTTP API; an autopilot Lambda drives every AI chat turn (Bedrock Nova Micro
> + OpenAI GPT), agents approve the resulting actions, and everything persists in DynamoDB - all serverless.

### Legend

| Color | Layer | | Symbol | Meaning |
|---|---|---|---|---|
| 🟦 Blue | Client tier (React SPAs) | | ①..⑨ gold circle | a step in the **How it works** walkthrough below |
| 🟩 Teal | Connectivity (Connect, API Gateway) | | solid line | request / data flow |
| 🟪 Indigo | Backend (AWS Lambda) | | dotted line | logging / secrets (cross-cutting) |
| 🟪 Purple | AI models | | | |
| 🟧 Amber | Data stores (DynamoDB) | | | |
| ⬜ Gray | External / infrastructure | | | |

---

## 1. System overview

Edges are kept light so the **gold numbered callouts** trace the main request lifecycle; the dense
"which Lambda uses which table/model" detail is captured in the [access matrix](#component-access-matrix)
below (a table reads cleaner than many crossing lines). Full message-by-message flows are in Diagrams 2-3.

```mermaid
%%{init: {'flowchart': {'wrappingWidth': 900}}}%%
flowchart LR
  classDef client fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A
  classDef edge fill:#CCFBF1,stroke:#0D9488,color:#134E4A
  classDef svc fill:#E0E7FF,stroke:#4F46E5,color:#312E81
  classDef ai fill:#F3E8FF,stroke:#9333EA,color:#581C87
  classDef data fill:#FEF3C7,stroke:#B45309,color:#78350F
  classDef ext fill:#F1F5F9,stroke:#64748B,color:#334155
  classDef callout fill:#FACC15,stroke:#A16207,color:#422006,stroke-width:2px
  classDef note fill:#FFFBEB,stroke:#A16207,color:#422006,text-align:left

  subgraph T1["Client tier - React SPAs"]
    investor(["Investor"]):::client
    cust["Customer SPA<br/>chat + portal"]:::client
    agentapp["Agent SPA<br/>CCP desktop"]:::client
    agent(["Service Agent"]):::client
  end
  subgraph T2["Connectivity"]
    connect["Amazon Connect<br/>chat + CCP"]:::edge
    api["API Gateway<br/>HTTP API"]:::edge
  end
  subgraph T3["Backend - AWS Lambda"]
    autopilot["autopilot-turn<br/>scopes + 19 experts"]:::svc
    assist["AI assist<br/>intent / questions / NBR"]:::svc
    startchat["start-chat"]:::svc
    exec["execute-task"]:::svc
    acwsave["generate-acw +<br/>save-transcript"]:::svc
    funds["get-funds +<br/>market-data"]:::svc
    cbk["callbacks +<br/>EventBridge"]:::svc
  end
  subgraph T4["AI models"]
    nova["Bedrock<br/>Nova Micro"]:::ai
    openai["OpenAI GPT<br/>gpt-4o / mini"]:::ai
  end
  subgraph T5["Data & external"]
    db[("DynamoDB<br/>5 tables")]:::data
    ext["Market data / Paging<br/>SSM / CloudWatch"]:::ext
  end

  c1(("1")):::callout
  c2(("2")):::callout
  c3(("3")):::callout
  c4(("4")):::callout
  c5(("5")):::callout
  c6(("6")):::callout
  c7(("7")):::callout
  c8(("8")):::callout
  c9(("9")):::callout

  steps["1  Investor opens chat in the Customer SPA<br/>2  start-chat opens an Amazon Connect session (ChatJS)<br/>3  Each message goes via API Gateway to autopilot-turn<br/>4  AI identifies the task and collects fields (Nova Micro + GPT-4o)<br/>5  Connect routes escalations to an agent (CCP desktop)<br/>6  Autopilot hands the agent a Proposed Action (with evidence)<br/>7  execute-task writes to DynamoDB or mocks it, returning REF-XXXXXX<br/>8  Confirmation card returns to the customer via Connect<br/>9  On chat end, generate-acw and save-transcript persist the record"]:::note
  db ~~~ steps

  %% --- main request lifecycle (numbered) ---
  investor --> c1 --> cust
  cust --> c2 --> connect
  cust --> c3 --> api
  api --> autopilot
  autopilot --> c4 --> nova
  autopilot --> openai
  connect --> c5 --> agentapp
  agent --> agentapp
  autopilot --> c6 --> agentapp
  agentapp --> api
  api --> exec
  exec --> c7 --> db
  exec --> c8 --> connect
  agentapp --> acwsave
  acwsave --> c9 --> db

  %% --- supporting flows ---
  api --> startchat --> connect
  api --> assist --> nova
  cust --> funds --> db
  funds --> ext
  api --> cbk
  acwsave -.-> ext

  linkStyle default stroke:#94A3B8,stroke-width:1px
  linkStyle 0 stroke-width:0px,stroke:none
```

### How it works (numbered walkthrough)

The gold circles ①..⑨ above mark each step of the primary lifecycle:

1. **Open chat.** The investor opens the chat widget on any portal page (Customer SPA).
2. **Start session.** The SPA creates an Amazon Connect chat session (`start-chat`) and connects over ChatJS.
3. **Each turn hits the API.** Every customer message flows Customer SPA -> API Gateway -> `autopilot-turn`
   (stateless, one invocation per message).
4. **AI identifies + collects.** `autopilot-turn` uses **Bedrock Nova Micro** (fast intent classification,
   the pre-agent bot) and **OpenAI GPT-4o** (the 19 task experts) to identify the task and collect every
   required field, reactively.
5. **Escalate to a human.** When a person is needed, Amazon Connect routes the contact to an available
   agent's CCP desktop (Agent SPA), with the AI-generated intent summary + suggested greeting attached.
6. **Proposed Action to the agent.** Once all fields are confirmed, autopilot hands the agent a Proposed
   Action card (with transcript evidence highlighting); the agent reviews and edits.
7. **Execute + persist.** On approval, `execute-task` writes to DynamoDB (real for beneficiaries / auto-
   invest / RMD; a realistic mock confirmation otherwise) and returns a `REF-XXXXXX` reference.
8. **Confirm to the customer.** The confirmation is pushed back to the customer's chat as a green card via
   Amazon Connect (`send-agent-message`).
9. **Wrap up.** When the chat ends, `generate-acw` produces the wrap-up code / summary / coaching and
   `save-transcript` persists the full record (+ continuation memory) to DynamoDB.

**Supporting flows (not numbered):** AI assist (`predict-intent` / `predict-questions` /
`next-best-response`) powers the chat pills + the agent's suggestions; `get-funds` / `market-data` supply
fund data; callbacks (`schedule-callback` / `execute-callback` via EventBridge) handle phone callbacks; all
Lambdas log to CloudWatch and read secrets from SSM at deploy.

### Component access matrix

What each Lambda touches (this is the detail intentionally kept out of the diagram to avoid crossing lines):

| Lambda(s) | DynamoDB | AI model | Other |
|---|---|---|---|
| `autopilot-turn` | Clients (read, via tools) | Nova Micro + GPT-4o | Amazon Connect |
| `start-chat` | Sessions (write) | Nova Micro | Amazon Connect |
| `execute-task` | Clients (write), Transactions (write) | - | - |
| `client-data` | Clients (r/w), Transactions (r/w) | - | - |
| `save-transcript` | Transcripts (write), Clients (write) | Nova Micro (recap) | - |
| `get-transcripts`, `pin-transcript` | Transcripts (r/w) | - | - |
| `predict-intent`, `predict-questions`, `next-best-response` | - | Nova Micro | - |
| `generate-acw` | - | Nova Micro | - |
| `get-funds`, `reset-funds` | Funds (r/w) | - | - |
| `market-data` | - | - | Market-data provider |
| `schedule-callback`, `execute-callback` | - | - | EventBridge Scheduler |
| `send-agent-message`, `agent-connection`, `agent-availability` | - | - | Amazon Connect |
| `client-log` | - | - | On-call paging |
| `reset-all-data`, `reset-beneficiaries` | Clients (write), Transactions (write) | - | - |

### Where the 9 backlog Features live

| Feature (backlog) | Primary components |
|---|---|
| Client Self-Service Portal | Customer SPA (portal pages), `client-data`, DynamoDB Clients/Transactions |
| Conversational AI Assistant (Client Chat) | Customer SPA (chat), Amazon Connect (ChatJS), `start-chat`, `autopilot-turn` (full-auto) |
| AI Autopilot Engine | `autopilot-turn` (scopes + 19 experts), Bedrock Nova Micro, OpenAI GPT |
| Agent Workspace | Agent SPA (CCP desktop), `agent-connection`, `send-agent-message`, `generate-acw` |
| Task Execution & Fulfillment | `execute-task`, DynamoDB Clients/Transactions |
| Knowledge & Predictive Assistance | `predict-intent`, `predict-questions`, `next-best-response`, shared KB |
| Callback Scheduling | `schedule-callback`, `execute-callback`, EventBridge Scheduler |
| Fund Catalog & Market Data | `get-funds`, `reset-funds`, `market-data`, DynamoDB Funds |
| Platform, Infrastructure & Delivery | AWS CDK, GitHub Actions (OIDC), DynamoDB, SSM, CloudWatch, Budget |

---

## 2. Runtime sequence - autopilot task collection + agent approval

The core "AI does the work, the agent does the judgment" loop (autopilot `get-intent` scope). Expands
callouts ③-⑧ above into the message-by-message flow.

```mermaid
sequenceDiagram
  autonumber
  actor C as Investor
  participant UI as Customer SPA
  participant API as API Gateway
  participant AP as autopilot-turn
  participant LLM as Nova Micro / GPT-4o
  participant AG as Agent SPA
  participant EX as execute-task
  participant DB as DynamoDB

  C->>UI: types a request
  UI->>API: POST /autopilot-turn (get-intent)
  API->>AP: invoke
  AP->>AP: Phase 1 - keyword match (matchTaskByIntent)
  alt keywords miss
    AP->>LLM: classify intent
    LLM-->>AP: taskId
  end
  loop until all fields confirmed
    AP->>LLM: Phase 2 - task-expert turn
    LLM-->>AP: reply (+ proposedAction when complete)
    AP-->>UI: reply / typing
  end
  Note over AP: safety guard - never exit without a proposedAction
  AP-->>AG: proposedAction (agent column)
  AG->>API: POST /autopilot-turn (locate-evidence)
  API->>AP: validate spans vs transcript
  AP-->>AG: evidence highlights
  AG->>API: agent approves -> POST /execute-task
  API->>EX: execute
  EX->>DB: write (real) or return mock confirmation
  EX-->>AG: REF-XXXXXX + confirmation
  AG->>API: POST /send-agent-message
  API-->>UI: green confirmation card
```

> **Type 3 (client-submitted) variant:** instead of the agent submitting, the agent's card reads "Send to
> client"; the customer approves it in their own chat, then the agent app runs the identical execute path.

---

## 3. Runtime sequence - escalation & live-agent handoff

Expands callout ⑤ (and ⑨, the wrap-up).

```mermaid
sequenceDiagram
  autonumber
  actor C as Investor
  participant UI as Customer SPA
  participant AP as autopilot-turn (full-auto)
  participant SC as start-chat
  participant CN as Amazon Connect
  participant AG as Agent SPA (CCP)
  participant ACW as generate-acw
  participant ST as save-transcript

  C->>UI: question (pre-agent bot)
  UI->>AP: full-auto turn
  AP-->>UI: answer / self-service link
  C->>UI: "talk to an agent"
  UI->>SC: escalate
  SC-->>UI: intentLabel + intentGreeting
  UI->>CN: route to agent queue
  CN->>AG: incoming contact (+ intent summary, accounts)
  AG-->>C: live chat (with autopilot assist + suggested replies)
  C-->>AG: ...conversation...
  AG->>ACW: on end -> wrap-up code + summary + coaching
  AG->>ST: save transcript (+ lastAgentChat continuation memory)
```

---

## 4. Data model (DynamoDB)

```mermaid
erDiagram
  CLIENTS ||--o{ SESSIONS : "opens"
  CLIENTS ||--o{ TRANSCRIPTS : "has"
  CLIENTS ||--o{ TRANSACTIONS : "has"

  CLIENTS {
    string clientId PK
    string name
    list accounts
    list holdings
    list beneficiaries
    list autoInvest
    map rmd
    map lastAgentChat
  }
  SESSIONS {
    string contactId PK
    string clientId
    string status
    number expiresAt "TTL 30 days"
  }
  TRANSCRIPTS {
    string transcriptId PK
    string clientId "GSI clientId-savedAt-index"
    list messages
    string summary
    string wrapUpCode
    string agentName
    bool pinned
  }
  TRANSACTIONS {
    string clientId PK
    string txnSort PK "sort key: ISOdate + seq"
    string acctKey "GSI account-index"
    number amount
    string status
  }
  FUNDS {
    string ticker PK
    string name
    number expenseRatio
    string riskLevel
  }
```

---

## 5. Environments & CI/CD

```mermaid
flowchart TB
  classDef dev fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A
  classDef gate fill:#FEF3C7,stroke:#B45309,color:#78350F
  classDef prod fill:#DCFCE7,stroke:#16A34A,color:#14532D
  classDef stop fill:#FEE2E2,stroke:#DC2626,color:#7F1D1D

  branch["Feature branch"]:::dev -->|"npm run deploy:dev"| devenv["DEV env<br/>(-dev tables + API, ~$0 idle)"]:::dev
  branch -->|"open PR"| ci["GitHub Actions PR gate<br/>build apps + tsc CDK + bundle Lambdas"]:::gate
  ci -->|"merge"| main["main == PRODUCTION"]:::prod
  main --> gha["GitHub Actions (OIDC)"]:::gate
  gha --> guard["safe-deploy.mjs<br/>typecheck + cdk diff + destroy-guard"]:::gate
  guard -->|"no destructive diff"| cdkdeploy["CDK -> PROD backend"]:::prod
  guard -.->|"REMOVE/REPLACE detected"| abort["ABORT<br/>(unless ALLOW_DESTROY=1)"]:::stop
  gha --> fe["Deploy frontends -> gh-pages<br/>customer (root) + agent (/agent)"]:::prod
  cdkdeploy --> prod["PROD env<br/>tables + API + Lambdas"]:::prod
  fe --> prod
```

---

## Viewing / exporting

- **Best for zoom / sharing:** open the **SVG** files in [`diagrams/`](./diagrams) in any browser - vector,
  so they stay sharp at any zoom level. PNGs are included as a fallback.
  - `1-system-overview` · `2-autopilot-sequence` · `3-escalation-sequence` · `4-data-model` · `5-cicd-environments`
- **Inline:** GitHub / GitLab / Confluence / Jira (with Mermaid) render the diagrams above in place; in VS
  Code use the "Markdown Preview Mermaid Support" extension.
- **Re-render after edits** (SVG + PNG):
  ```
  npx -y @mermaid-js/mermaid-cli -i ARCHITECTURE.md -o diagrams/arch.svg -t neutral -b white
  npx -y @mermaid-js/mermaid-cli -i ARCHITECTURE.md -o diagrams/arch.png -t neutral -b white
  ```
  (add `-p puppeteer-config.json` in sandboxed/root environments - it passes `--no-sandbox`.)
