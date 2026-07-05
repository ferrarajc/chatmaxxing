import React, { useRef, useState } from 'react';
import { ContactSlot, AutopilotScope, AUTOPILOT_SCOPE_LABELS } from '../types';
import { useAgentStore } from '../store/agentStore';
import { AutopilotMenu } from './AutopilotMenu';
import { AutopilotCountdown } from './AutopilotCountdown';
import { ChangeToMenu } from './ChangeToMenu';
import { MagicMenu } from './MagicMenu';
import { EditableReply } from './EditableReply';
import { ProposedActionCard } from './ProposedActionCard';
import { logReplyEvent } from '../api/replyLog';

interface Props {
  slot: ContactSlot;
  /** Send the suggested reply (triggers a fresh suggestion afterward). */
  onSend: (message: string) => void;
  /** Send a resource link (does NOT refresh the suggestion). */
  onSendResource: (message: string) => void;
  onActivateAutopilot: (scope: AutopilotScope) => void;
  /** Author a brand-new suggested reply along the chosen "Change to" direction (new meaning). */
  onChangeTo: (direction: string) => void;
  /** Restyle the current suggested reply per a "Magic" preset/custom style (same meaning). */
  onMagic: (style: string) => void;
}

export function AISupport({ slot, onSend, onSendResource, onActivateAutopilot, onChangeTo, onMagic }: Props) {
  const store = useAgentStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingSuggestion, setEditingSuggestion] = useState(false);
  const [changeMenuOpen, setChangeMenuOpen] = useState(false);
  const [magicMenuOpen, setMagicMenuOpen] = useState(false);
  const autopilotBtnRef = useRef<HTMLButtonElement>(null);
  const changeBtnRef = useRef<HTMLButtonElement>(null);
  const magicBtnRef = useRef<HTMLButtonElement>(null);

  // The suggested reply entry currently on screen (at the paged index).
  const currentEntry = slot.suggestionHistory[slot.suggestionIndex];
  const currentSuggestion = currentEntry?.text ?? '';
  const suggestionAtStart = slot.suggestionIndex <= 0;
  const suggestionAtEnd = slot.suggestionIndex >= slot.suggestionHistory.length - 1;

  const handleSendSuggestion = () => {
    if (!currentSuggestion.trim() || !currentEntry) return;
    logReplyEvent({
      contactId: slot.contactId, clientId: slot.clientId,
      agentUsername: store.agentUsername, agentName: store.agentName,
      path: 'suggested-send', source: currentEntry.source,
      changeDirection: currentEntry.changeDirection, magicStyle: currentEntry.magicStyle,
      originalText: currentEntry.originalText, sentText: currentEntry.text,
      wasEdited: currentEntry.text !== currentEntry.originalText,
    });
    onSend(currentSuggestion);
  };

  const handleChangeSelect = (direction: string) => {
    setChangeMenuOpen(false);
    onChangeTo(direction);
  };

  const handleMagicSelect = (style: string) => {
    setMagicMenuOpen(false);
    onMagic(style);
  };

  const handleSendResource = (resource: { title: string; url: string }) => {
    onSendResource(`Here's a helpful resource:\n[${resource.title}](${resource.url})`);
  };

  const exitAutopilot = () => {
    store.patchSlot(slot.contactId, {
      autopilotScope: null, autopilotFlash: true, autopilotPending: null,
      autopilotPaused: false, autopilotSendAt: null, autopilotPausedRemainingMs: null,
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
          fontWeight: 700, color: '#374151', fontSize: 14,
          textTransform: 'uppercase', letterSpacing: '.5px',
        }}>
          🤖 AI
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', zIndex: 2 }}>
          {displayScope && (
            <>
              <style>{`
                @keyframes scopePop {
                  0%   { color: #f59e0b; transform: scale(1.25); letter-spacing: .6px; }
                  50%  { color: #d97706; transform: scale(1.1);  letter-spacing: .4px; }
                  100% { color: ${scopeColor}; transform: scale(1);    letter-spacing: normal; }
                }
              `}</style>
              <span
                key={displayScope}
                style={{
                  fontSize: 13, fontWeight: 600, color: scopeColor,
                  display: 'inline-block',
                  animation: !isActive ? 'scopePop 900ms ease-out forwards' : 'none',
                }}
              >
                {AUTOPILOT_SCOPE_LABELS[displayScope]}
              </span>
            </>
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
                justifyContent: 'center', fontSize: 15, padding: 0, flexShrink: 0,
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

        {/* Autopilot exit reason */}
        {slot.autopilotExitMessage && !slot.autopilotScope && (
          <div style={{
            color: '#9ca3af',
            fontStyle: 'italic',
            textAlign: 'center',
            fontSize: 13,
            padding: '6px 8px 4px',
            marginBottom: 6,
          }}>
            {slot.autopilotExitMessage}
          </div>
        )}

        {/* Proposed Action Card — shown when get-intent has collected all fields */}
        {slot.proposedAction && !slot.autopilotScope && (
          <ProposedActionCard slot={slot} />
        )}

        {/* Autopilot pending send */}
        {slot.autopilotPending && (
          <div style={{
            background: '#fff', borderRadius: 8, padding: '8px 10px',
            marginBottom: 8, border: '1px solid #86efac',
            // A white card + shadow so it clearly floats ABOVE the column's green autopilot
            // overlay (a green fill blended in and read as "underneath").
            position: 'relative', zIndex: 2,
            boxShadow: '0 3px 12px rgba(0,0,0,0.15)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 14, color: '#15803d', fontWeight: 600, marginBottom: 4,
            }}>
              <span>Autopilot sending…</span>
              <AutopilotCountdown
                sendAt={slot.autopilotSendAt}
                pausedRemainingMs={slot.autopilotPausedRemainingMs}
                paused={slot.autopilotPaused}
                fontSize={14}
              />
            </div>
            {/* Editable — clicking in pauses autopilot; the edited text is what sends. */}
            <EditableReply
              value={slot.autopilotPending}
              onChange={t => store.patchSlot(slot.contactId, { autopilotPending: t })}
              onFocus={() => store.patchSlot(slot.contactId, { autopilotPaused: true })}
              style={{ color: '#166534', lineHeight: 1.5, fontSize: 15 }}
            />
          </div>
        )}

        {/* Suggested reply — editable, with a per-conversation history + pagination.
            Shown when autopilot is off and no proposed action pending. */}
        {!slot.autopilotScope && !slot.proposedAction && slot.suggestionHistory.length > 0 && (
          <div style={{
            background: editingSuggestion ? '#f5f9ff' : '#eff6ff',
            borderRadius: 8, padding: '8px 10px', marginBottom: 8,
            border: editingSuggestion ? '1.5px solid #3b82f6' : '1px solid #bfdbfe',
          }}>
            {/* Header row: label + loading spinner (left), pager chevrons (right) */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, color: '#1d4ed8', fontWeight: 600 }}>Suggested reply</span>
                {slot.suggestionLoading && (
                  <span style={{
                    width: 12, height: 12, borderRadius: '50%',
                    border: '2px solid #bfdbfe', borderTopColor: '#1d4ed8',
                    display: 'inline-block', animation: 'spin .7s linear infinite',
                  }} />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PagerChevron dir="left" disabled={suggestionAtStart}
                  onClick={() => store.paginateSuggestion(slot.contactId, -1)} />
                <PagerChevron dir="right" disabled={suggestionAtEnd} badge={slot.suggestionNewBadge}
                  onClick={() => store.paginateSuggestion(slot.contactId, 1)} />
              </div>
            </div>
            <EditableReply
              value={currentSuggestion}
              onChange={t => store.editCurrentSuggestion(slot.contactId, t)}
              onFocus={() => {
                setEditingSuggestion(true);
                store.patchSlot(slot.contactId, { suggestionAutoAdvance: false });
              }}
              onBlur={() => setEditingSuggestion(false)}
              style={{ color: '#1e40af', lineHeight: 1.5, marginBottom: 6, fontSize: 15 }}
            />
            {/* Bottom row: Send (left) + Magic ▼ + Change to ▼ (bottom-right). */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={handleSendSuggestion}
                style={{
                  fontSize: 14, padding: '3px 10px', borderRadius: 6, border: 'none',
                  background: '#1a56db', color: '#fff', cursor: 'pointer', fontWeight: 600,
                }}
              >Send</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  ref={magicBtnRef}
                  onClick={() => setMagicMenuOpen(o => !o)}
                  title="Restyle this suggestion — same meaning, new presentation"
                  style={{
                    fontSize: 13, padding: '3px 8px', borderRadius: 6,
                    border: '1px solid #ddd6fe', background: '#fff', color: '#7c3aed',
                    cursor: 'pointer', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                ><span aria-hidden="true">🪄</span>Magic <span style={{ fontSize: 9 }}>▼</span></button>
                <button
                  ref={changeBtnRef}
                  onClick={() => setChangeMenuOpen(o => !o)}
                  title="Change this suggestion to something else"
                  style={{
                    fontSize: 13, padding: '3px 8px', borderRadius: 6,
                    border: '1px solid #bfdbfe', background: '#fff', color: '#1d4ed8',
                    cursor: 'pointer', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >Change to <span style={{ fontSize: 9 }}>▼</span></button>
              </div>
              {magicMenuOpen && (
                <MagicMenu
                  anchorRef={magicBtnRef}
                  onSelect={handleMagicSelect}
                  onClose={() => setMagicMenuOpen(false)}
                />
              )}
              {changeMenuOpen && (
                <ChangeToMenu
                  anchorRef={changeBtnRef}
                  options={currentEntry?.changeOptions ?? null}
                  loading={currentEntry?.changeOptionsLoading ?? false}
                  onSelect={handleChangeSelect}
                  onClose={() => setChangeMenuOpen(false)}
                />
              )}
            </div>
          </div>
        )}

        {/* Relevant resources (hidden when proposed action is pending) */}
        {!slot.proposedAction && slot.suggestedResources.length > 0 && (
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{
              fontSize: 14, color: '#6b7280', fontWeight: 600, marginBottom: 4,
            }}>
              Relevant resources
            </div>
            {slot.suggestedResources.map(r => (
              <div key={r.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#fff', borderRadius: 6, padding: '5px 8px', marginBottom: 4,
                border: '1px solid #e5e7eb',
              }}>
                <span style={{ color: '#374151', flex: 1, fontSize: 14 }}>{r.title}</span>
                <button
                  onClick={() => handleSendResource(r)}
                  style={{
                    fontSize: 13, padding: '2px 7px', borderRadius: 5, border: 'none',
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

// Left/right pager chevron for stepping through the suggested-reply history. Grays out
// when disabled; the right one shows a small red dot when a newer suggestion is unseen.
function PagerChevron({ dir, disabled, badge, onClick }: {
  dir: 'left' | 'right';
  disabled: boolean;
  badge?: boolean;
  onClick: () => void;
}) {
  const points = dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? 'Earlier suggestion' : 'Later suggestion'}
      style={{
        position: 'relative', width: 22, height: 22, padding: 0, border: 'none',
        background: 'transparent', cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: disabled ? '#cbd5e1' : '#1d4ed8',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points={points} />
      </svg>
      {badge && (
        <span style={{
          position: 'absolute', top: 1, right: 1, width: 8, height: 8,
          borderRadius: '50%', background: '#ef4444',
        }} />
      )}
    </button>
  );
}
