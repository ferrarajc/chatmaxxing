import type {
  Dossier, GuidedScript, IntentBrief, ScriptStep,
  OriginTranscript, TranscriptChannel, TranscriptSpeaker,
} from './types';

// The phone agent's name. A single constant today; swap for the signed-in agent's name when the
// cockpit is wired to real Connect identities.
export const AGENT_NAME = 'John Ferrara';

const firstNameOf = (name: string) => (name || '').trim().split(/\s+/)[0] || 'there';
const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
// The greeting template appends ". Is that correct?", so the clause must not carry its own
// trailing sentence punctuation (otherwise we get a double period).
const cleanClause = (s: string) => s.replace(/[\s.;:,]+$/, '').trim();
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

/** Rewrite third-person pronouns to second person, so a summary reads naturally after "you want". */
export function toSecondPerson(s: string): string {
  return s
    .replace(/\bthey're\b/gi, "you're").replace(/\bthey've\b/gi, "you've").replace(/\bthey'll\b/gi, "you'll")
    .replace(/\bthey\b/gi, 'you').replace(/\bthem\b/gi, 'you').replace(/\btheirs\b/gi, 'yours')
    .replace(/\btheir\b/gi, 'your').replace(/\bthemselves\b/gi, 'yourself')
    .replace(/\bhe's\b/gi, "you're").replace(/\bshe's\b/gi, "you're")
    .replace(/\bhe\b/gi, 'you').replace(/\bshe\b/gi, 'you').replace(/\bhim\b/gi, 'you')
    .replace(/\bhis\b/gi, 'your').replace(/\bher\b/gi, 'your')
    .replace(/\bhimself\b/gi, 'yourself').replace(/\bherself\b/gi, 'yourself');
}

/** A clean second-person "…you want ___" clause, for records that lack a guided script. */
function deriveConfirm(intentSummary: string): string {
  let t = intentSummary.trim().replace(/\.+$/, '');
  t = t.replace(/^(the\s+)?client\s+/i, '');
  // Turn a leading intent verb into a clean infinitive ("Wants to know X" -> "to know X").
  t = t
    .replace(/^wants?\s+to\s+/i, 'to ')
    .replace(/^would\s+like\s+to\s+/i, 'to ')
    .replace(/^(is\s+)?looking\s+to\s+/i, 'to ')
    .replace(/^needs?\s+to\s+/i, 'to ')
    .replace(/^asked?\s+/i, 'to find out ')
    .replace(/^asking\s+(about|for)?\s*/i, 'to ask about ')
    .replace(/^has\s+(?:a\s+)?questions?\s+(about|on|regarding|with)?\s*/i, 'to go over ')
    .replace(/^needs?\s+(help\s+)?(with|on)?\s*/i, 'to go over ')
    .replace(/^wants?\s+/i, 'to ')
    .trim();
  if (!t) return 'to talk through your request';
  if (!/^to\b/i.test(t)) t = 'to discuss ' + lowerFirst(t);
  return cleanClause(toSecondPerson(t));
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

const CHANNELS: TranscriptChannel[] = ['chatbot', 'escalated', 'ivr'];
const SPEAKERS: TranscriptSpeaker[] = ['client', 'bob', 'agent', 'ivr', 'system'];

/** Validate the originating transcript, dropping it entirely if there's nothing usable. */
function sanitizeTranscript(t: unknown): OriginTranscript | undefined {
  if (!t || typeof t !== 'object') return undefined;
  const o = t as Record<string, unknown>;
  const messages = (Array.isArray(o.messages) ? o.messages : [])
    .map(m => (m && typeof m === 'object' ? (m as Record<string, unknown>) : null))
    .filter((m): m is Record<string, unknown> => !!m && typeof m.text === 'string' && !!String(m.text).trim())
    .map(m => ({
      speaker: (SPEAKERS.includes(m.speaker as TranscriptSpeaker) ? m.speaker : 'system') as TranscriptSpeaker,
      text: String(m.text).trim(),
    }));
  if (!messages.length) return undefined;
  return {
    channel: (CHANNELS.includes(o.channel as TranscriptChannel) ? o.channel : 'chatbot') as TranscriptChannel,
    title: typeof o.title === 'string' && o.title.trim() ? o.title.trim() : 'How this callback started',
    messages,
  };
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
    const confirm = raw.guidedScript.confirmAsk?.trim();
    guidedScript = {
      confirmAsk: confirm ? cleanClause(toSecondPerson(confirm)) : deriveConfirm(intentSummary),
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

  return { ...raw, intent, guidedScript, originTranscript: sanitizeTranscript(raw.originTranscript) };
}
