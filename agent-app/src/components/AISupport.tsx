import React from 'react';
import { ContactSlot } from '../types';
import { useAgentStore } from '../store/agentStore';

interface Props { slot: ContactSlot; }

export function AISupport({ slot }: Props) {
  const store = useAgentStore();

  const handleInsert = () => {
    if (slot.suggestedText) store.insertSuggestion(slot.contactId);
  };

  const handleSendResource = (resource: { title: string; url: string }) => {
    store.appendMessage(slot.contactId, {
      role: 'AGENT',
      content: `Here's a helpful resource: **${resource.title}** — ${resource.url}`,
    });
    store.patchSlot(slot.contactId, { lastAgentMessageAt: Date.now() });
  };

  return (
    <div style={{ padding: '10px 12px', background: '#f8fafc', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: '#374151', marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>
        🤖 AI Suggestions
      </div>

      {/* Next best response */}
      {slot.suggestedText ? (
        <div style={{ background: '#eff6ff', borderRadius: 8, padding: '8px 10px', marginBottom: 8, border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 600, marginBottom: 4 }}>Suggested reply</div>
          <div style={{ color: '#1e40af', lineHeight: 1.5, marginBottom: 6 }}>{slot.suggestedText}</div>
          <button
            onClick={handleInsert}
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none',
              background: '#1a56db', color: '#fff', cursor: 'pointer', fontWeight: 600,
            }}
          >Insert ↑</button>
        </div>
      ) : (
        <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>Waiting for next message…</div>
      )}

      {/* Resources */}
      {slot.suggestedResources.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>Relevant resources</div>
          {slot.suggestedResources.map(r => (
            <div key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#fff', borderRadius: 6, padding: '5px 8px', marginBottom: 4,
              border: '1px solid #e5e7eb',
            }}>
              <span style={{ color: '#374151', flex: 1, fontSize: 11 }}>{r.title}</span>
              <button
                onClick={() => handleSendResource(r)}
                style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 5, border: 'none',
                  background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 600, flexShrink: 0,
                }}
              >Send</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
