# Heqya

> AI conversation quality evaluation loop — run, evaluate, improve.

Heqya is a framework for measuring and improving the quality of AI chat systems. It drives simulated customer conversations against your live system, evaluates each conversation against a set of quality heuristics using an LLM judge, and produces actionable fix instructions.

The loop: **Run → Evaluate → Report → Fix → Deploy → Repeat** until thresholds are met.

---

## Quick Start

```bash
npm install   # (once extractable to its own package)
```

```js
import { runAllScenarios, evaluateAll, writeReports } from 'heqya';
import { createHttpJsonAdapter } from 'heqya/adapters/http-json';

// 1. Create your adapter
const adapter = createHttpJsonAdapter({
  buildRequest: ({ messages, scenario }) => ({
    url:  'https://my-api.com/chat',
    body: { messages, sessionId: scenario.sessionId },
  }),
  parseResponse: (data) => ({
    reply:  data.message,
    isDone: data.isComplete,
  }),
  reset: async ({ scenario }) => {
    await fetch('https://my-api.com/reset', { method: 'POST' });
  },
});

// 2. Define heuristics
const heuristics = {
  document: readFileSync('./heuristics.md', 'utf8'),
  codes: {
    H1: { name: 'Factual Accuracy', severity: 'Critical', weight: 2 },
    H2: { name: 'Confirmation Completeness', severity: 'High', weight: 1 },
  },
  domainKnowledge: 'Optional extra context for the LLM evaluator.',
};

// 3. Define scenarios
const scenarios = [
  {
    id:             'customer-asks-balance',
    openingMessage: 'What is my account balance?',
    customerPrompt: 'You are a customer asking about your balance. ...',
    heuristics:     ['H1'],
    notes:          'Tests factual accuracy of balance figures.',
    // Any extra fields your adapter needs:
    sessionId:      'demo-session-001',
  },
];

// 4. Run
const llm = { apiKey: process.env.OPENAI_API_KEY };
const runResults  = await runAllScenarios(scenarios, adapter, { llm });
const evaluations = await evaluateAll(runResults, heuristics, llm);
const { score, thresholdMet } = writeReports({
  iteration:  1,
  runResults,
  evaluations,
  heuristics,
  thresholds: { minOverallScore: 0.80, zeroCriticalCodes: ['H1'] },
  resultsDir: './results',
});

console.log(`Score: ${(score * 100).toFixed(0)}%`);
```

---

## Core Concepts

### Adapter

An adapter bridges Heqya's generic runner and your specific API. It must implement:

```js
{
  // Called on every conversation turn
  send: async ({ messages, scenario, turnIndex, previousResponses }) => ({
    reply:    'The agent's response text',  // required
    isDone:   false,                        // required — true ends the conversation
    metadata: {},                           // optional — passed back in previousResponses
  }),

  // Called before each scenario (optional)
  reset: async ({ scenario }) => void,
}
```

Use `createHttpJsonAdapter` for any HTTP/JSON API. Write a custom adapter for WebSocket APIs, local models, or complex protocols.

### Heuristics

A heuristics document defines what good behavior looks like. Each heuristic has:
- A code (H1, H2, ...)
- A name and severity
- A weight for scoring (Critical heuristics are weighted ×2)
- An optional `fixGuidance` string shown in NEXT_FIX.md

See the [Evaluation System Guide](../docs/EVALUATION_SYSTEM_GUIDE.md) for principles on writing good heuristics.

### Scenarios

A scenario drives one test conversation. The generic fields are:
- `id` — unique slug
- `openingMessage` — the customer's first message (deterministic)
- `customerPrompt` — system prompt for the LLM playing the customer
- `heuristics` — which heuristic codes this scenario primarily tests
- `notes` — human description of what failure mode is being probed

Add any application-specific fields your adapter needs.

### Thresholds

```js
thresholds: {
  minOverallScore:    0.80,         // weighted average across all scenarios
  zeroCriticalCodes:  ['H1', 'H2'],  // these must have 0 Fail across all scenarios
  highSeverityPassRate: {
    codes:   ['H3', 'H5'],
    minRate: 0.75,                   // ≥75% of applicable scenarios must Pass
  },
}
```

---

## API Reference

### `runAllScenarios(scenarios, adapter, options)`

Runs all scenarios, optionally resetting state between each.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `llm` | object | required | `{ apiKey, simulatorModel?, evaluatorModel? }` |
| `maxTurns` | number | 18 | Max turns per conversation |
| `verbose` | boolean | false | Log each turn to stdout |
| `resetBetween` | boolean | true | Call `adapter.reset()` before each scenario |

Returns `RunResult[]`.

### `evaluateAll(runResults, heuristics, llm)`

Evaluates each run result against the heuristics using an LLM judge.

Returns `EvalResult[]` — one per scenario with per-code scores and notes.

### `writeReports({ iteration, runResults, evaluations, heuristics, thresholds, resultsDir })`

Writes three files to `resultsDir`:
- `report-NNN.md` — human-readable report
- `latest.json` — machine-readable scores
- `NEXT_FIX.md` — instructions for the next fix

Returns `{ score, criticalFailures, thresholdMet, topFix, reportFile, stats }`.

### `runLoop(config)`

Runs the full improvement loop (run → evaluate → report → fix → deploy → repeat).

```js
await runLoop({
  adapter,
  scenarios,
  heuristics,
  thresholds,
  llm,
  resultsDir,
  iterationFile,
  maxIterations: 12,

  // Optional: apply a fix automatically after each failed evaluation
  applyFix: async (nextFixContent, iteration) => ({
    applied: true,
    explanation: 'Added rule to system prompt',
  }),

  // Optional: called after fix is applied (e.g., deploy the updated system)
  afterFix: async (iteration) => {
    await runCommand('npm', ['run', 'deploy']);
  },
});
```

### `createHttpJsonAdapter({ buildRequest, parseResponse, reset })`

Creates an adapter for any HTTP/JSON API.

```js
const adapter = createHttpJsonAdapter({
  // Required: return the request to make
  buildRequest: ({ messages, scenario, turnIndex, previousResponses }) => ({
    url:     'https://my-api.com/endpoint',
    method:  'POST',         // optional, default 'POST'
    headers: {},             // optional extra headers
    body:    { messages },   // sent as JSON
  }),

  // Required: parse the API response
  parseResponse: (data, context) => ({
    reply:    data.text,
    isDone:   data.done,
    metadata: data,          // optional, available in previousResponses
  }),

  // Optional: reset state before each scenario
  reset: async ({ scenario }) => {
    await fetch('https://my-api.com/reset', { method: 'POST' });
  },
});
```

---

## Bob's Implementation

The reference implementation for Bob's Mutual Funds lives in `scripts/quality-loop/`:

| File | Purpose |
|------|---------|
| `bobs-adapter.mjs` | Adapter for the autopilot-turn API |
| `heqya.config.mjs` | Full Bob's config (heuristics, scenarios, thresholds) |
| `run-quality-loop.mjs` | CLI entry point (one evaluation pass) |
| `improvement-loop.mjs` | Full improvement loop with Claude API + CDK deploy |
| `scenarios.mjs` | 11 test scenarios + 4 client profiles |
| `secrets.mjs` | AWS SSM key loader |

---

## Adapting to a New Application

1. **Write your heuristics** — what does good look like in your domain? Start with 5–8.
2. **Create an adapter** — `createHttpJsonAdapter` or a custom one.
3. **Write scenarios** — one per important task type or failure mode.
4. **Set thresholds** — zero failures for Critical heuristics; ≥80% overall.
5. **Run the loop** — `runAllScenarios` + `evaluateAll` + `writeReports`, then read `NEXT_FIX.md`.

See `docs/EVALUATION_SYSTEM_GUIDE.md` for the full methodology.
