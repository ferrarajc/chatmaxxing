import React, { useEffect, useRef, useState } from 'react';
import { ContactSlot, ChatMessage } from '../types';
import { useAgentStore } from '../store/agentStore';
import { post } from '../api/client';
import { log } from '../api/logger';
import { IncomingAlert } from './IncomingAlert';
import { ResponseTimer } from './ResponseTimer';
import { AISupport } from './AISupport';
import { CLIENT_PROFILES, DEFAULT_PROFILE } from '../data/clientProfiles';

const AGENT_NAME = 'John Ferrara';

interface Props {
  slotIndex: number;
  slot: ContactSlot | null;
}

export function ChatColumn({ slotIndex, slot }: Props) {
  const store = useAgentStore();
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);
  // Track which contactIds have already received the initial greeting suggestion
  const greetedContacts = useRef<Set<string>>(new Set());

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (slot && slot.messages.length !== prevMsgCount.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      prevMsgCount.current = slot.messages.length;
    }
  }, [slot?.messages.length]);

  // Pre-populate greeting suggestion when agent first connects (connectionToken arrives)
  const connectionToken = slot?.connectionToken;
  useEffect(() => {
    if (!slot || !connectionToken || greetedContacts.current.has(slot.contactId)) return;
    // Only trigger if no agent messages have been sent yet
    const hasAgentMsg = slot.messages.some(m => m.role === 'AGENT');
    if (hasAgentMsg) {
      greetedContacts.current.add(slot.contactId);
      return;
    }
    greetedContacts.current.add(slot.contactId);
    const firstName = slot.clientName.split(' ')[0];
    const topic = slot.intentSummary && slot.intentSummary !== 'General inquiry'
      ? `I can see you were reaching out about: ${slot.intentSummary}.`
      : "I'm here to help you today.";
    const greeting = `Hi ${firstName}, my name is ${AGENT_NAME} with Bob's Mutual Funds. ${topic} How can I assist you?`;
    store.patchSlot(slot.contactId, { suggestedText: greeting });
  }, [connectionToken, slot?.contactId]);

  // Fetch NBR + trigger autopilot when a customer message arrives
  const lastCustomerMsg = slot?.lastCustomerMessageAt;
  useEffect(() => {
    if (!slot || slot.status !== 'active' || !lastCustomerMsg) return;

    const clientProfile = CLIENT_PROFILES[slot.clientId] ?? DEFAULT_PROFILE;

    const fetchNBR = async () => {
      try {
        const result = await post<{ suggestedText: string; resources: Array<{ id: string; title: string; url: string }> }>(
          '/next-best-response',
          { transcript: slot.messages, clientProfile },
        );
        store.patchSlot(slot.contactId, {
          suggestedText: result.suggestedText,
          suggestedResources: result.resources,
        });
      } catch (e) {
        console.warn('NBR fetch failed', e);
      }
    };

    fetchNBR();

    if (slot.isAutopilot) {
      const runAutopilot = async () => {
        try {
          const result = await post<{ response: string; confidence: number; shouldExitAutopilot: boolean }>(
            '/autopilot-turn',
            {
              transcript: slot.messages,
              clientProfile,
              currentIntent: slot.intentSummary,
            },
          );
          if (result.shouldExitAutopilot) {
            store.patchSlot(slot.contactId, {
              isAutopilot: false,
              suggestedText: result.response,
            });
          } else if (result.response) {
            store.appendMessage(slot.contactId, { role: 'AGENT', content: result.response });
            store.patchSlot(slot.contactId, { lastAgentMessageAt: Date.now() });
            if (slot.connectionToken) {
              post<{ ok: boolean }>('/send-agent-message', {
                connectionToken: slot.connectionToken,
                message: result.response,
              }).catch((e: unknown) => {
                log.error('ChatColumn:autopilot:sendFailed', e);
                store.appendMessage(slot.contactId, {
                  role: 'SYSTEM',
                  content: `⚠ Autopilot send error: ${String(e).slice(0, 120)}`,
                });
              });
            }
          }
        } catch (e) {
          console.warn('Autopilot turn failed', e);
          store.patchSlot(slot.contactId, { isAutopilot: false });
        }
      };
      runAutopilot();
    }
  }, [lastCustomerMsg]);

  // Handle pending insert (suggestion clicked)
  const pendingInserts = store.pendingInserts;
  useEffect(() => {
    if (!slot) return;
    if (pendingInserts.has(slot.contactId)) {
      setInputText(slot.suggestedText);
      store.clearInsert(slot.contactId);
    }
  }, [pendingInserts, slot?.contactId, slot?.suggestedText]);

  const handleSend = () => {
    if (!inputText.trim() || !slot) return;
    const text = inputText.trim();
    setInputText('');
    sendText(text);
  };

  const sendText = (text: string) => {
    if (!slot) return;
    // Append locally for instant feedback
    store.appendMessage(slot.contactId, { role: 'AGENT', content: text });
    store.patchSlot(slot.contactId, { lastAgentMessageAt: Date.now() });

    if (!slot.connectionToken) {
      const msg = 'Agent token not ready — try again in a moment';
      log.warn('ChatColumn:send:noConnectionToken', { contactId: slot.contactId });
      store.appendMessage(slot.contactId, { role: 'SYSTEM', content: `⚠ ${msg}` });
      return;
    }

    post<{ ok: boolean }>('/send-agent-message', {
      connectionToken: slot.connectionToken,
      message: text,
    })
      .then(() => {
        log.info('ChatColumn:sendMessage:ok', { contactId: slot.contactId, preview: text.slice(0, 40) });
      })
      .catch((e: unknown) => {
        log.error('ChatColumn:sendMessage:failed', e);
        let detail: string;
        try { detail = JSON.stringify(e, Object.getOwnPropertyNames(e as object)); }
        catch { detail = String(e); }
        store.appendMessage(slot.contactId, {
          role: 'SYSTEM',
          content: `⚠ Send error: ${detail.slice(0, 300)}`,
        });
      });
  };

  const outline = slot?.isAutopilot ? '2.5px solid #22c55e' : '2px solid #e2e8f0';

  return (
    <div style={{
      background: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column',
      outline, overflow: 'hidden', minHeight: 0,
      boxShadow: '0 1px 6px rgba(0,0,0,.06)',
      transition: 'outline-color .2s',
    }}>
      {/* Empty state */}
      {!slot && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: '#9ca3af',
          gap: 8,
        }}>
          <div style={{ fontSize: 32 }}>💬</div>
          <div style={{ fontSize: 13 }}>Waiting for a chat</div>
        </div>
      )}

      {/* Incoming alert */}
      {slot?.status === 'incoming' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <IncomingAlert slot={slot} />
        </div>
      )}

      {/* Active chat */}
      {slot && slot.status === 'active' && (
        <>
          {/* Static header */}
          <div style={{
            padding: '8px 14px', borderBottom: '1px solid #e5e7eb',
            background: '#f8fafc', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{slot.clientName}</div>
              <ResponseTimer lastEventAt={
                Math.max(slot.lastAgentMessageAt ?? 0, slot.lastCustomerMessageAt ?? 0) || null
              } />
            </div>
            {slot.intentSummary && (
              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.3, marginTop: 2 }}>
                {slot.intentSummary}
              </div>
            )}
          </div>

          {/* Chat history — scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
            {slot.messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Type area — static */}
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 10px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type a reply…"
                rows={2}
                style={{
                  flex: 1, resize: 'none', border: '1.5px solid #d1d5db', borderRadius: 8,
                  padding: '6px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim()}
                style={{
                  width: 34, borderRadius: 8, border: 'none',
                  background: inputText.trim() ? '#1a56db' : '#e5e7eb',
                  color: '#fff', cursor: inputText.trim() ? 'pointer' : 'default',
                  fontSize: 16,
                }}
              >➤</button>
            </div>
          </div>

          {/* AI support area — scrollable, fixed height */}
          <div style={{ height: 180, overflowY: 'auto', borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
            <AISupport
              slot={slot}
              onSendResource={(text) => sendText(text)}
            />
          </div>
        </>
      )}

      {/* Ended state */}
      {slot?.status === 'ended' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#9ca3af', gap: 4 }}>
          <div style={{ fontSize: 24 }}>✅</div>
          <div style={{ fontSize: 13 }}>Chat ended — {slot.clientName}</div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isAgent = msg.role === 'AGENT';
  const isSystem = msg.role === 'SYSTEM';

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>{msg.content}</div>
    );
  }

  const colors: Record<string, string> = {
    CUSTOMER: '#f3f4f6',
    AGENT: '#dbeafe',
    BOT: '#f0fdf4',
  };

  return (
    <div style={{ display: 'flex', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '82%', background: colors[msg.role] ?? '#f3f4f6',
        borderRadius: 10, padding: '6px 10px', fontSize: 12, lineHeight: 1.5,
        color: '#111', whiteSpace: 'pre-wrap',
      }}>
        {!isAgent && (
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2, fontWeight: 600 }}>
            {msg.role === 'BOT' ? '🤖 Bot' : 'Client'}
          </div>
        )}
        {msg.content}
      </div>
    </div>
  );
}
