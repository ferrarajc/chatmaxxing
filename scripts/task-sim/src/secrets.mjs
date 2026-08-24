// ── Secrets ──────────────────────────────────────────────────────────────────
//
// The OpenAI key already lives in AWS SSM as `bobs-openai-api-key` — it is the same
// parameter CloudFormation resolves for the Lambdas at deploy time (see CLAUDE.md). So
// there is nothing to store; there is only something to read.
//
// TWO RULES, both deliberate:
//
//   1. THE KEY IS NEVER PRINTED. Not to stdout, not to a log line, not into the report,
//      not on an error path. It is read into a variable, handed to the OpenAI client, and
//      never rendered. Callers get the value; nothing else ever sees it.
//
//   2. READING IT IS ANNOUNCED, NEVER SILENT. The env var wins if it is set; SSM is the
//      fallback and it says so on the way past.
//
// Rule 2 exists because of a specific failure in this repo's history. The shelved quality
// loop had a secrets module that silently pulled BOTH the OpenAI and Anthropic keys from
// SSM without being asked — and the presence of the Anthropic key was what armed its
// automatic "apply this fix and deploy to prod" path. Nobody chose that; the secret
// fetcher chose it for them. Fetching a credential is a decision, so it should be visible.
//
// This tool has no such path: it cannot edit, cannot deploy, and asks no model for code.

import { execFileSync } from 'node:child_process';

const PARAM = 'bobs-openai-api-key';

/**
 * Resolve the OpenAI key. Returns the value; never logs it.
 * @param {(msg:string)=>void} log
 */
export function resolveOpenAiKey(log = () => {}) {
  if (process.env.OPENAI_API_KEY) {
    log('  using OPENAI_API_KEY from the environment');
    return process.env.OPENAI_API_KEY;
  }

  let value;
  try {
    value = execFileSync('aws', [
      'ssm', 'get-parameter',
      '--name', PARAM,
      '--with-decryption',
      '--query', 'Parameter.Value',
      '--output', 'text',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    // Deliberately does not echo stderr — an AWS error can quote the parameter value.
    throw new Error(
      `Could not read ${PARAM} from SSM. Set OPENAI_API_KEY instead, or check your AWS credentials.`,
    );
  }

  if (!value || !/^sk-/.test(value)) {
    throw new Error(`${PARAM} does not look like an OpenAI key.`);
  }
  log(`  using the OpenAI key from AWS SSM (${PARAM}) — ${value.length} chars, not logged`);
  return value;
}
