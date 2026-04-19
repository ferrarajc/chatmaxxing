import React, { useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { ChatBody } from './ChatBody';
import { ChatInput } from './ChatInput';
import { EscalationPanel } from './EscalationPanel';
import { CallbackScheduler } from './CallbackScheduler';

interface Props {
  currentPage: string;
  onSendMessage: (text: string) => void;
  onEscalateToAgent: () => void;
}

export function ChatPanel({ currentPage, onSendMessage, onEscalateToAgent }: Props) {
  const { state, reset } = useChatStore();
  const [showCallbackScheduler, setShowCallbackScheduler] = useState(false);

  const handleClose = () => reset();

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      width: 380, height: 600, borderRadius: 16,
      background: '#fff', boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column', zIndex: 9000,
      overflow: 'hidden', fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: '#1a56db', color: '#fff', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>💼</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Bob's Mutual Funds</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            {state === 'CONNECTED_TO_AGENT' ? '🟢 Agent connected'
              : state === 'WAITING_FOR_AGENT' ? '⏳ Connecting to an agent…'
              : '🤖 Virtual Assistant'}
          </div>
        </div>
        <button
          onClick={handleClose}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
          aria-label="Close chat"
        >×</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {showCallbackScheduler ? (
          <CallbackScheduler
            onScheduled={() => setShowCallbackScheduler(false)}
            onCancel={() => setShowCallbackScheduler(false)}
          />
        ) : (
          <>
            <ChatBody currentPage={currentPage} onSendMessage={onSendMessage} />
            {state === 'ESCALATION_OFFERED' && (
              <EscalationPanel
                onConnectByChat={onEscalateToAgent}
                onRequestCallback={() => setShowCallbackScheduler(true)}
              />
            )}
            {state === 'CALLBACK_SCHEDULED' && (
              <div style={{ padding: 16, background: '#f0f9ff', textAlign: 'center', fontSize: 14 }}>
                ✅ Callback scheduled! We'll call you at the time you selected.
              </div>
            )}
            <ChatInput
              onSend={onSendMessage}
              disabled={state === 'GREETING' || state === 'CALLBACK_SCHEDULED'}
            />
          </>
        )}
      </div>
    </div>
  );
}
