import React, { useEffect, useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { ApprovalForm, ApprovalFormField } from '../../types';
import { theme } from '../../theme';

interface Props {
  form: ApprovalForm;
  onSubmit: (fields: { key: string; value: string }[]) => void;
  onDecline: () => void;
}

/**
 * Customer-facing "Your approval is required" card for a Type 3 proposed action the
 * agent sent. Mirrors the agent's Proposed Action card (editable fields + summary) but
 * has no evidence-jump buttons; the customer submits or declines it themselves.
 */
export function ApprovalFormCard({ form, onSubmit, onDecline }: Props) {
  const submitting = useChatStore(s => s.approvalSubmitting);
  const [editedFields, setEditedFields] = useState<ApprovalFormField[]>(form.fields);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Re-sync when a different form arrives (rare: agent re-sends without a clear in between).
  useEffect(() => { setEditedFields(form.fields); setEditingKey(null); }, [form]);

  const startEdit = (field: ApprovalFormField) => {
    setEditingKey(field.key);
    setEditValue(field.value);
  };
  const saveEdit = () => {
    setEditedFields(prev => prev.map(f => f.key === editingKey ? { ...f, value: editValue } : f));
    setEditingKey(null);
  };

  const handleSubmit = () => {
    if (submitting || editingKey !== null) return;
    onSubmit(editedFields.map(f => ({ key: f.key, value: f.value })));
  };

  return (
    <div style={{
      background: theme.color.surface,
      border: `1px solid ${theme.color.borderStrong}`,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      boxShadow: theme.shadow.sm,
      // ChatBody is a flex-column scroll container; without this the card's
      // overflow:hidden lets flexbox shrink it to a sliver to fit the messages.
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        background: theme.color.primary,
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{ fontSize: 14 }}>📋</span>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: theme.color.textOnPrimary, fontFamily: theme.font.serif }}>
            Your approval is required
          </div>
          <div style={{ fontSize: 12.5, color: theme.color.primarySoft }}>{form.taskName}</div>
        </div>
      </div>

      {/* Summary */}
      <div style={{
        padding: '8px 12px',
        fontSize: 13.5,
        color: theme.color.text,
        lineHeight: 1.45,
        borderBottom: `1px solid ${theme.color.border}`,
        fontStyle: 'italic',
      }}>
        {form.summary}
      </div>

      {/* Fields */}
      <div style={{ padding: '4px 0' }}>
        {editedFields.map(field => (
          <div key={field.key} style={{
            display: 'flex',
            alignItems: 'center',
            padding: '5px 12px',
            borderBottom: `1px solid ${theme.color.border}`,
            gap: 6,
          }}>
            <div style={{ fontSize: 12.5, color: theme.color.textMuted, width: 150, flexShrink: 0, fontWeight: 600 }}>
              {field.label}
            </div>
            {editingKey === field.key ? (
              <div style={{ flex: 1, display: 'flex', gap: 4, minWidth: 0 }}>
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingKey(null); }}
                  style={{
                    flex: 1, minWidth: 0, fontSize: 13.5, padding: '3px 6px',
                    border: `1px solid ${theme.color.primary}`, borderRadius: theme.radius.sm, outline: 'none',
                    fontFamily: theme.font.sans, color: theme.color.text,
                  }}
                />
                <button
                  onClick={saveEdit}
                  style={{
                    fontSize: 13, padding: '3px 7px', borderRadius: theme.radius.sm, border: 'none',
                    background: theme.color.primary, color: theme.color.textOnPrimary, cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >✓</button>
              </div>
            ) : (
              <>
                <div style={{ flex: 1, fontSize: 13.5, color: theme.color.text }}>{field.value || '—'}</div>
                <button
                  onClick={() => startEdit(field)}
                  title="Edit"
                  disabled={submitting}
                  style={{
                    background: 'none', border: 'none', cursor: submitting ? 'default' : 'pointer',
                    fontSize: 13, color: theme.color.textSubtle, padding: '1px 3px', flexShrink: 0,
                  }}
                >✏️</button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 12px',
        gap: 6,
      }}>
        <button
          onClick={onDecline}
          disabled={submitting}
          style={{
            fontSize: 13.5, padding: '6px 12px', borderRadius: theme.radius.md,
            border: `1px solid ${theme.color.border}`, background: theme.color.surface,
            color: theme.color.text, cursor: submitting ? 'default' : 'pointer',
            fontFamily: theme.font.sans,
          }}
        >Decline</button>
        <button
          onClick={handleSubmit}
          disabled={submitting || editingKey !== null}
          style={{
            fontSize: 13.5, padding: '6px 16px', borderRadius: theme.radius.md, border: 'none',
            background: submitting ? theme.color.textSubtle : theme.color.success,
            color: '#fff', cursor: submitting ? 'default' : 'pointer',
            fontWeight: 600, fontFamily: theme.font.sans,
          }}
        >{submitting ? 'Submitting…' : 'Submit action'}</button>
      </div>
    </div>
  );
}
