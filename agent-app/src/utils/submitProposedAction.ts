import { ContactSlot, ProposedActionData } from '../types';
import { useAgentStore } from '../store/agentStore';
import { post } from '../api/client';

export interface ExecuteTaskResult {
  success: boolean;
  message: string;
  referenceNumber?: string;
}

/**
 * REMOVED: toPastTense() and its PAST_TENSE lookup.
 *
 * It conjugated the leading verb of a proposed-action summary so the confirmation read
 * "Granted …" instead of "Grant …". The lookup held 14 verbs and fell back to
 * `endsWith('e') ? +'d' : +'ed'`, so every verb outside the list was a coin flip — and
 * three of the ones actually used lost it, in messages that go to CLIENTS:
 *
 *     Sell     → "Selled"       (Sold)
 *     Withdraw → "Withdrawed"   (Withdrew)
 *     Send     → "Sended"       (Sent)
 *
 * Adding three more entries would not have fixed the class; the next new verb breaks it
 * again. So the conjugation is gone entirely: proposedAction summaries are now NOUN
 * PHRASES ("Sale of $1,000 of BFESG from Jordan Williams's Taxable Account"), which read
 * correctly BOTH on the card before submission and in the confirmation after it. There
 * is no longer a verb to get wrong, and if a model ever drifts back to a verb the worst
 * case is a slightly imperative line — never an invented word.
 */

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
    const description = action.summary;
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
