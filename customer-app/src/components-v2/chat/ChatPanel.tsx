import React, { useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { ChatBody } from './ChatBody';
import { ChatInput } from './ChatInput';
import { EscalationPanel } from './EscalationPanel';
import { CallbackScheduler } from './CallbackScheduler';
import { ChatHistoryList, ChatTranscriptView } from './ChatHistoryView';
import { theme } from '../../theme';

type PanelView = 'chat' | 'history' | 'transcript';

interface Props {
  currentPage: string;
  onSendMessage: (text: string) => void;
  onEscalateToAgent: () => void;
  onContinueChat: (preferredAgentUsername: string | null) => void;
  onTyping: () => void;
  onEndChat: () => void;
}

export function ChatPanel({ currentPage, onSendMessage, onEscalateToAgent, onContinueChat, onTyping, onEndChat }: Props) {
  const { state, messages, chatEnded, setMinimized } = useChatStore();
  const [showCallbackScheduler, setShowCallbackScheduler] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  // Hamburger menu: 'history' takes over the panel with past live-agent chats;
  // 'transcript' shows one of them in full. The live chat keeps running underneath.
  const [view, setView] = useState<PanelView>('chat');
  const [historyTranscriptId, setHistoryTranscriptId] = useState<string | null>(null);

  // Closing ends the chat for real (disconnects the Connect participant), so
  // confirm first — unless they never engaged (tire kickers) or it's already over.
  const hasEngaged = messages.some(m => m.role === 'CUSTOMER');
  const handleClose = () => {
    if (!hasEngaged || chatEnded) { onEndChat(); return; }
    setShowCloseConfirm(true);
  };

  const headerButtonStyle: React.CSSProperties = {
    background: 'none', border: 'none', color: theme.color.textOnPrimary,
    cursor: 'pointer', fontSize: 22, lineHeight: 1, opacity: 0.7,
    padding: 4, transition: 'opacity .15s',
  };

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
        {view === 'chat' ? (
          <button
            onClick={() => setView('history')}
            style={{ ...headerButtonStyle, fontSize: 19, marginLeft: -4 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
            aria-label="Chat history"
            title="Previous chats"
          >☰</button>
        ) : (
          <button
            onClick={() => setView(view === 'transcript' ? 'history' : 'chat')}
            style={{ ...headerButtonStyle, fontSize: 20, marginLeft: -4 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
            aria-label="Back"
            title="Back"
          >←</button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: 600, fontSize: 15, fontFamily: theme.font.serif,
            letterSpacing: '-0.01em',
          }}>{view === 'chat' ? "Bob's Mutual Funds" : 'Chat history'}</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 1 }}>
            {view === 'history' ? 'Your chats from the last 3 months'
              : view === 'transcript' ? 'Conversation transcript'
              : state === 'CONNECTED_TO_AGENT' ? '🟢 Agent connected'
              : state === 'WAITING_FOR_AGENT' ? '⏳ Connecting to an agent…'
              : 'Virtual Assistant'}
          </div>
        </div>
        <button
          onClick={() => setMinimized(true)}
          style={headerButtonStyle}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
          aria-label="Minimize chat"
          title="Minimize — keeps the chat going"
        >–</button>
        <button
          onClick={handleClose}
          style={headerButtonStyle}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
          aria-label="Close chat"
        >×</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'history' ? (
          <ChatHistoryList onSelect={id => { setHistoryTranscriptId(id); setView('transcript'); }} />
        ) : view === 'transcript' && historyTranscriptId ? (
          <ChatTranscriptView transcriptId={historyTranscriptId} />
        ) : showCallbackScheduler ? (
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
              onTyping={onTyping}
              disabled={state === 'GREETING' || state === 'CALLBACK_SCHEDULED' || chatEnded}
            />
          </>
        )}
      </div>

      {/* Close confirmation — closing ends the chat; minimizing keeps it alive */}
      {showCloseConfirm && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'rgba(15, 35, 64, 0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: theme.color.surface, borderRadius: theme.radius.lg,
            boxShadow: theme.shadow.xl, padding: '20px 22px', width: '100%',
          }}>
            <div style={{
              fontWeight: 700, fontSize: 16, fontFamily: theme.font.serif,
              color: theme.color.text, marginBottom: 8,
            }}>
              End this chat?
            </div>
            <div style={{ fontSize: 14, color: theme.color.textMuted, lineHeight: 1.5, marginBottom: 18 }}>
              Closing will end this chat. If you don't want to lose your work, you can
              minimize the chat layer instead.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                autoFocus
                onClick={() => { setShowCloseConfirm(false); setMinimized(true); }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: theme.radius.md,
                  background: theme.color.primary, color: theme.color.textOnPrimary,
                  border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Minimize
              </button>
              <button
                onClick={() => { setShowCloseConfirm(false); onEndChat(); }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: theme.radius.md,
                  background: theme.color.surface, color: theme.color.text,
                  border: `1px solid ${theme.color.border}`, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                End chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
