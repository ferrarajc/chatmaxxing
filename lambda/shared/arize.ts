/**
 * Arize AI observability integration.
 *
 * Set these Lambda env vars to activate (get both from app.arize.com → Settings):
 *   ARIZE_API_KEY   — your Arize API key
 *   ARIZE_SPACE_KEY — your Arize Space key
 *
 * When unset, every call is a no-op — zero overhead, safe to deploy either way.
 *
 * Arize dashboard: https://app.arize.com
 * Docs: https://docs.arize.com/arize/sending-data/direct-ingestion
 */

const ARIZE_API_KEY   = process.env.ARIZE_API_KEY ?? '';
const ARIZE_SPACE_KEY = process.env.ARIZE_SPACE_KEY ?? '';
const ARIZE_INGEST    = 'https://api.arize.com/v1/log';

export interface ArizeRecord {
  /** Which Lambda / AI feature generated this prediction */
  modelId: string;
  modelVersion?: string;
  /** Unique per inference — use contactId + timestamp if available */
  predictionId: string;
  /** Input features — anything useful for slicing in the dashboard */
  features: Record<string, string | number | boolean | null>;
  /** The raw LLM output (truncated to 1000 chars) */
  predictionLabel: string;
  /** Optional: actual correct answer for later evaluation */
  actualLabel?: string;
  /** Latency in ms */
  latencyMs?: number;
}

/**
 * Fire-and-forget: log one inference to Arize.
 * Errors are swallowed so a bad Arize call never breaks the Lambda response.
 */
export function logToArize(record: ArizeRecord): void {
  if (!ARIZE_API_KEY || !ARIZE_SPACE_KEY) return; // keys not configured — skip

  const body = {
    model_id:       record.modelId,
    model_version:  record.modelVersion ?? '1',
    prediction_id:  record.predictionId,
    prediction_label: record.predictionLabel.slice(0, 1000),
    features:       record.features,
    ...(record.actualLabel  ? { actual_label: record.actualLabel }      : {}),
    ...(record.latencyMs    ? { latency_ms:   record.latencyMs }        : {}),
    timestamp_ms:   Date.now(),
  };

  // Non-awaited — caller does not wait for this to resolve
  fetch(ARIZE_INGEST, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `apikey ${ARIZE_API_KEY}`,
      'space-key':     ARIZE_SPACE_KEY,
    },
    body: JSON.stringify(body),
  }).then(res => {
    if (!res.ok) console.warn(`arize: ingest failed ${res.status}`);
  }).catch(e => console.warn('arize: network error', e));
}
