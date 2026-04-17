import React, { useEffect, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { ChatMessage } from './ChatMessage';
import { TopicButtons } from './TopicButtons';
import { TypingIndicator } from './TypingIndicator';
import { MOCK_CLIENT } from '../../data/mock-client';

interface Props {
  currentPage: string;
  onSendMessage: (text: string) => void;
}

export function ChatBody({ currentPage: _page, onSendMessage }: Props) {
  const { state, messages, predictedTopics, isTyping } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const topicsUsed = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleTopicSelect = (topic: string) => {
    topicsUsed.current = true;
    onSendMessage(topic);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Greeting */}
      {(state === 'GREETING' || state === 'BOT_ACTIVE' || state === 'ESCALATION_OFFERED' || state === 'CONNECTED_TO_AGENT') && (
        <div style={{
          background: '#f3f6ff', borderRadius: 12, padding: '10px 14px',
          fontSize: 14, lineHeight: 1.5, color: '#1e3a5f',
        }}>
          Hi <strong>{MOCK_CLIENT.name}</strong>! 👋 I'm your Bob's Mutual Funds assistant. How can I help you today?
        </div>
      )}

      {/* Predicted topic buttons */}
      {predictedTopics.length > 0 && !topicsUsed.current && (state === 'GREETING' || state === 'BOT_ACTIVE') && messages.length === 0 && (
        <TopicButtons
          topics={predictedTopics}
          onSelect={handleTopicSelect}
          disabled={false}
        />
      )}

      {/* Messages */}
      {messages.map(msg => (
        <ChatMessage key={msg.id} message={msg} />
      ))}

      {isTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
