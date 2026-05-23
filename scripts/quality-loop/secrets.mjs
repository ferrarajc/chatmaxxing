/**
 * Fetches API keys from AWS SSM Parameter Store at startup.
 *
 * Parameters expected in SSM (all SecureString, --with-decryption):
 *   bobs-openai-api-key      → process.env.OPENAI_API_KEY
 *   bobs-anthropic-api-key   → process.env.ANTHROPIC_API_KEY  (optional)
 *
 * To store the Anthropic key once:
 *   aws ssm put-parameter --name bobs-anthropic-api-key --value "sk-ant-..." \
 *     --type SecureString --overwrite
 *
 * Call resolveSecrets() before any code that needs the keys.
 * It's safe to call multiple times; subsequent calls are no-ops.
 */

import { execSync } from 'child_process';

let resolved = false;

function getSSM(paramName) {
  try {
    return execSync(
      `aws ssm get-parameter --name "${paramName}" --with-decryption --query "Parameter.Value" --output text`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
  } catch {
    return null;
  }
}

export async function resolveSecrets() {
  if (resolved) return;
  resolved = true;

  // ── OpenAI key ────────────────────────────────────────────────────────────
  if (!process.env.OPENAI_API_KEY) {
    process.stdout.write('  Fetching OPENAI_API_KEY from SSM (bobs-openai-api-key)…\n');
    const key = getSSM('bobs-openai-api-key');
    if (key) {
      process.env.OPENAI_API_KEY = key;
      process.stdout.write('  ✓ OPENAI_API_KEY loaded from SSM\n');
    } else {
      process.stdout.write('  ✗ Could not fetch OPENAI_API_KEY from SSM\n');
    }
  }

  // ── Anthropic key (optional) ──────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    const key = getSSM('bobs-anthropic-api-key');
    if (key) {
      process.env.ANTHROPIC_API_KEY = key;
      process.stdout.write('  ✓ ANTHROPIC_API_KEY loaded from SSM\n');
    }
    // Silent if not found — Anthropic key is optional
  }
}
