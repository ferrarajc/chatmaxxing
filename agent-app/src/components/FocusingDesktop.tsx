import React, { useEffect, useRef, useState } from 'react';
import { ContactSlot, AutopilotScope, AUTOPILOT_SCOPE_LABELS, ChatMessage } from '../types';
import { useAgentStore } from '../store/agentStore';
import { post } from '../api/client';
import { log } from '../api/logger';
import { CLIENT_PROFILES, DEFAULT_PROFILE, ClientProfile } from '../data/clientProfiles';
import { ProposedActionCard } from './ProposedActionCard';
import { AfterCallWork } from './AfterCallWork';
import { AutopilotMenu } from './AutopilotMenu';
import { ResponseTimer } from './ResponseTimer';

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  bg:              '#f2ede6',
  leftBg:          '#ede8e1',
  rightBg:         '#ffffff',
  divider:         '#d5cfc8',
  cardBg:          '#e4dfd8',
  cardSelected:    '#0f2d5e',
  cardSelectedText:'#ffffff',
  cardIncoming:    '#1a56db',
  cardAcw:         '#7c3aed',
  sectionLabel:    '#8a7d6e',
  accentGold:      '#c4965a',
  agentBubbleBg:   '#0f2d5e',
  agentBubbleText: '#ffffff',
  customerBubbleBg:'#e4dfd8',
  customerBubbleText: '#1a1a1a',
  systemText:      '#9ca3af',
} as const;

// ── Send helper (mirrors ChatColumn.sendText) ─────────────────────────────────
interface StoreSendMethods {
  appendMessage: (contactId: string, msg: { role: 'AGENT' | 'SYSTEM'; content: string }) => void;
  patchSlot: (contactId: string, patch: Record<string, unknown>) => void;
}

function sendText(slot: ContactSlot, text: string, store: StoreSendMethods) {
  store.appendMessage(slot.contactId, { role: 'AGENT', content: text });
  store.patchSlot(slot.contactId, { lastAgentMessageAt: Date.now() });
  if (!slot.connectionToken) {
    store.appendMessage(slot.contactId, {
      role: 'SYSTEM', content: '⚠ Agent token not ready — try again in a moment',
    });
    return;
  }
  post<{ ok: boolean }>('/send-agent-message', {
    connectionToken: slot.connectionToken,
    message: text,
  }).catch((e: unknown) => {
    log.error('FocusingDesktop:send:failed', e);
    store.appendMessage(slot.contactId, {
      role: 'SYSTEM', content: `⚠ Send error: ${String(e).slice(0, 200)}`,
    });
  });
}

// ── FocusingDesktop ───────────────────────────────────────────────────────────
export function FocusingDesktop() {
  const store = useAgentStore();
  const slots = store.slots;
  const pendingInserts = store.pendingInserts;

  // Only non-null slots with actionable status
  const activeSlots = slots.filter(
    s => s !== null && (s.status === 'incoming' || s.status === 'active' || s.status === 'acw'),
  ) as ContactSlot[];

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const autopilotBtnRef = useRef<HTMLButtonElement>(null);
  const [autopilotMenuOpen, setAutopilotMenuOpen] = useState(false);

  // Auto-select first available active/acw contact (prefer active over acw)
  useEffect(() => {
    const active = activeSlots.find(s => s.status === 'active');
    const current = activeSlots.find(s => s.contactId === selectedContactId);
    if (!current) {
      const fallback = active ?? activeSlots[0] ?? null;
      setSelectedContactId(fallback?.contactId ?? null);
    }
  }, [activeSlots.map(s => s.contactId).join(',')]);

  // Reset input when switching contacts
  useEffect(() => { setInputText(''); }, [selectedContactId]);

  // Handle pending suggestion inserts from autopilot
  useEffect(() => {
    if (!selectedContactId) return;
    if (pendingInserts.has(selectedContactId)) {
      const s = store.getSlot(selectedContactId);
      if (s) setInputText(s.suggestedText);
      store.clearInsert(selectedContactId);
    }
  }, [pendingInserts, selectedContactId]);

  // Auto-scroll on new messages
  const selectedSlot = activeSlots.find(s => s.contactId === selectedContactId) ?? null;
  const msgCount = selectedSlot?.messages.length ?? 0;
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgCount]);

  // Handle send
  const handleSend = () => {
    if (!inputText.trim() || !selectedSlot || selectedSlot.status !== 'active') return;
    const text = inputText.trim();
    setInputText('');
    sendText(selectedSlot, text, store);
    if (selectedSlot.autopilotScope === null) {
      store.patchSlot(selectedSlot.contactId, { suggestedScope: null });
    }
  };

  const handleActivateAutopilot = (scope: AutopilotScope) => {
    if (!selectedSlot) return;
    setAutopilotMenuOpen(false);
    store.patchSlot(selectedSlot.contactId, { autopilotScope: scope, suggestedScope: null });
  };

  const handleExitAutopilot = () => {
    if (!selectedSlot) return;
    store.patchSlot(selectedSlot.contactId, {
      autopilotScope: null, autopilotFlash: true, autopilotPending: null,
    });
    setTimeout(() => store.patchSlot(selectedSlot.contactId, { autopilotFlash: false }), 100);
  };

  const handleInsertSuggestion = () => {
    if (selectedSlot?.suggestedText) setInputText(selectedSlot.suggestedText);
  };

  const handleSendResource = (resource: { title: string; url: string }) => {
    if (!selectedSlot) return;
    sendText(selectedSlot, `Here's a helpful resource: ${resource.title}\n${resource.url}`, store);
  };

  const handleAcceptIncoming = (contactId: string) => {
    window.dispatchEvent(new CustomEvent('bobs:acceptContact', { detail: { contactId } }));
  };

  const handleSkipIncoming = (contactId: string) => {
    store.clearSlot(contactId);
    window.dispatchEvent(new CustomEvent('bobs:skipContact', { detail: { contactId } }));
  };

  const clientProfile: ClientProfile =
    CLIENT_PROFILES[selectedSlot?.clientId ?? ''] ?? DEFAULT_PROFILE;

  const isAutopilot = !!selectedSlot?.autopilotScope;
  const displayScope = selectedSlot?.autopilotScope ?? selectedSlot?.suggestedScope;

  return (
    <div style={{
      flex: 1, display: 'grid', minHeight: 0,
      gridTemplateColumns: '220px 1fr 340px',
      background: C.bg,
    }}>

      {/* ── Column 1: Active Contacts ────────────────────────────────────── */}
      <div style={{
        background: C.leftBg, borderRight: `1px solid ${C.divider}`,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        padding: '16px 12px', gap: 10,
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: '#0f2d5e',
          letterSpacing: '.2px', marginBottom: 4,
        }}>
          Active Contacts
        </div>

        {activeSlots.length === 0 && (
          <div style={{ fontSize: 12, color: C.sectionLabel, textAlign: 'center', marginTop: 24, lineHeight: 1.6 }}>
            Waiting for a chat…
          </div>
        )}

        {activeSlots.map(slot => (
          <ContactCard
            key={slot.contactId}
            slot={slot}
            selected={slot.contactId === selectedContactId}
            onClick={() => setSelectedContactId(slot.contactId)}
            onAccept={() => handleAcceptIncoming(slot.contactId)}
            onSkip={() => handleSkipIncoming(slot.contactId)}
          />
        ))}
      </div>

      {/* ── Column 2: Conversation ───────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', minHeight: 0,
        background: C.bg,
      }}>
        {!selectedSlot && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.sectionLabel, fontSize: 13,
          }}>
            Select a contact to get started
          </div>
        )}

        {selectedSlot?.status === 'incoming' && (
          <IncomingConversation
            slot={selectedSlot}
            onAccept={() => handleAcceptIncoming(selectedSlot.contactId)}
            onSkip={() => handleSkipIncoming(selectedSlot.contactId)}
          />
        )}

        {selectedSlot?.status === 'active' && (
          <>
            {/* Conversation header */}
            <div style={{
              padding: '12px 18px', borderBottom: `1px solid ${C.divider}`,
              background: C.leftBg, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f2d5e' }}>
                  Conversation
                </div>
                <div style={{ fontSize: 11, color: C.sectionLabel, marginTop: 1 }}>
                  {selectedSlot.clientName} · {selectedSlot.intentSummary}
                </div>
              </div>
              <ResponseTimer lastEventAt={
                Math.max(
                  selectedSlot.lastAgentMessageAt ?? 0,
                  selectedSlot.lastCustomerMessageAt ?? 0,
                ) || null
              } />
            </div>

            {/* Chat history */}
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8,
              minHeight: 0,
            }}>
              {selectedSlot.messages.map(msg => (
                <FocusMessageBubble key={msg.id} msg={msg} />
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Type area */}
            <div style={{
              padding: '10px 18px',
              borderTop: `1px solid ${C.divider}`,
              background: C.leftBg, flexShrink: 0,
            }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  placeholder="Type a reply…"
                  rows={2}
                  style={{
                    flex: 1, resize: 'none', border: `1.5px solid ${C.divider}`,
                    borderRadius: 10, padding: '8px 12px', fontSize: 13,
                    outline: 'none', fontFamily: 'inherit', background: '#fff',
                    color: '#111',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  style={{
                    width: 40, borderRadius: 10, border: 'none',
                    background: inputText.trim() ? C.cardSelected : C.divider,
                    color: '#fff', cursor: inputText.trim() ? 'pointer' : 'default',
                    fontSize: 16, flexShrink: 0,
                  }}
                >➤</button>
              </div>
            </div>

            {/* Suggested replies */}
            {selectedSlot.suggestedText && !isAutopilot && (
              <div style={{
                padding: '10px 18px 14px',
                borderTop: `2px solid ${C.accentGold}`,
                background: C.leftBg, flexShrink: 0,
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: C.sectionLabel,
                  textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6,
                }}>
                  Suggested Reply
                </div>
                <div
                  onClick={handleInsertSuggestion}
                  style={{
                    background: '#fff', borderRadius: 20,
                    padding: '7px 14px', fontSize: 12, color: '#0f2d5e',
                    display: 'inline-block', cursor: 'pointer',
                    border: `1px solid ${C.divider}`,
                    lineHeight: 1.5, maxWidth: '100%',
                    transition: 'background .12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0ede8')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  {selectedSlot.suggestedText}
                </div>
              </div>
            )}
          </>
        )}

        {selectedSlot?.status === 'acw' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{
              padding: '12px 18px', borderBottom: `1px solid ${C.divider}`,
              background: C.leftBg, flexShrink: 0,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f2d5e' }}>
                {selectedSlot.clientName}
              </div>
              <div style={{ fontSize: 11, color: C.sectionLabel, marginTop: 1 }}>
                After call work
              </div>
            </div>
            <AfterCallWork slot={selectedSlot} />
          </div>
        )}
      </div>

      {/* ── Column 3: AI Support ─────────────────────────────────────────── */}
      <div style={{
        background: C.rightBg, borderLeft: `1px solid ${C.divider}`,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        minHeight: 0,
      }}>
        <div style={{
          padding: '12px 16px', borderBottom: `1px solid #f0ede8`,
          fontWeight: 700, fontSize: 15, color: '#0f2d5e', flexShrink: 0,
        }}>
          AI Support
        </div>

        {!selectedSlot && (
          <div style={{ padding: 16, color: C.sectionLabel, fontSize: 12 }}>
            Select a chat to see AI support
          </div>
        )}

        {selectedSlot && (
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Autopilot section */}
            {selectedSlot.status === 'active' && (
              <AISupportSection label="Autopilot">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {displayScope && (
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: isAutopilot ? '#22c55e' : '#374151',
                    }}>
                      {AUTOPILOT_SCOPE_LABELS[displayScope]}
                    </span>
                  )}
                  <div style={{ position: 'relative' }}>
                    <button
                      ref={autopilotBtnRef}
                      onClick={e => {
                        e.stopPropagation();
                        if (isAutopilot) { handleExitAutopilot(); return; }
                        setAutopilotMenuOpen(p => !p);
                      }}
                      style={{
                        padding: '5px 12px', borderRadius: 20, border: 'none',
                        background: isAutopilot ? '#22c55e' : C.cardSelected,
                        color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <span>✈</span>
                      <span>{isAutopilot ? 'Exit Autopilot' : 'Activate…'}</span>
                    </button>
                    {autopilotMenuOpen && (
                      <AutopilotMenu
                        onSelect={handleActivateAutopilot}
                        onClose={() => setAutopilotMenuOpen(false)}
                        anchorRef={autopilotBtnRef}
                      />
                    )}
                  </div>
                </div>

                {/* Pending autopilot send */}
                {selectedSlot.autopilotPending && (
                  <div style={{
                    background: '#f0fdf4', borderRadius: 8, padding: '7px 10px',
                    marginTop: 8, border: '1px solid #bbf7d0',
                  }}>
                    <div style={{ fontSize: 10, color: '#15803d', fontWeight: 700, marginBottom: 3 }}>
                      ⏳ Sending…
                    </div>
                    <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.5 }}>
                      {selectedSlot.autopilotPending}
                    </div>
                  </div>
                )}
              </AISupportSection>
            )}

            {/* Proposed action — most prominent when present */}
            {selectedSlot.proposedAction && !selectedSlot.autopilotScope && (
              <AISupportSection label="Proposed Action">
                <ProposedActionCard slot={selectedSlot} />
              </AISupportSection>
            )}

            {/* Suggested reply (also in right panel) */}
            {selectedSlot.status === 'active' && selectedSlot.suggestedText && !isAutopilot && !selectedSlot.proposedAction && (
              <AISupportSection label="Suggested Reply">
                <div style={{
                  background: '#eff6ff', borderRadius: 8, padding: '8px 10px',
                  border: '1px solid #bfdbfe', fontSize: 12, color: '#1e40af',
                  lineHeight: 1.5, marginBottom: 6,
                }}>
                  {selectedSlot.suggestedText}
                </div>
                <button
                  onClick={handleInsertSuggestion}
                  style={{
                    fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none',
                    background: '#1a56db', color: '#fff', cursor: 'pointer', fontWeight: 600,
                  }}
                >Insert ↑</button>
              </AISupportSection>
            )}

            {/* Quick actions */}
            {selectedSlot.status === 'active' && (
              <QuickActionsSection
                slot={selectedSlot}
                onSendText={text => sendText(selectedSlot, text, store)}
                onActivateScope={handleActivateAutopilot}
              />
            )}

            {/* Resources */}
            {selectedSlot.suggestedResources.length > 0 && !selectedSlot.proposedAction && (
              <AISupportSection label="Resources">
                {selectedSlot.suggestedResources.map(r => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 0', borderBottom: `1px solid #f3f4f6`,
                  }}>
                    <span style={{ flex: 1, fontSize: 11, color: '#374151', lineHeight: 1.3 }}>
                      {r.title}
                    </span>
                    <button
                      onClick={() => handleSendResource(r)}
                      style={{
                        fontSize: 10, padding: '3px 8px', borderRadius: 5, border: 'none',
                        background: '#10b981', color: '#fff', cursor: 'pointer',
                        fontWeight: 600, flexShrink: 0,
                      }}
                    >Send</button>
                  </div>
                ))}
              </AISupportSection>
            )}

            {/* Client context */}
            <ClientContextSection profile={clientProfile} slot={selectedSlot} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AISupportSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: C.sectionLabel,
        textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 8,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

interface ContactCardProps {
  slot: ContactSlot;
  selected: boolean;
  onClick: () => void;
  onAccept: () => void;
  onSkip: () => void;
}

function ContactCard({ slot, selected, onClick, onAccept, onSkip }: ContactCardProps) {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (slot.status !== 'incoming') return;
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(tick); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [slot.status]);

  const isIncoming = slot.status === 'incoming';
  const isAcw      = slot.status === 'acw';
  const isSelected = selected && !isIncoming;

  const timerColor = countdown > 6 ? '#10b981' : countdown > 3 ? '#f59e0b' : '#ef4444';

  const bg = isSelected ? C.cardSelected : isIncoming ? '#dbeafe' : isAcw ? '#f5f3ff' : C.cardBg;
  const textColor = isSelected ? C.cardSelectedText : '#0f2d5e';
  const subColor  = isSelected ? '#93c5fd' : C.sectionLabel;
  const border    = isIncoming
    ? `2px solid ${C.cardIncoming}`
    : isAcw
    ? `1.5px solid ${C.cardAcw}`
    : selected
    ? `2px solid ${C.cardSelected}`
    : `1.5px solid ${C.divider}`;

  return (
    <div
      onClick={!isIncoming ? onClick : undefined}
      style={{
        background: bg, borderRadius: 10, padding: '10px 12px',
        cursor: isIncoming ? 'default' : 'pointer',
        border,
        transition: 'background .12s, border-color .12s',
        position: 'relative',
        animation: isIncoming ? 'focusPulse 1.8s ease-in-out infinite' : 'none',
      }}
    >
      <style>{`
        @keyframes focusPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(26,86,219,0.35); }
          50%       { box-shadow: 0 0 0 6px rgba(26,86,219,0); }
        }
      `}</style>

      {/* Incoming: timer badge */}
      {isIncoming && (
        <div style={{
          position: 'absolute', top: 8, right: 10,
          width: 24, height: 24, borderRadius: '50%',
          border: `3px solid ${timerColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color: timerColor,
        }}>
          {countdown}
        </div>
      )}

      <div style={{ fontWeight: 700, fontSize: 13, color: textColor, marginBottom: 2 }}>
        {slot.clientName}
        {slot.bonusEligible && (
          <span style={{
            marginLeft: 6, fontSize: 10, background: '#f59e0b',
            color: '#fff', borderRadius: 4, padding: '1px 5px', fontWeight: 700,
          }}>$50</span>
        )}
      </div>

      <div style={{ fontSize: 11, color: subColor, lineHeight: 1.4 }}>
        {isIncoming ? 'Incoming chat' : isAcw ? 'After call work' : 'Chat'}
        {slot.intentSummary && ` · ${slot.intentSummary.slice(0, 32)}${slot.intentSummary.length > 32 ? '…' : ''}`}
      </div>

      {isIncoming && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <button
            onClick={e => { e.stopPropagation(); onSkip(); }}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 7, fontSize: 11,
              border: '1.5px solid #d1d5db', background: '#fff', color: '#374151',
              cursor: 'pointer', fontWeight: 500,
            }}
          >Skip</button>
          <button
            onClick={e => { e.stopPropagation(); onAccept(); }}
            style={{
              flex: 2, padding: '5px 0', borderRadius: 7, fontSize: 11,
              border: 'none', background: C.cardIncoming, color: '#fff',
              cursor: 'pointer', fontWeight: 600,
            }}
          >Accept</button>
        </div>
      )}
    </div>
  );
}

function FocusMessageBubble({ msg }: { msg: ChatMessage }) {
  const isAgent  = msg.role === 'AGENT';
  const isSystem = msg.role === 'SYSTEM';

  if (isSystem) {
    return (
      <div style={{
        textAlign: 'center', fontSize: 11, color: C.systemText, padding: '2px 0',
      }}>
        {msg.content}
      </div>
    );
  }

  const bubbleBg   = isAgent ? C.agentBubbleBg   : C.customerBubbleBg;
  const bubbleText = isAgent ? C.agentBubbleText  : C.customerBubbleText;

  return (
    <div style={{ display: 'flex', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '76%', background: bubbleBg, borderRadius: 14,
        padding: '8px 14px', fontSize: 13, lineHeight: 1.55,
        color: bubbleText, whiteSpace: 'pre-wrap',
      }}>
        {!isAgent && (
          <div style={{
            fontSize: 10, fontWeight: 700, marginBottom: 3,
            color: msg.role === 'BOT' ? '#10b981' : C.sectionLabel,
          }}>
            {msg.role === 'BOT' ? '🤖 Bot' : 'Client'}
          </div>
        )}
        {msg.content}
      </div>
    </div>
  );
}

function IncomingConversation({ slot, onAccept, onSkip }: {
  slot: ContactSlot; onAccept: () => void; onSkip: () => void;
}) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 360,
        boxShadow: '0 4px 24px rgba(0,0,0,.09)', border: `2px solid ${C.cardIncoming}`,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📲</div>
        <div style={{ fontWeight: 700, fontSize: 20, color: '#0f2d5e', marginBottom: 4 }}>
          {slot.clientName}
        </div>
        <div style={{ fontSize: 13, color: C.sectionLabel, lineHeight: 1.5, marginBottom: 20 }}>
          {slot.intentSummary || 'New incoming chat'}
        </div>
        {slot.bonusEligible && (
          <div style={{
            background: '#fef9c3', border: '1.5px solid #f59e0b',
            borderRadius: 10, padding: '8px 12px', marginBottom: 16,
            fontSize: 13, fontWeight: 700, color: '#15803d',
          }}>
            💰 $50 bonus opportunity
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onSkip}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13,
              border: `1.5px solid ${C.divider}`, background: '#fff', color: '#374151',
              cursor: 'pointer', fontWeight: 500,
            }}
          >Skip</button>
          <button
            onClick={onAccept}
            style={{
              flex: 2, padding: '10px 0', borderRadius: 10, fontSize: 13,
              border: 'none', background: C.cardIncoming, color: '#fff',
              cursor: 'pointer', fontWeight: 600,
            }}
          >Accept Chat</button>
        </div>
      </div>
    </div>
  );
}

function QuickActionsSection({ slot, onSendText, onActivateScope }: {
  slot: ContactSlot;
  onSendText: (text: string) => void;
  onActivateScope: (scope: AutopilotScope) => void;
}) {
  const isAutopilot = !!slot.autopilotScope;

  // Scope shortcut actions (only when autopilot is off)
  const scopeActions: { label: string; scope: AutopilotScope }[] = isAutopilot ? [] : [
    { label: 'Get intent', scope: 'get-intent' },
    { label: 'Schedule callback', scope: 'callback' },
  ];

  // Resource quick-send (top 3)
  const resourceActions = slot.suggestedResources.slice(0, 3).map(r => ({
    label: `Send: ${r.title}`,
    onClick: () => onSendText(`Here's a helpful resource: ${r.title}\n${r.url}`),
  }));

  if (scopeActions.length === 0 && resourceActions.length === 0) return null;

  return (
    <AISupportSection label="Quick Actions">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {scopeActions.map(a => (
          <button
            key={a.scope}
            onClick={() => onActivateScope(a.scope)}
            style={{
              textAlign: 'left', padding: '7px 12px', borderRadius: 8,
              border: `1px solid ${C.divider}`,
              background: '#fff', color: '#0f2d5e',
              cursor: 'pointer', fontSize: 12, fontWeight: 500,
              borderLeft: `3px solid ${C.accentGold}`,
              transition: 'background .1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#faf7f3')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            {a.label}
          </button>
        ))}
        {resourceActions.map((a, i) => (
          <button
            key={i}
            onClick={a.onClick}
            style={{
              textAlign: 'left', padding: '7px 12px', borderRadius: 8,
              border: `1px solid ${C.divider}`,
              background: '#fff', color: '#0f2d5e',
              cursor: 'pointer', fontSize: 12, fontWeight: 500,
              borderLeft: `3px solid #10b981`,
              transition: 'background .1s',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#faf7f3')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            {a.label}
          </button>
        ))}
      </div>
    </AISupportSection>
  );
}

function ClientContextSection({ profile, slot }: { profile: ClientProfile; slot: ContactSlot }) {
  const totalFmt = profile.totalBalance >= 1_000_000
    ? `$${(profile.totalBalance / 1_000_000).toFixed(2)}M`
    : profile.totalBalance >= 1_000
    ? `$${(profile.totalBalance / 1_000).toFixed(0)}k`
    : `$${profile.totalBalance}`;

  const accountSummary = profile.accounts.length === 1
    ? `1 account (${totalFmt} total)`
    : `${profile.accounts.length} accounts (${totalFmt} total)`;

  // Pick the most relevant intent (match against slot intentSummary if possible)
  const primaryIntent = profile.intents?.find(i =>
    slot.intentSummary && i.summary.toLowerCase().includes(slot.intentSummary.toLowerCase().slice(0, 12)),
  ) ?? profile.intents?.[0];

  return (
    <AISupportSection label="Client Context">
      <div style={{
        background: '#f8fafc', borderRadius: 8, padding: '10px 12px',
        fontSize: 12, color: '#374151', lineHeight: 1.65,
        border: `1px solid ${C.divider}`,
      }}>
        <div style={{ fontWeight: 600, color: '#0f2d5e', marginBottom: 4 }}>
          {profile.name}
        </div>
        <div>{accountSummary}</div>

        {/* Account breakdown */}
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {profile.accounts.map(acc => (
            <div key={acc.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 11, color: '#6b7280',
            }}>
              <span>{acc.type}</span>
              <span style={{ fontWeight: 600, color: '#374151' }}>
                ${acc.balance.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Primary likely intent */}
        {primaryIntent && (
          <div style={{
            marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.divider}`,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.sectionLabel,
              textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 4,
            }}>
              Likely Interest
            </div>
            <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600 }}>{primaryIntent.label}</span>
              <div style={{ marginTop: 2, color: '#6b7280' }}>
                {primaryIntent.summary.slice(0, 120)}{primaryIntent.summary.length > 120 ? '…' : ''}
              </div>
            </div>
          </div>
        )}

        {/* All intents (collapsed list) */}
        {profile.intents && profile.intents.length > 1 && (
          <div style={{ marginTop: 8 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.sectionLabel,
              textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 4,
            }}>
              Other Known Interests
            </div>
            {profile.intents.slice(1).map((intent, i) => (
              <div key={i} style={{
                fontSize: 11, color: '#6b7280', lineHeight: 1.4,
                padding: '2px 0 2px 8px',
                borderLeft: `2px solid ${C.divider}`,
                marginBottom: 3,
              }}>
                {intent.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </AISupportSection>
  );
}
