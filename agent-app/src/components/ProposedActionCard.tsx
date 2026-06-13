import React, { useState } from 'react';
import { ContactSlot, ProposedActionField } from '../types';
import { useAgentStore } from '../store/agentStore';
import { post } from '../api/client';
import { submitProposedAction, ExecuteTaskResult } from '../utils/submitProposedAction';

interface Props {
  slot: ContactSlot;
}

// Control message carrying the proposed-action form to the customer's chat (Type 3).
// Must match the customer app's sentinel exactly. Intercepted there; never rendered.
const APPROVAL_FORM_SENTINEL = '__BOBS_APPROVAL_FORM__';
// Tells the customer to drop a pending approval card (agent cancelled the send).
const APPROVAL_CANCEL_SENTINEL = '__BOBS_APPROVAL_CANCEL__';

export function ProposedActionCard({ slot }: Props) {
  const store = useAgentStore();
  const action = slot.proposedAction!;

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editedFields, setEditedFields] = useState<ProposedActionField[]>(action.fields);
  const [editValue, setEditValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExecuteTaskResult | null>(null);

  const startEdit = (field: ProposedActionField) => {
    setEditingKey(field.key);
    setEditValue(field.value);
  };

  // Transcript evidence for each field value (locate-evidence call). While the
  // array is null/undefined (still loading or unavailable) the card renders
  // exactly as before — no locate buttons, no "not located" hints.
  const evidence = slot.proposedActionEvidence;
  const evidenceFor = (key: string) => evidence?.find(e => e.fieldKey === key);

  const jumpToEvidence = (messageId: string) => {
    window.dispatchEvent(new CustomEvent('bobs:evidenceJump', {
      detail: { contactId: slot.contactId, messageId },
    }));
  };

  const saveEdit = () => {
    setEditedFields(prev =>
      prev.map(f => f.key === editingKey ? { ...f, value: editValue } : f),
    );
    setEditingKey(null);
  };

  // Type 3: the customer must submit. The agent only sends the proposed action to the
  // client; nothing executes until the client approves it in their own chat.
  const isClientSubmit = action.submissionType === 'client';

  const handleSubmit = async () => {
    setSubmitting(true);
    const fieldsMap: Record<string, string> = {};
    for (const f of editedFields) fieldsMap[f.key] = f.value;

    try {
      const res = await submitProposedAction(slot, action, fieldsMap);
      setResult(res);
      if (res.success) {
        // Clear card after short delay so agent sees the success message
        setTimeout(() => {
          store.patchSlot(slot.contactId, { proposedAction: null, proposedActionEvidence: null });
        }, 4000);
      }
    } catch {
      setResult({ success: false, message: 'Submission failed — please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Type 3: push the (edited) proposed action to the customer's chat for them to submit,
  // and flip the card into the "waiting for client" state. Edits are persisted onto the
  // slot first so slot.proposedAction stays the single source of truth.
  const handleSendToClient = () => {
    store.patchSlot(slot.contactId, {
      proposedAction: { ...action, fields: editedFields },
      awaitingClientApproval: true,
    });
    const payload = {
      taskName: action.taskName,
      summary: action.summary,
      fields: editedFields.map(f => ({ key: f.key, label: f.label, value: f.value })),
    };
    const message = APPROVAL_FORM_SENTINEL + JSON.stringify(payload);
    if (message.length > 1000) {
      console.warn('Approval form payload nearing Connect 1024-char limit:', message.length);
    }
    if (slot.connectionToken) {
      post<{ ok: boolean }>('/send-agent-message', {
        connectionToken: slot.connectionToken,
        message,
      }).catch(() => {});
    }
  };

  // Agent retracts a sent-but-unsubmitted Type 3 action (client never responded).
  const handleCancelSend = () => {
    store.patchSlot(slot.contactId, {
      proposedAction: null, proposedActionEvidence: null, awaitingClientApproval: false,
    });
    if (slot.connectionToken) {
      post<{ ok: boolean }>('/send-agent-message', {
        connectionToken: slot.connectionToken,
        message: APPROVAL_CANCEL_SENTINEL,
      }).catch(() => {});
    }
  };

  const handleReject = () => {
    store.patchSlot(slot.contactId, { proposedAction: null, proposedActionEvidence: null });
  };

  // Type 3 waiting state: the form is with the client. Replace the whole card with an
  // italic note at the top of the AI area, plus a Cancel link to take it back.
  if (slot.awaitingClientApproval) {
    return (
      <div style={{
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: 8,
        padding: '8px 12px',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <span style={{ fontStyle: 'italic', fontSize: 14, color: '#92400e', lineHeight: 1.4 }}>
          Waiting for client to submit the proposed action.
        </span>
        <button
          onClick={handleCancelSend}
          style={{
            background: 'none', border: 'none', color: '#92400e', cursor: 'pointer',
            fontSize: 13, textDecoration: 'underline', flexShrink: 0, padding: 0,
          }}
        >Cancel</button>
      </div>
    );
  }

  if (result) {
    return (
      <div style={{
        background: result.success ? '#f0fdf4' : '#fef2f2',
        border: `1px solid ${result.success ? '#86efac' : '#fca5a5'}`,
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 8,
      }}>
        <div style={{
          fontWeight: 700, fontSize: 14,
          color: result.success ? '#15803d' : '#dc2626',
          marginBottom: 4,
        }}>
          {result.success ? '✓ Action submitted' : '✗ Submission failed'}
        </div>
        <div style={{ fontSize: 15, color: '#374151', lineHeight: 1.4 }}>{result.message}</div>
        {result.referenceNumber && (
          <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
            Ref: {result.referenceNumber}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      background: '#fafafa',
      border: '1px solid #d1d5db',
      borderRadius: 8,
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: '#1e3a5f',
        padding: '7px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{ fontSize: 14 }}>📋</span>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Proposed Action</div>
          <div style={{ fontSize: 13, color: '#93c5fd' }}>{action.taskName}</div>
        </div>
      </div>

      {/* Summary */}
      <div style={{
        padding: '7px 10px',
        fontSize: 14,
        color: '#374151',
        lineHeight: 1.4,
        borderBottom: '1px solid #e5e7eb',
        fontStyle: 'italic',
      }}>
        {action.summary}
      </div>

      {/* Fields */}
      <div style={{ padding: '4px 0' }}>
        {editedFields.map(field => {
          const span = evidenceFor(field.key);
          return (
            <div key={field.key} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderBottom: '1px solid #f3f4f6',
              gap: 6,
            }}>
              <div style={{ fontSize: 13, color: '#6b7280', width: 180, flexShrink: 0, fontWeight: 600 }}>
                {field.label}
              </div>
              {editingKey === field.key ? (
                <div style={{ flex: 1, display: 'flex', gap: 4 }}>
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingKey(null); }}
                    style={{
                      flex: 1, fontSize: 14, padding: '2px 6px',
                      border: '1px solid #1a56db', borderRadius: 4, outline: 'none',
                    }}
                  />
                  <button
                    onClick={saveEdit}
                    style={{
                      fontSize: 13, padding: '2px 6px', borderRadius: 4, border: 'none',
                      background: '#1a56db', color: '#fff', cursor: 'pointer',
                    }}
                  >✓</button>
                </div>
              ) : (
                <>
                  <div style={{ flex: 1, fontSize: 14, color: '#111' }}>
                    {field.value || '—'}
                    {evidence != null && !span && (
                      <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
                        not located in transcript
                      </div>
                    )}
                  </div>
                  {span && (
                    <button
                      onClick={e => { e.stopPropagation(); jumpToEvidence(span.messageId); }}
                      title="Show where this was said in the transcript"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 15, color: '#b45309', padding: '1px 3px',
                        flexShrink: 0, lineHeight: 1,
                      }}
                    >⌖</button>
                  )}
                  <button
                    onClick={() => startEdit(field)}
                    title="Edit"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 14, color: '#9ca3af', padding: '1px 3px',
                      flexShrink: 0,
                    }}
                  >✏️</button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '7px 10px',
        borderTop: '1px solid #e5e7eb',
        gap: 6,
      }}>
        <button
          onClick={handleReject}
          disabled={submitting}
          style={{
            fontSize: 14, padding: '4px 10px', borderRadius: 6,
            border: '1px solid #e5e7eb', background: '#fff',
            color: '#374151', cursor: 'pointer',
          }}
        >✗ Reject</button>
        <button
          onClick={isClientSubmit ? handleSendToClient : handleSubmit}
          disabled={submitting || editingKey !== null}
          style={{
            fontSize: 14, padding: '4px 12px', borderRadius: 6, border: 'none',
            background: submitting ? '#9ca3af' : '#16a34a',
            color: '#fff', cursor: submitting ? 'default' : 'pointer',
            fontWeight: 600,
          }}
        >{isClientSubmit ? '→ Send to client' : (submitting ? 'Submitting…' : '✓ Submit Action')}</button>
      </div>
    </div>
  );
}
