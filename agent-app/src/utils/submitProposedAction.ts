import { ContactSlot, ProposedActionData } from '../types';
import { useAgentStore } from '../store/agentStore';
import { post } from '../api/client';

export interface ExecuteTaskResult {
  success: boolean;
  message: string;
  referenceNumber?: string;
}

const PAST_TENSE: Record<string, string> = {
  Update: 'Updated', Add: 'Added', Remove: 'Removed', Change: 'Changed',
  Schedule: 'Scheduled', Cancel: 'Cancelled', Grant: 'Granted',
  Transfer: 'Transferred', Set: 'Set', Enable: 'Enabled', Disable: 'Disabled',
  Replace: 'Replaced', Modify: 'Modified', Close: 'Closed',
};

/** Turn a proposed-action summary ("Grant …") into a confirmation ("Granted …"). */
export function toPastTense(summary: string): string {
  return summary.replace(/^\w+/, w => PAST_TENSE[w] ?? (w.endsWith('e') ? w + 'd' : w + 'ed'));
}

/**
 * Execute a proposed action and deliver the confirmation — the shared body of the
 * Type 1 "Submit Action" flow, reused verbatim by the Type 3 client-approval relay
 * (so the confirmation the customer receives is byte-for-byte identical either way).
 *
 * Calls /execute-task, and on success composes the confirmation, appends it to the
 * agent transcript (role AGENT), and pushes it to the customer via /send-agent-message
 * (which renders it as a normal agent bubble). Lets execute-task transport errors throw
 * so callers can show their own failure state.
 */
export async function submitProposedAction(
  slot: ContactSlot,
  action: ProposedActionData,
  fieldsMap: Record<string, string>,
): Promise<ExecuteTaskResult> {
  const res = await post<ExecuteTaskResult>('/execute-task', {
    taskId: action.taskId,
    clientId: slot.clientId,
    fields: fieldsMap,
  });
  if (res.success) {
    const description = toPastTense(action.summary);
    const clientMsg = res.referenceNumber
      ? `Confirmation\nRef: ${res.referenceNumber}\n\n${description}`
      : `Confirmation\n\n${description}`;
    useAgentStore.getState().appendMessage(slot.contactId, { role: 'AGENT', content: clientMsg });
    if (slot.connectionToken) {
      post<{ ok: boolean }>('/send-agent-message', {
        connectionToken: slot.connectionToken,
        message: clientMsg,
      }).catch(() => {});
    }
  }
  return res;
}
