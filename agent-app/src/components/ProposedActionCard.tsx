import React, { useState } from 'react';
import { ContactSlot, ProposedActionField } from '../types';
import { useAgentStore } from '../store/agentStore';
import { post } from '../api/client';

interface Props {
  slot: ContactSlot;
}

interface ExecuteTaskResult {
  success: boolean;
  message: string;
  referenceNumber?: string;
}

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

  const toPastTense = (summary: string): string => {
    const verbMap: Record<string, string> = {
      Update: 'Updated', Add: 'Added', Remove: 'Removed', Change: 'Changed',
      Schedule: 'Scheduled', Cancel: 'Cancelled', Grant: 'Granted',
      Transfer: 'Transferred', Set: 'Set', Enable: 'Enabled', Disable: 'Disabled',
      Replace: 'Replaced', Modify: 'Modified', Close: 'Closed',
    };
    return summary.replace(/^\w+/, w => verbMap[w] ?? (w.endsWith('e') ? w + 'd' : w + 'ed'));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const fieldsMap: Record<string, string> = {};
    for (const f of editedFields) fieldsMap[f.key] = f.value;

    try {
      const res = await post<ExecuteTaskResult>('/execute-task', {
        taskId: action.taskId,
        clientId: slot.clientId,
        fields: fieldsMap,
      });
      setResult(res);
      if (res.success) {
        const description = toPastTense(action.summary);
        const clientMsg = res.referenceNumber
          ? `Confirmation\nRef: ${res.referenceNumber}\n\n${description}`
          : `Confirmation\n\n${description}`;
        store.appendMessage(slot.contactId, { role: 'AGENT', content: clientMsg });
        if (slot.connectionToken) {
          post<{ ok: boolean }>('/send-agent-message', {
            connectionToken: slot.connectionToken,
            message: clientMsg,
          }).catch(() => {});
        }
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

  const handleReject = () => {
    store.patchSlot(slot.contactId, { proposedAction: null, proposedActionEvidence: null });
  };

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
          onClick={handleSubmit}
          disabled={submitting || editingKey !== null}
          style={{
            fontSize: 14, padding: '4px 12px', borderRadius: 6, border: 'none',
            background: submitting ? '#9ca3af' : '#16a34a',
            color: '#fff', cursor: submitting ? 'default' : 'pointer',
            fontWeight: 600,
          }}
        >{submitting ? 'Submitting…' : '✓ Submit Action'}</button>
      </div>
    </div>
  );
}
