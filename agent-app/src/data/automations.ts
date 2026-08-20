// ── Autopilot automation catalog ───────────────────────────────────────────
// The ✈ menu lists every automation an agent can start: the 4 GLOBAL scopes
// plus one TASK entry per task expert.
//
// The task list is NOT re-declared here. `lambda/shared/tasks.ts` stays the one
// canonical registry and is imported directly — the mirror image of the
// `lambda/shared/fund-catalog.ts` bridge (which pulls the fund lineup the other
// way). tasks.ts is pure data with zero imports, so it costs nothing to bundle.
// Add a task there and it shows up in this menu automatically.
import { TASKS } from '../../../lambda/shared/tasks';
import { AutopilotScope, AUTOPILOT_SCOPE_LABELS, ContactSlot } from '../types';

/**
 * Agent-facing shorthand for each task, replacing the longer back-office name
 * (`Task.name`) in the menu. Always at least a verb + a noun so the agent knows
 * what is about to kick off.
 *
 * The value is a LIST because one expert can legitimately surface as more than
 * one menu entry — `cancel-reschedule-callback` appears as both "Cancel
 * callback" and "Reschedule callback" so it is findable under either word. Both
 * rows start the identical expert with no extra hint; it works out which the
 * client wants from the transcript.
 *
 * A task with no entry here still appears, labeled with its `Task.name`.
 */
export const TASK_MENU_LABELS: Record<string, string[]> = {
  'add-account-access':          ['Authorize an agent'],
  'place-purchase':              ['Buy funds'],
  'cancel-reschedule-callback':  ['Cancel callback', 'Reschedule callback'],
  'update-beneficiaries':        ['Change beneficiaries'],
  'toggle-drip':                 ['Change DRIP settings'],
  'roth-conversion':             ['Convert to Roth IRA'],
  'exchange-funds':              ['Exchange funds'],
  'update-auto-invest':          ['Modify auto-invest'],
  'open-account':                ['Open an account'],
  'pause-auto-invest':           ['Pause auto-invest'],
  'request-tax-document':        ['Request a tax document'],
  'request-withdrawal':          ['Request a withdrawal'],
  'initiate-rollover':           ['Roll over an account'],
  'place-sale':                  ['Sell funds'],
  'setup-auto-invest':           ['Set up auto-invest'],
  'setup-systematic-withdrawal': ['Set up recurring withdrawals'],
  'update-contact-info':         ['Update contact info'],
  'update-rmd-settings':         ['Update RMD settings'],
  'update-security':             ['Update security settings'],
};

/** Menu row. `key` (not `taskId`) identifies a row — two rows may share a taskId. */
export type AutomationItem =
  | {
      kind: 'global';
      key: string;
      scope: AutopilotScope;
      label: string;
      keywords: string[];
    }
  | {
      kind: 'task';
      key: string;
      /** Scope to activate. Every task expert runs under 'get-intent'; the
       *  callback automation is its own scope and carries no taskId. */
      scope: 'get-intent' | 'callback';
      taskId?: string;
      label: string;
      keywords: string[];
      description: string;
    };

/** Fixed order — deliberately NOT alphabetical. */
export const GLOBAL_AUTOMATIONS: AutomationItem[] = [
  {
    kind: 'global', key: 'get-intent', scope: 'get-intent',
    label: AUTOPILOT_SCOPE_LABELS['get-intent'],
    keywords: ['intent', 'identify', 'triage', 'what do they need', 'clarify', 'need'],
  },
  {
    kind: 'global', key: 'idle-check', scope: 'idle-check',
    label: AUTOPILOT_SCOPE_LABELS['idle-check'],
    keywords: ['idle', 'quiet', 'still there', 'unresponsive', 'gone', 'check in'],
  },
  {
    kind: 'global', key: 'researching', scope: 'researching',
    label: AUTOPILOT_SCOPE_LABELS['researching'],
    keywords: ['research', 'look into', 'hold on', 'stall', 'check ins', 'busy', 'wait'],
  },
  {
    kind: 'global', key: 'full-auto', scope: 'full-auto',
    label: AUTOPILOT_SCOPE_LABELS['full-auto'],
    keywords: ['full auto', 'autopilot', 'hands off', 'ai handles', 'take over'],
  },
];

/** The callback automation is a scope, not a TASKS entry — but from the agent's
 *  point of view it behaves exactly like a task expert (collect fields → mini-form),
 *  so it lives in the task group. */
const CALLBACK_AUTOMATION: AutomationItem = {
  kind: 'task', key: 'Schedule a callback', scope: 'callback',
  label: 'Schedule a callback',
  keywords: ['callback', 'call back', 'schedule call', 'phone', 'call me', 'advisor call'],
  description: 'Collect the details and schedule a phone callback with an advisor.',
};

/** Every task automation, alphabetical by label. */
export const TASK_AUTOMATIONS: AutomationItem[] = [
  ...TASKS.flatMap<AutomationItem>(t =>
    (TASK_MENU_LABELS[t.id] ?? [t.name]).map(label => ({
      kind: 'task' as const,
      key: label,
      scope: 'get-intent' as const,
      taskId: t.id,
      label,
      // The task's own keywords already power the backend intent matcher — reuse
      // them so typing "beneficiary" or "rollover" finds the right row.
      keywords: [...t.keywords, t.name],
      description: t.description,
    })),
  ),
  CALLBACK_AUTOMATION,
].sort((a, b) => a.label.localeCompare(b.label));

export const ALL_AUTOMATIONS: AutomationItem[] = [...GLOBAL_AUTOMATIONS, ...TASK_AUTOMATIONS];

/**
 * Substring filter over label + keywords + description, ranked
 * label-prefix > label-substring > keyword/description.
 * Same idiom as the fund filter in customer-app ResearchPage — no fuzzy dep.
 */
export function matchAutomations(query: string, items: AutomationItem[]): AutomationItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const scored: { item: AutomationItem; rank: number }[] = [];
  for (const item of items) {
    const label = item.label.toLowerCase();
    let rank = -1;
    if (label.startsWith(q)) rank = 0;
    else if (label.includes(q)) rank = 1;
    else if (item.keywords.some(k => k.toLowerCase().includes(q))) rank = 2;
    else if (item.kind === 'task' && item.description.toLowerCase().includes(q)) rank = 3;
    if (rank >= 0) scored.push({ item, rank });
  }
  return scored
    .sort((a, b) => a.rank - b.rank || a.item.label.localeCompare(b.item.label))
    .map(s => s.item);
}

const TASK_MARKER_RE = /^\[TASK:\s*([^\]]+)\]$/;

/** The task id currently driving this conversation: the one just picked from the
 *  menu, else the LAST `[TASK: id]` marker in the transcript (the backend reads
 *  the same marker to resume field collection). */
export function activeTaskId(slot: ContactSlot): string | null {
  if (slot.pendingTaskId) return slot.pendingTaskId;
  for (let i = slot.messages.length - 1; i >= 0; i--) {
    const m = slot.messages[i];
    if (m.role !== 'SYSTEM') continue;
    const match = m.content.match(TASK_MARKER_RE);
    if (match) return match[1].trim();
  }
  return null;
}

/** Menu label for a task id (shorthand if it has one, else the backend name). */
export function taskLabel(taskId: string): string | null {
  const short = TASK_MENU_LABELS[taskId]?.[0];
  if (short) return short;
  return TASKS.find(t => t.id === taskId)?.name ?? null;
}

/**
 * Label for the autopilot header. While a task expert is running the header says
 * which TASK is running ("Change beneficiaries"), not the scope it rides on
 * ("Get intent"). A merely *suggested* scope keeps its plain scope label.
 */
export function activeAutomationLabel(slot: ContactSlot): string | null {
  const scope = slot.autopilotScope ?? slot.suggestedScope;
  if (!scope) return null;
  if (slot.autopilotScope === 'get-intent') {
    const id = activeTaskId(slot);
    const label = id ? taskLabel(id) : null;
    if (label) return label;
  }
  return AUTOPILOT_SCOPE_LABELS[scope];
}
