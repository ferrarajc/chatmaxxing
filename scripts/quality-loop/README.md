# Quality Loop

Automated conversation quality testing and self-improvement system for the Bob's Mutual Funds AI platform.

## What It Does

1. **Runs** 11 test conversations against the live `autopilot-turn` API (resets DynamoDB between each)
2. **Evaluates** each conversation against `docs/QUALITY_HEURISTICS.md` using GPT-4o as a judge
3. **Reports** findings in `results/report-NNN.md` (human-readable) and `results/latest.json`
4. **Instructs** Claude on exactly what to fix in `results/NEXT_FIX.md`
5. **Exits 0** when thresholds are met; **exits 1** when below threshold

Claude Code reads `NEXT_FIX.md`, edits `lambda/autopilot-turn/handler.ts`, deploys, and reruns — repeating until the thresholds are met.

---

## Quick Start — Dashboard (recommended)

```powershell
# Keys are loaded automatically from SSM — no env vars needed
node scripts/quality-loop/server.mjs
# Open http://localhost:3456
```

Then click **Run Evaluation** (single pass) or toggle **Improvement Loop** (full auto-improve cycle).

Keys fetched at startup:
- `bobs-openai-api-key` → `OPENAI_API_KEY` (required — already in SSM)
- `bobs-anthropic-api-key` → `ANTHROPIC_API_KEY` (optional — enables automated fixes)

To store the Anthropic key in SSM once:
```powershell
aws ssm put-parameter --name bobs-anthropic-api-key --value "sk-ant-..." --type SecureString --overwrite
```

## Quick Start — CLI only

```powershell
# Keys loaded from SSM automatically
node scripts/quality-loop/run-quality-loop.mjs
```

Then read `scripts/quality-loop/results/NEXT_FIX.md`.

---

## Start the Improvement Loop (CLI)

Trigger the full self-improvement loop without the dashboard:

```
/loop Run the quality improvement loop:
1. Run: node scripts/quality-loop/run-quality-loop.mjs
2. If exit 0: thresholds met — create PR for the quality-loop branch, stop the loop
3. If exit 1: read scripts/quality-loop/results/NEXT_FIX.md, implement the change in lambda/autopilot-turn/handler.ts
4. Typecheck: cd cdk && npx tsc --noEmit
5. Deploy: cd cdk && npx cdk deploy BobsLambdaStack --require-approval never
6. Increment scripts/quality-loop/results/iteration.txt by 1
7. Repeat from step 1
```

**Branch convention:** Create `quality-loop/iteration-1` before the first code change. Subsequent changes accumulate on the same branch. When exit 0, open a PR.

---

## Thresholds

The loop exits successfully when **all three** are true:

| Condition | Value |
|-----------|-------|
| No Critical failures (H1, H2) | 0 across all scenarios |
| High-severity heuristics (H3, H5, H8, H13) pass rate | ≥ 75% of applicable scenarios |
| Overall weighted score | ≥ 80% |

Max iterations before manual review: **6**

---

## Scenarios

| # | Scenario ID | Client | Scope | Key Heuristics |
|---|-------------|--------|-------|---------------|
| 1 | `robert-beneficiary-copy-roth-to-sep` | Robert | get-intent | H2, H3, H5, H10 |
| 2 | `robert-beneficiary-add-two-alongside` | Robert | get-intent | H2, H3, H6, H10 |
| 3 | `maria-beneficiary-update-remarried` | Maria | get-intent | H3, H10 |
| 4 | `alex-beneficiary-add-simple` | Alex | get-intent | H10, H12 |
| 5 | `jordan-setup-auto-invest` | Jordan | get-intent | H3, H10, H12 |
| 6 | `maria-update-rmd-settings` | Maria | get-intent | H3, H10 |
| 7 | `alex-place-purchase` | Alex | get-intent | H1, H3, H10 |
| 8 | `robert-exchange-funds` | Robert | get-intent | H1, H3, H10 |
| 9 | `alex-update-contact-info` | Alex | get-intent | H3, H4, H10, H12 |
| 10 | `robert-bot-beneficiary-request` | Robert | full-auto | H7, H8, H9 |
| 11 | `jordan-bot-balance-inquiry` | Jordan | full-auto | H1, H8, H12 |

---

## Environment Variables

| Var | Default | Description |
|-----|---------|-------------|
| `OPENAI_API_KEY` | required | OpenAI API key |
| `API_BASE` | production URL | Override API base URL |
| `OPENAI_MODEL` | `gpt-4o-mini` | Customer simulator model |
| `EVALUATOR_MODEL` | `gpt-4o` | Judge model |
| `VERBOSE` | `0` | Set to `1` for turn-by-turn logging |
| `ONLY` | all | Comma-separated scenario IDs to run |
| `SKIP` | none | Comma-separated scenario IDs to skip |
| `NO_RESET` | `0` | Skip DynamoDB reset between scenarios (faster, less isolated) |

---

## Output Files

All outputs are in `results/` (gitignored):

| File | Description |
|------|-------------|
| `results/report-001.md` | Iteration 1 human-readable report |
| `results/latest.json` | Machine-readable scores (current iteration) |
| `results/NEXT_FIX.md` | Instructions for Claude's next code change |
| `results/iteration.txt` | Current iteration counter |

---

## Adding Scenarios

Add entries to `scenarios.mjs`. Each scenario needs:

```js
{
  id: 'unique-slug',
  client: CLIENT_PROFILES.alex,       // or .maria, .jordan, .robert
  scope: 'get-intent',                // or 'full-auto'
  currentIntent: 'buy fund shares',   // hint for autopilot-turn (omit for full-auto)
  openingMessage: 'I want to buy...', // customer's first message (deterministic)
  customerPrompt: `You are Alex...`,  // GPT-4o-mini system prompt for customer role
  heuristics: ['H1', 'H3', 'H10'],   // which heuristics this primarily probes
  notes: 'What failure mode this catches...',
}
```
