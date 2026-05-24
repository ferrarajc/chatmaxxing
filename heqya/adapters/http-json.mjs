/**
 * Heqya — HTTP/JSON Adapter Factory
 *
 * Creates a Heqya adapter for any HTTP API that accepts JSON and returns JSON.
 * The adapter is stateless by default; use the `previousResponses` parameter
 * in buildRequest to implement stateful behavior across turns.
 *
 * USAGE:
 *
 *   import { createHttpJsonAdapter } from 'heqya/adapters/http-json';
 *
 *   const adapter = createHttpJsonAdapter({
 *     buildRequest: ({ messages, scenario, turnIndex, previousResponses }) => ({
 *       url:     'https://my-api.com/chat',
 *       method:  'POST',           // optional, default 'POST'
 *       headers: {},               // optional extra headers
 *       body:    { messages },     // sent as JSON
 *     }),
 *
 *     parseResponse: (data, { messages, scenario, turnIndex, previousResponses }) => ({
 *       reply:    data.text,       // required: the agent's reply text
 *       isDone:   data.finished,   // required: true when conversation should end
 *       metadata: data,            // optional: passed back in previousResponses next turn
 *     }),
 *
 *     reset: async ({ scenario }) => {  // optional: called before each scenario
 *       await fetch('https://my-api.com/reset', { method: 'POST' });
 *     },
 *   });
 *
 * ADAPTER INTERFACE (what Heqya expects):
 *   adapter.send({ messages, scenario, turnIndex, previousResponses })
 *     → Promise<{ reply, isDone, metadata? }>
 *   adapter.reset({ scenario })   [optional]
 *     → Promise<void>
 */

/**
 * @param {object} opts
 * @param {function} opts.buildRequest    - builds the HTTP request
 * @param {function} opts.parseResponse   - parses the API response
 * @param {function} [opts.reset]         - optional pre-scenario reset
 * @returns {object} Heqya adapter
 */
export function createHttpJsonAdapter({ buildRequest, parseResponse, reset } = {}) {
  if (typeof buildRequest !== 'function') {
    throw new Error('createHttpJsonAdapter: buildRequest is required and must be a function');
  }
  if (typeof parseResponse !== 'function') {
    throw new Error('createHttpJsonAdapter: parseResponse is required and must be a function');
  }

  return {
    async send({ messages, scenario, turnIndex, previousResponses }) {
      const ctx = { messages, scenario, turnIndex, previousResponses };
      const req = buildRequest(ctx);

      if (!req.url) {
        throw new Error('buildRequest must return an object with a `url` field');
      }

      const httpRes = await fetch(req.url, {
        method:  req.method  ?? 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers ?? {}),
        },
        body: JSON.stringify(req.body ?? {}),
      });

      if (!httpRes.ok) {
        const body = await httpRes.text();
        throw new Error(`HTTP ${httpRes.status} from ${req.url}: ${body.slice(0, 300)}`);
      }

      const data   = await httpRes.json();
      const result = parseResponse(data, ctx);

      if (typeof result.reply !== 'string') {
        throw new Error('parseResponse must return an object with a string `reply` field');
      }
      if (typeof result.isDone !== 'boolean') {
        throw new Error('parseResponse must return an object with a boolean `isDone` field');
      }

      return result;
    },

    reset: reset ? async (ctx) => reset(ctx) : undefined,
  };
}
