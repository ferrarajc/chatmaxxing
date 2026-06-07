import React, { useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { ChatBody } from './ChatBody';
import { ChatInput } from './ChatInput';
import { EscalationPanel } from './EscalationPanel';
import { CallbackScheduler } from './CallbackScheduler';
import { theme } from '../../theme';

interface Props {
  currentPage: string;
  onSendMessage: (text: string) => void;
  onEscalateToAgent: () => void;
  onContinueChat: (preferredAgentUsername: string | null) => void;
}

export function ChatPanel({ currentPage, onSendMessage, onEscalateToAgent, onContinueChat }: Props) {
  const { state, reset } = useChatStore();
  const [showCallbackScheduler, setShowCallbackScheduler] = useState(false);

  const handleClose = () => reset();

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      width: 380, height: 600, borderRadius: theme.radius.xl,
      background: theme.color.surface, boxShadow: theme.shadow.xl,
      display: 'flex', flexDirection: 'column', zIndex: 9000,
      overflow: 'hidden', fontFamily: theme.font.sans,
      border: `1px solid ${theme.color.border}`,
    }}>
      {/* Header */}
      <div style={{
        background: theme.color.primary, color: theme.color.textOnPrimary, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 6, background: theme.color.bg,
          color: theme.color.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, fontFamily: theme.font.serif,
          letterSpacing: '-0.02em', flexShrink: 0,
        }}>B</div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: 600, fontSize: 15, fontFamily: theme.font.serif,
            letterSpacing: '-0.01em',
          }}>Bob's Mutual Funds</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 1 }}>
            {state === 'CONNECTED_TO_AGENT' ? '🟢 Agent connected'
              : state === 'WAITING_FOR_AGENT' ? '⏳ Connecting to an agent…'
              : 'Virtual Assistant'}
          </div>
        </div>
        <button
          onClick={handleClose}
          style={{
            background: 'none', border: 'none', color: theme.color.textOnPrimary,
            cursor: 'pointer', fontSize: 22, lineHeight: 1, opacity: 0.7,
            padding: 4, transition: 'opacity .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
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
            <ChatBody currentPage={currentPage} onSendMessage={onSendMessage} onContinueChat={onContinueChat} />
            {state === 'ESCALATION_OFFERED' && (
              <EscalationPanel
                onConnectByChat={onEscalateToAgent}
                onRequestCallback={() => setShowCallbackScheduler(true)}
              />
            )}
            {state === 'CALLBACK_SCHEDULED' && (
              <div style={{
                padding: 16, background: theme.color.successSoft,
                borderTop: `1px solid ${theme.color.successBorder}`,
                textAlign: 'center', fontSize: 14, color: theme.color.success,
              }}>
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
