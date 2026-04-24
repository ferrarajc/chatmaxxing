import React, { useRef, useState } from 'react';
import { ContactSlot, AutopilotScope, AUTOPILOT_SCOPE_LABELS } from '../types';
import { useAgentStore } from '../store/agentStore';
import { AutopilotMenu } from './AutopilotMenu';

interface Props {
  slot: ContactSlot;
  onSendResource: (message: string) => void;
  onActivateAutopilot: (scope: AutopilotScope) => void;
}

export function AISupport({ slot, onSendResource, onActivateAutopilot }: Props) {
  const store = useAgentStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const autopilotBtnRef = useRef<HTMLButtonElement>(null);

  const handleInsert = () => {
    if (slot.suggestedText) store.insertSuggestion(slot.contactId);
  };

  const handleSendResource = (resource: { title: string; url: string }) => {
    onSendResource(`Here's a helpful resource: ${resource.title}\n${resource.url}`);
  };

  const exitAutopilot = () => {
    store.patchSlot(slot.contactId, {
      autopilotScope: null, autopilotFlash: true, autopilotPending: null,
    });
    setTimeout(() => store.patchSlot(slot.contactId, { autopilotFlash: false }), 100);
  };

  const handleAutopilotClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (slot.autopilotScope !== null) {
      // Already active — clicking the icon exits autopilot
      exitAutopilot();
      return;
    }
    // If menu is open and there's a suggested scope, double-click activates it
    if (menuOpen && slot.suggestedScope) {
      setMenuOpen(false);
      onActivateAutopilot(slot.suggestedScope);
      return;
    }
    setMenuOpen(prev => !prev);
  };

  const handleScopeSelect = (scope: AutopilotScope) => {
    setMenuOpen(false);
    onActivateAutopilot(scope);
  };

  const isActive = slot.autopilotScope !== null;
  const displayScope = slot.autopilotScope ?? slot.suggestedScope;
  const scopeColor = isActive ? '#22c55e' : '#374151';

  return (
    // stopPropagation so clicks inside the AI panel don't bubble to the
    // column wrapper's click-to-exit-autopilot handler
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      onClick={e => e.stopPropagation()}
    >
      {/* ── Fixed header ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 12px', background: '#f8fafc',
        borderBottom: '1px solid #f0f4f8', flexShrink: 0,
      }}>
        <div style={{
          fontWeight: 700, color: '#374151', fontSize: 11,
          textTransform: 'uppercase', letterSpacing: '.5px',
        }}>
          🤖 AI
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {displayScope && (
            <span style={{ fontSize: 10, fontWeight: 600, color: scopeColor }}>
              {AUTOPILOT_SCOPE_LABELS[displayScope]}
            </span>
          )}
          <div style={{ position: 'relative' }}>
            <button
              ref={autopilotBtnRef}
              onClick={handleAutopilotClick}
              title={isActive ? 'Click to exit autopilot' : 'Open autopilot menu'}
              style={{
                width: 22, height: 22, borderRadius: '50%', border: 'none',
                background: isActive ? '#22c55e' : 'transparent',
                outline: isActive ? 'none' : '1.5px solid #9ca3af',
                color: isActive ? '#fff' : '#6b7280',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 12, padding: 0, flexShrink: 0,
                transition: 'background .15s, color .15s',
              }}
            >✈</button>
            {menuOpen && (
              <AutopilotMenu
                onSelect={handleScopeSelect}
                onClose={() => setMenuOpen(false)}
                anchorRef={autopilotBtnRef}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>

        {/* Autopilot pending send */}
        {slot.autopilotPending && (
          <div style={{
            background: '#f0fdf4', borderRadius: 8, padding: '8px 10px',
            marginBottom: 8, border: '1px solid #bbf7d0',
          }}>
            <div style={{ fontSize: 11, color: '#15803d', fontWeight: 600, marginBottom: 4 }}>
              ⏳ Autopilot sending…
            </div>
            <div style={{ color: '#166534', lineHeight: 1.5, fontSize: 12 }}>
              {slot.autopilotPending}
            </div>
          </div>
        )}

        {/* Suggested reply (only shown when autopilot is off) */}
        {!slot.autopilotScope && slot.suggestedText && (
          <div style={{
            background: '#eff6ff', borderRadius: 8, padding: '8px 10px',
            marginBottom: 8, border: '1px solid #bfdbfe',
          }}>
            <div style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 600, marginBottom: 4 }}>
              Suggested reply
            </div>
            <div style={{ color: '#1e40af', lineHeight: 1.5, marginBottom: 6, fontSize: 12 }}>
              {slot.suggestedText}
            </div>
            <button
              onClick={handleInsert}
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none',
                background: '#1a56db', color: '#fff', cursor: 'pointer', fontWeight: 600,
              }}
            >Insert ↑</button>
          </div>
        )}

        {/* Relevant resources */}
        {slot.suggestedResources.length > 0 && (
          <div>
            <div style={{
              fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4,
            }}>
              Relevant resources
            </div>
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
                    background: '#10b981', color: '#fff', cursor: 'pointer',
                    fontWeight: 600, flexShrink: 0,
                  }}
                >Send</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
