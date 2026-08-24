// ── Rate limiting ────────────────────────────────────────────────────────────
//
// OpenAI's 30k tokens-per-minute ceiling is the binding constraint on a run, and it is
// worse than a slowdown: autopilot-turn CATCHES a 429 and returns HTTP 200 with a
// holding reply ("I'm pulling some information…"). The error never reaches the caller.
//
// So an un-paced run does not fail loudly — it quietly produces ten transcripts of an
// agent going vague, and reports them as product failures. That already misled me once
// this week: two test-force-task cases "failed" and the cause was throttling.
//
// Hence: strictly serial, with a rolling-window budget and adaptive backoff.

const WINDOW_MS = 60_000;

export function makePacer({ tpm = 24_000, log = () => {} } = {}) {
  let budget = tpm;
  const spent = [];   // { at, tokens }

  const prune = now => { while (spent.length && now - spent[0].at > WINDOW_MS) spent.shift(); };
  const used = now => { prune(now); return spent.reduce((s, e) => s + e.tokens, 0); };

  /** Rough but honest: the system prompt dominates and is ~4-5k with the tool schemas. */
  const estimate = transcript => {
    const chars = transcript.reduce((s, m) => s + (m.content?.length ?? 0), 0);
    return Math.ceil(chars / 4) + 5_000 + 700;
  };

  return {
    async beforeAgentTurn(transcript) {
      const need = estimate(transcript);
      for (;;) {
        const now = Date.now();
        if (used(now) + need <= budget) break;
        const oldest = spent[0];
        const waitMs = Math.max(1_000, WINDOW_MS - (now - oldest.at) + 250);
        log(`  pacing — waiting ${Math.ceil(waitMs / 1000)}s to stay under ${budget.toLocaleString()} TPM`);
        await new Promise(r => setTimeout(r, waitMs));
      }
      spent.push({ at: Date.now(), tokens: need });
    },

    /** Called when a holding reply is seen: we are already over. Back off hard. */
    throttleHit() {
      budget = Math.max(8_000, Math.floor(budget * 0.75));
      log(`  rate limited — dropping the budget to ${budget.toLocaleString()} TPM for the rest of the run`);
      return new Promise(r => setTimeout(r, 45_000));
    },

    get budget() { return budget; },
    get usedNow() { return used(Date.now()); },
  };
}
