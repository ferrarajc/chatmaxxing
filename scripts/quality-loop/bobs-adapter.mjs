/**
 * Bob's Mutual Funds — Heqya Adapter
 *
 * Wires heqya's generic HTTP/JSON adapter to the autopilot-turn API.
 *
 * Bob's-specific protocol details handled here:
 *   - Request format:  { transcript, clientProfile, scope, currentIntent }
 *   - Response fields: { response, shouldExitAutopilot, taskIdentified, proposedAction }
 *   - System message injection: [TASK: id] is injected after task identification
 *   - Message format:  { role: 'CUSTOMER'|'AGENT'|'SYSTEM', content, timestamp }
 *   - DB reset:        GET /reset-client-data?key=bobs-reset-2025
 *
 * Scenarios consumed by this adapter are expected to have:
 *   scenario.client         — client profile object (clientId, name, accounts, ...)
 *   scenario.scope          — 'get-intent' | 'full-auto'
 *   scenario.currentIntent  — optional intent hint string
 */

import { createHttpJsonAdapter } from '../../heqya/adapters/http-json.mjs';

const API_BASE = process.env.API_BASE
  ?? 'https://0y3s5vq2v5.execute-api.us-east-1.amazonaws.com';

const AUTOPILOT_URL = `${API_BASE}/autopilot-turn`;
const RESET_URL     = `${API_BASE}/reset-client-data?key=bobs-reset-2025`;

// ── Message format conversion ──────────────────────────────────────────────────
// Heqya generic:  { role: 'customer'|'agent', content }
// Bob's API:      { role: 'CUSTOMER'|'AGENT'|'SYSTEM', content, timestamp }

const EPOCH = Date.now();

function toApiTranscript(messages, systemMessages = []) {
  const withTs = messages.map((m, i) => ({
    role:      m.role === 'customer' ? 'CUSTOMER' : 'AGENT',
    content:   m.content,
    timestamp: EPOCH + i * 2000,
  }));
  return [...withTs, ...systemMessages].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
}

// ── Adapter factory ────────────────────────────────────────────────────────────

/**
 * Create the Bob's autopilot-turn adapter.
 * Call this once; the adapter is stateless — Bob's-specific state (taskIdentified)
 * is tracked via the previousResponses array passed to send() each turn.
 */
export function createBobsAdapter() {
  return createHttpJsonAdapter({
    buildRequest({ messages, scenario, turnIndex, previousResponses }) {
      // Find the taskIdentified value from any prior turn
      const taskId = previousResponses?.find(r => r?.taskIdentified)?.taskIdentified ?? null;

      // Build system messages array for task identification
      const systemMessages = taskId ? [{
        role:      'SYSTEM',
        content:   `[TASK: ${taskId}]`,
        timestamp: EPOCH + 500,   // inject near the start, after opening message
      }] : [];

      const transcript = toApiTranscript(messages, systemMessages);

      return {
        url:  AUTOPILOT_URL,
        body: {
          transcript,
          clientProfile:  scenario.client,
          scope:          scenario.scope,
          ...(scenario.currentIntent ? { currentIntent: scenario.currentIntent } : {}),
        },
      };
    },

    parseResponse(data) {
      return {
        reply:    data.response ?? '',
        isDone:   Boolean(data.shouldExitAutopilot),
        metadata: {
          taskIdentified: data.taskIdentified ?? null,
          proposedAction: data.proposedAction ?? null,
          raw:            data,
        },
      };
    },

    async reset() {
      const res = await fetch(RESET_URL);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`DB reset failed (HTTP ${res.status}): ${body}`);
      }
    },
  });
}
