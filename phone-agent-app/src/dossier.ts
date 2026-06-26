import type { Dossier, GuidedScript, IntentBrief, ScriptStep } from './types';

// The phone agent's name. A single constant today; swap for the signed-in agent's name when the
// cockpit is wired to real Connect identities.
export const AGENT_NAME = 'John Ferrara';

const firstNameOf = (name: string) => (name || '').trim().split(/\s+/)[0] || 'there';
const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const clip = (words: string[], n: number) => (words.length > n ? words.slice(0, n) : words);

/** A best-effort ≤18-word, first-name-led objective line, for records prepped before `intent` existed. */
function synthHeadline(clientName: string, intentSummary: string): string {
  const first = firstNameOf(clientName);
  const ask = intentSummary.trim().replace(/\.+$/, '');
  if (!ask) return `${first} requested a callback.`;
  // If the summary already opens with their name, don't double it up.
  const body = ask.toLowerCase().startsWith(first.toLowerCase()) ? ask : `${first} ${lowerFirst(ask)}`;
  return clip(body.split(/\s+/), 18).join(' ').replace(/[,;:]$/, '') + '.';
}

/** A second-person "…you want ___" clause, for records that lack a guided script. */
function deriveConfirm(intentSummary: string): string {
  let t = intentSummary.trim().replace(/\.+$/, '');
  t = t.replace(/^(the client|client)\s+/i, '');
  // Drop a leading intent verb so what's left reads after "you want".
  t = t.replace(/^(wants?|would like|is looking|looking|needs?|asking|has\s+(?:a\s+)?questions?)\b\s*(to|about|with|on|regarding|for)?\s*/i, '');
  if (!t) return 'to talk through your request';
  return /^to\b/i.test(t) ? t : `to discuss ${lowerFirst(t)}`;
}

/** Recursively validate the LLM's step tree, coercing anything malformed into a plain `say`. */
function coerceSteps(input: unknown, depth = 0): ScriptStep[] {
  if (!Array.isArray(input) || depth > 4) return [];
  const out: ScriptStep[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    if (o.kind === 'ask' && typeof o.text === 'string' && Array.isArray(o.options)) {
      const options = (o.options as unknown[])
        .map(op => (op && typeof op === 'object' ? (op as Record<string, unknown>) : null))
        .filter((op): op is Record<string, unknown> => !!op && typeof op.label === 'string')
        .map(op => ({ label: String(op.label), then: coerceSteps(op.then, depth + 1) }));
      if (options.length) { out.push({ kind: 'ask', text: o.text, options }); continue; }
    }
    const text = typeof o.text === 'string' ? o.text : typeof o.say === 'string' ? (o.say as string) : '';
    if (text.trim()) out.push({ kind: 'say', text: text.trim() });
  }
  return out;
}

/**
 * Guarantee a dossier has a usable `intent` and `guidedScript`, synthesizing them from legacy
 * fields (or the raw intent summary) when an older record predates the guided-script upgrade.
 */
export function normalizeDossier(
  raw: Dossier | undefined,
  clientName: string,
  intentSummary: string,
): Dossier | undefined {
  if (!raw) return raw;

  const intent: IntentBrief = raw.intent && typeof raw.intent.headline === 'string' && raw.intent.headline.trim()
    ? { headline: raw.intent.headline.trim(), detail: (raw.intent.detail ?? []).filter(d => !!d && d.trim()) }
    : { headline: synthHeadline(clientName, intentSummary), detail: [] };

  const steps = coerceSteps(raw.guidedScript?.steps);
  let guidedScript: GuidedScript;
  if (raw.guidedScript && steps.length) {
    guidedScript = {
      confirmAsk: (raw.guidedScript.confirmAsk || deriveConfirm(intentSummary)).trim(),
      steps,
      points: (raw.guidedScript.points ?? []).filter(p => !!p && p.trim()),
    };
  } else {
    // Fall back to the legacy flat script (opening + talking points), else just the bare ask.
    const legacy = raw.script;
    const legacySteps: ScriptStep[] = (legacy?.talkingPoints ?? [])
      .filter(p => !!p && p.trim())
      .map(p => ({ kind: 'say', text: p.trim() }));
    guidedScript = {
      confirmAsk: deriveConfirm(intentSummary),
      steps: legacySteps,
      points: [],
    };
  }

  return { ...raw, intent, guidedScript };
}
