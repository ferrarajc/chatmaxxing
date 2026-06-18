# Vanguard AI-Assisted Service Platform - Jira Import Pack

A complete, import-ready product backlog for the **Vanguard AI-Assisted Service Platform**: a
client-facing AI chat assistant, a real-time live-agent workspace, and a task-driven AI autopilot
engine, all on AWS serverless infrastructure.

> **Architecture diagrams:** see **[ARCHITECTURE.md](./ARCHITECTURE.md)** - a color-coded system overview
> with a numbered walkthrough, two runtime sequences, the data model, and the CI/CD pipeline. Rendered to
> **zoomable SVG** (+ PNG) in [`diagrams/`](./diagrams) - open the SVGs in any browser.

This pack describes the **entire breadth** of the platform as a four-level hierarchy you can drop
straight into Jira:

```
Feature  ->  Epic  ->  Story  ->  Sub-task
```

| Level | Count | What it is |
|---|---:|---|
| **Feature** | 9 | Big value themes (whole product areas) |
| **Epic** | 53 | Shippable capability groups within a feature |
| **Story** | 116 | User stories ("As a ... I want ... so that ...") with Gherkin acceptance criteria |
| **Sub-task** | 57 | Concrete implementation steps under the heavier stories |
| **TOTAL** | **235** | rows in `vanguard-backlog.csv` |

Every ticket is built to be **shovel-ready**:
- Every **Story** has a user-story description **and Gherkin acceptance criteria** (`Given / When / Then`).
- Every ticket's Description also carries a **technical layer** that tells developers *how* to build it:
  Features carry an `=== ARCHITECTURE & STACK ===` section, Epics a `=== TECHNICAL SCOPE ===` section
  (the modules/contracts/patterns for that capability), and Stories a `=== TECHNICAL DESIGN ===` section
  (approach, data shapes, algorithms, and the real edge-cases/gotchas). 100% coverage: all 9/53/116.
- The global stack, repo layout, and shared contracts these notes reference are in
  **[Technical Foundations & Architecture](#6-technical-foundations--architecture)** below.

---

## 1. Files in this pack

| File | Use it when |
|---|---|
| **`vanguard-backlog.csv`** | **Primary.** All 235 rows, full 4-level hierarchy (Feature -> Epic -> Story -> Sub-task). |
| `vanguard-backlog-no-features.csv` | You are on **any Jira plan** and want the simplest one-pass import. 226 rows: Epics are top-level; each Feature is preserved as the **Component** on every row. |
| `vanguard-features.csv` | The 9 Feature rows only - step 1 of the two-pass **Premium** import (see Path A). |
| `generate-backlog.mjs` | The generator. Edit the backlog as data and re-emit all three CSVs (`node generate-backlog.mjs`). |
| `validate-backlog.mjs` | Re-parses the CSV and checks structure + referential integrity + ASCII (`node validate-backlog.mjs`). |
| **`ARCHITECTURE.md`** | Architecture diagrams (Mermaid): color-coded system overview + numbered walkthrough, two runtime sequences, the data model, and CI/CD. Rendered to zoomable **SVG** (+ PNG) in `diagrams/`. |

The CSV is **comma-delimited, RFC-4180-quoted, pure ASCII, CRLF line endings** - safe for Jira's
importer and for Excel on Windows. Multi-line descriptions and Gherkin are quoted correctly.

---

## 2. Which path should I use?

> **Most teams: use Path B.** It is a clean one-pass import that works on **every** Jira plan
> (Free, Standard, Premium; company- or team-managed). You keep all 9 Features as **Components**, so
> nothing is lost - you just do not get a dedicated "Feature" tier above Epic.
>
> **Only use Path A** if you are on **Jira Premium** and specifically want a literal **Feature**
> hierarchy level *above* Epics (Advanced Roadmaps). Standard/Free Jira has no level above Epic, so a
> row whose Issue Type is `Feature` will not import there - that is the whole reason Path B exists.

---

### Path B - One-pass import (recommended, any plan)

1. Jira: **cog (Settings) -> System -> External System Import -> CSV**
   (or, in a project: **Filters/Backlog -> ... -> Import issues from CSV**).
2. Upload **`vanguard-backlog-no-features.csv`**.
3. Pick the target **Project** and set the CSV delimiter to **Comma**.
4. **Map the fields** (see the table in section 3). The key mappings:
   - `Issue Type` -> **Issue Type**
   - `Summary` -> **Summary**
   - **Modern Jira Cloud:** `Parent` -> **Parent**  *(builds Epic<-Story<-Sub-task in one pass)*
   - **Classic / company-managed:** `Epic Link` -> **Epic Link** and `Parent ID` -> **Parent** (sub-tasks)
   - `Component/s` -> **Components**  *(this is where each Feature theme lands)*
   - `Description`, `Acceptance Criteria`, `Priority`, `Story Points`, `Labels` -> matching fields
5. Tell the importer to use **`Issue ID`** as the row identifier when it asks (so `Parent`/`Parent ID`
   can resolve same-file references).
6. Run the import. You get **Epics -> Stories -> Sub-tasks**, grouped by Component (= Feature).

> Map **either** the modern `Parent` column **or** the classic `Epic Link` + `Parent ID` columns -
> not both. Leave the columns you are not using **unmapped**.

---

### Path A - Two-pass import with a real Feature tier (Jira Premium only)

Premium lets you add a custom hierarchy level (commonly called **Feature** or **Initiative**) above
Epic in **Advanced Roadmaps -> Hierarchy configuration**. Do that first, then:

**Pass 1 - create the Features**
1. Import **`vanguard-features.csv`**, mapping `Issue Type` -> Issue Type (your Feature level) and
   `Summary` -> Summary.
2. After it finishes, Jira shows the **issue keys** it assigned to the 9 Features (e.g. `VANG-1` ...
   `VANG-9`). Note the key for each Feature `Issue ID` (1, 43, 70, ... - see the `Issue ID` column).

**Pass 2 - create everything else and link it up**
3. Import **`vanguard-backlog-no-features.csv`** as in Path B, which builds Epics/Stories/Sub-tasks.
4. Attach Epics to Features one of two ways:
   - **Easiest:** after import, **bulk-edit** Epics by Component and set **Parent** to the matching
     Feature (9 quick bulk edits, one per Feature/Component); **or**
   - **Pre-link:** before pass 2, open `vanguard-backlog.csv`, and in the **`Parent Link`** column
     replace each Feature `Issue ID` with the **key** from pass 1, then map `Parent Link` -> **Parent
     Link** during import.

> If your Jira Cloud importer supports mapping `Parent` to the same-file `Issue ID` across **all**
> levels (most current Cloud sites do), you can skip the two passes entirely: import
> `vanguard-backlog.csv`, map `Parent` -> **Parent**, and the whole Feature->Epic->Story->Sub-task tree
> is built in one go.

---

## 3. Column dictionary & field mapping

| CSV column | Jira field | Notes |
|---|---|---|
| `Issue Type` | Issue Type | `Feature` / `Epic` / `Story` / `Sub-task`. `Feature` requires a Premium hierarchy level (Path A). |
| `Issue ID` | *(row id only)* | Unique within the file. Used to resolve `Parent` / `Parent ID` / `Parent Link`. Not stored as a Jira field. |
| `Parent ID` | Parent | **Classic** sub-task -> parent **Story** (the Story's `Issue ID`). |
| `Epic Link` | Epic Link | **Classic** Story -> Epic, by the Epic's **Epic Name**. |
| `Epic Name` | Epic Name | Set on Epic rows; the value `Epic Link` points at. Unique per epic. |
| `Parent Link` | Parent Link | **Classic** Epic -> Feature (Advanced Roadmaps). Holds the Feature `Issue ID`; swap for the key in Path A. |
| `Parent` | Parent | **Modern unified** pointer: every non-Feature row -> its direct parent's `Issue ID`. Map this alone on current Jira Cloud. |
| `Summary` | Summary | Issue title. |
| `Component/s` | Components | The owning **Feature** name - preserves grouping when Features are not imported as issues. |
| `Priority` | Priority | `Highest` / `High` / `Medium` / `Low`. |
| `Story Points` | Story Points (estimate) | Fibonacci, on Stories. Map to your estimation field; on team-managed projects it may be "Story point estimate". |
| `Labels` (x3) | Labels | Three `Labels` columns (Jira's convention for multi-value fields). Tokens are space-free (e.g. `customer-app`, `ai`). |
| `Description` | Description | The narrative (user story, or Feature/Epic value) PLUS the technical layer: `=== ARCHITECTURE & STACK ===` (Features), `=== TECHNICAL SCOPE ===` (Epics), `=== TECHNICAL DESIGN ===` (Stories). |
| `Acceptance Criteria` | Acceptance Criteria *(custom)* | Gherkin scenarios. See note below. |

### Acceptance Criteria field
`Acceptance Criteria` is **not** a Jira default field. Options, in order of preference:
- **Best:** create a multi-line text **custom field** named `Acceptance Criteria` and map to it.
- **No custom field?** Map `Acceptance Criteria` to **Description** - the importer appends it, so each
  issue still carries its Gherkin. (The narrative and AC then live in one Description field.)
- Or leave it unmapped to drop it.

### Reporter / Assignee
Intentionally **omitted** so the file imports cleanly for anyone (those fields must map to real users
in your site). Add an `Assignee` / `Reporter` column with your own account values if you want them.

---

## 4. Conventions used in this backlog

- **Issue types:** `Feature` (value theme) > `Epic` (capability) > `Story` (user-visible increment) >
  `Sub-task` (implementation step).
- **Story format:** every Story Description is `As a <role>, I want <capability>, so that <benefit>.`
- **Acceptance criteria:** Gherkin (`Scenario / Given / When / Then`), multiple scenarios where the
  behavior has branches (e.g. eligibility, validation, error paths).
- **Priority:** reflects customer/business value and sequencing, not difficulty.
- **Story points:** relative size (1, 2, 3, 5, 8). Epics/Features/Sub-tasks are left unestimated so
  Jira can roll up from Stories.
- **Components (= Features):** `Client Portal`, `Client Chat`, `Autopilot Engine`, `Agent Workspace`,
  `Task Execution`, `Knowledge & Predict`, `Callbacks`, `Funds & Market Data`, `Platform & Infra`.
- **Labels:** app area (`customer-app`, `agent-app`, `backend`, `infra`), technology (`ai`, `llm`,
  `connect`, `dynamodb`, `cdk`, `react`, `funds`), and theme (`self-service`, `compliance`, `ux`,
  `security`, `content`).

---

## 5. The 9 Features at a glance

1. **Client Self-Service Portal** - the investor web app: accounts, portfolio, research, transactions,
   self-service account management, the open-an-account wizard, and the education/help estate.
2. **Conversational AI Assistant (Client Chat)** - the embedded chat: bot Q&A, escalation, human-real
   live UX, continue-a-recent-chat, topic/question pills, and chat history.
3. **AI Autopilot Engine** - the task-automation brain: scopes, two-phase task identification + field
   collection, shared guardrails, the **19 task experts**, callback time resolution, and evidence location.
4. **Agent Workspace** - the four-column representative console: multi-chat, incoming triage, AI support,
   Proposed Action review with evidence, disconnect detection, and auto-generated after-call work.
5. **Task Execution & Fulfillment** - executing approved actions (real DynamoDB writes + mock
   confirmations), reference numbers, confirmation cards, and client-submitted (Type 3) approvals.
6. **Knowledge & Predictive Assistance** - the knowledge base plus predict-intent, predict-questions,
   and next-best-response.
7. **Callback Scheduling** - schedule, fire, and cancel/reschedule phone callbacks.
8. **Fund Catalog & Market Data** - one source of truth for fund data feeding pages and AI, plus live
   prices.
9. **Platform, Infrastructure & Delivery** - CDK infra, dev/prod environments, guarded CI/CD, the data
   layer and demo-data tooling, transcript storage/review, observability, cost safety, and the contact
   center.

---

## 6. Technical Foundations & Architecture

Two React SPAs + a fleet of AWS Lambdas behind an HTTP API, all serverless. The per-ticket TECHNICAL
DESIGN / SCOPE / ARCHITECTURE notes assume this shared backdrop.

**Stack**
- Frontend (both apps): React 18 + Vite + TypeScript, Zustand (state), React Router v6. Customer app at the
  web root; agent app at `/agent`. Deployed as static bundles (GitHub Pages or S3+CloudFront).
- Chat transport: Amazon Connect - ChatJS (customer) and Streams + embedded CCP (agent).
- API: AWS API Gateway HTTP API (one route per Lambda).
- Compute: AWS Lambda (Node 20, TypeScript bundled with esbuild).
- AI: Amazon Bedrock **Nova Micro** (fast classification / full-auto / ACW / next-best-response / intent) +
  **OpenAI GPT** (gpt-4o for the task experts; gpt-4o-mini for bot/NBR/labels). API key from AWS SSM at deploy.
- Data: Amazon DynamoDB. Scheduling: Amazon EventBridge Scheduler. Infra: AWS CDK. CI/CD: GitHub Actions (OIDC).

**Repo layout (suggested)**
- `customer-app/` - client SPA (chat widget + portal pages + hooks/stores)
- `agent-app/` - agent SPA (CCP desktop + per-contact columns + stores)
- `lambda/` - one folder per Lambda + a `shared/` module (tasks catalog, knowledge base, types, DynamoDB +
  Bedrock clients, client-tools, fund-catalog bridge)
- `cdk/` - CDK app (DataStack, LambdaStack, Connect/Budget/CICD stacks) + the guarded `safe-deploy.mjs`

**Shared contracts**
- Autopilot turn (`POST /autopilot-turn`): in `{scope, transcript, profile, ...}`; out `{reply,
  shouldExitAutopilot, proposedAction?, scope}`.
- `proposedAction`: `{taskId, fields:[{key,label,value}], submissionType}` (stamped via withSubmissionType).
- Evidence: `{evidence:[{fieldKey, messageId, start, end}]}` - server-validated against message text; empty on any failure.
- Callback: the LLM emits `{dayReference, hour24, minute}`; the **server** resolves + validates ET -> UTC.
- Chat control messages: brand-neutral sentinels intercepted client/agent-side and never rendered as bubbles
  (agent-name broadcast, typing-stop, approval-form / approval-cancel, client-approved / client-declined).

**DynamoDB keys**
- Clients `PK clientId` · Sessions `PK contactId` (30-day TTL) · Transcripts (RETAIN, GSI
  `clientId-savedAt-index`) · Transactions `PK clientId, SK "<ISOdate>#<seq>"` (GSI `account-index`) · Funds `PK ticker`.

**Environments, deploy & secrets**
- Stage-parameterized CDK: `STAGE=dev` -> isolated `-dev` env; prod is byte-identical. **main == production.**
- All deploys go through `safe-deploy.mjs` (typecheck + `cdk diff` + destroy-guard; `ALLOW_DESTROY=1` to override).
  Merge to `main` triggers an OIDC deploy of backend + frontends. Secrets resolve from SSM at deploy time.
- Local dev points at the dev API (`.env.development`); seed/reset demo data per env via the key-gated reset endpoints.

**Testing**
- Backend: the task experts and the autopilot safety guard are unit-testable; replay transcripts against
  `/autopilot-turn` (experts) and the locate-evidence scope. Frontend: component tests + at least one live
  Connect round-trip for chat handoff (CCP cannot be automated headlessly).

---

## 7. Regenerating / editing

The backlog is authored as data in `generate-backlog.mjs`. To change it:

```bash
node generate-backlog.mjs     # re-emit all three CSVs
node validate-backlog.mjs     # confirm structure + referential integrity + ASCII
```

The generator auto-assigns `Issue ID`s and derives every hierarchy column, and it **throws** on a
duplicate Epic Name or an Epic Link with no matching Epic - so the output is always import-consistent.
