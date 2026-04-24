import React from 'react';
import { ContactSlot } from '../types';
import { useAgentStore } from '../store/agentStore';

interface Props {
  slot: ContactSlot;
  onSendResource: (message: string) => void;
}

export function AISupport({ slot, onSendResource }: Props) {
  const store = useAgentStore();

  const handleInsert = () => {
    if (slot.suggestedText) store.insertSuggestion(slot.contactId);
  };

  const handleSendResource = (resource: { title: string; url: string }) => {
    const message = `Here's a helpful resource: ${resource.title}\n${resource.url}`;
    onSendResource(message);
  };

  const toggleAutopilot = () => {
    store.patchSlot(slot.contactId, { isAutopilot: !slot.isAutopilot });
  };

  return (
    <div style={{ padding: '6px 12px 10px', background: '#f8fafc', fontSize: 12 }}>
      {/* Header row: label + autopilot toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontWeight: 700, color: '#374151', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>
          AI Suggestions
        </div>
        <button
          onClick={toggleAutopilot}
          title="Autopilot"
          style={{
            width: 22, height: 22, borderRadius: '50%', border: 'none',
            background: slot.isAutopilot ? '#22c55e' : 'transparent',
            outline: slot.isAutopilot ? 'none' : '1.5px solid #9ca3af',
            color: slot.isAutopilot ? '#fff' : '#6b7280',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, padding: 0, flexShrink: 0,
            transition: 'background .15s, outline .15s, color .15s',
          }}
        >
          ✈
        </button>
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
      ) : null}

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
