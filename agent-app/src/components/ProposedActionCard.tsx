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

  const saveEdit = () => {
    setEditedFields(prev =>
      prev.map(f => f.key === editingKey ? { ...f, value: editValue } : f),
    );
    setEditingKey(null);
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
        // Clear card after short delay so agent sees the success message
        setTimeout(() => {
          store.patchSlot(slot.contactId, { proposedAction: null });
        }, 4000);
      }
    } catch {
      setResult({ success: false, message: 'Submission failed — please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = () => {
    store.patchSlot(slot.contactId, { proposedAction: null });
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
          fontWeight: 700, fontSize: 11,
          color: result.success ? '#15803d' : '#dc2626',
          marginBottom: 4,
        }}>
          {result.success ? '✓ Action submitted' : '✗ Submission failed'}
        </div>
        <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>{result.message}</div>
        {result.referenceNumber && (
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
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
        <span style={{ fontSize: 11 }}>📋</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Proposed Action</div>
          <div style={{ fontSize: 10, color: '#93c5fd' }}>{action.taskName}</div>
        </div>
      </div>

      {/* Summary */}
      <div style={{
        padding: '7px 10px',
        fontSize: 11,
        color: '#374151',
        lineHeight: 1.4,
        borderBottom: '1px solid #e5e7eb',
        fontStyle: 'italic',
      }}>
        {action.summary}
      </div>

      {/* Fields */}
      <div style={{ padding: '4px 0' }}>
        {editedFields.map(field => (
          <div key={field.key} style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 10px',
            borderBottom: '1px solid #f3f4f6',
            gap: 6,
          }}>
            <div style={{ fontSize: 10, color: '#6b7280', width: 90, flexShrink: 0, fontWeight: 600 }}>
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
                    flex: 1, fontSize: 11, padding: '2px 6px',
                    border: '1px solid #1a56db', borderRadius: 4, outline: 'none',
                  }}
                />
                <button
                  onClick={saveEdit}
                  style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4, border: 'none',
                    background: '#1a56db', color: '#fff', cursor: 'pointer',
                  }}
                >✓</button>
              </div>
            ) : (
              <>
                <div style={{ flex: 1, fontSize: 11, color: '#111' }}>{field.value || '—'}</div>
                <button
                  onClick={() => startEdit(field)}
                  title="Edit"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, color: '#9ca3af', padding: '1px 3px',
                    flexShrink: 0,
                  }}
                >✏</button>
              </>
            )}
          </div>
        ))}
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
            fontSize: 11, padding: '4px 10px', borderRadius: 6,
            border: '1px solid #e5e7eb', background: '#fff',
            color: '#374151', cursor: 'pointer',
          }}
        >✗ Reject</button>
        <button
          onClick={handleSubmit}
          disabled={submitting || editingKey !== null}
          style={{
            fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none',
            background: submitting ? '#9ca3af' : '#16a34a',
            color: '#fff', cursor: submitting ? 'default' : 'pointer',
            fontWeight: 600,
          }}
        >{submitting ? 'Submitting…' : '✓ Submit Action'}</button>
      </div>
    </div>
  );
}
