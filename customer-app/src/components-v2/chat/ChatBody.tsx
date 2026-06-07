import React, { useEffect, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useClientStore } from '../../store/clientStore';
import { usePredictQuestions } from '../../hooks/usePredictQuestions';
import { KBQuestionResult } from '../../types';
import { ChatMessage } from './ChatMessage';
import { TopicButtons } from './TopicButtons';
import { QuestionButtons } from './QuestionButtons';
import { TypingIndicator } from './TypingIndicator';
import { ContinueChatCard } from './ContinueChatCard';
import { theme } from '../../theme';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface Props {
  currentPage: string;
  onSendMessage: (text: string) => void;
  onContinueChat: (preferredAgentUsername: string | null) => void;
}

export function ChatBody({ currentPage, onSendMessage, onContinueChat }: Props) {
  const { state, messages, predictedTopics, selectedTopic, levelTwoQuestions, isTyping, continuation } = useChatStore();
  const addMessage = useChatStore(s => s.addMessage);
  const setTyping = useChatStore(s => s.setTyping);
  const { activePersona } = useClientStore();
  const { fetchQuestions } = usePredictQuestions();
  const bottomRef = useRef<HTMLDivElement>(null);
  const topicsUsed = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleTopicSelect = (topic: string) => {
    if (topic === 'Something else') {
      topicsUsed.current = true;
      onSendMessage(topic);
      return;
    }
    fetchQuestions(topic, currentPage);
  };

  const handleQuestionSelect = (question: KBQuestionResult | 'Something else') => {
    topicsUsed.current = true;
    if (question === 'Something else') {
      onSendMessage('Something else');
      return;
    }
    addMessage({ role: 'CUSTOMER', content: question.text });
    setTyping(true);
    setTimeout(() => {
      addMessage({ role: 'BOT', content: question.answer, link: question.link });
      setTyping(true);
      setTimeout(() => {
        addMessage({ role: 'BOT', content: 'Feel free to ask if you have any other questions about this.' });
      }, 900);
    }, 1500);
  };

  const firstName = activePersona.name.split(' ')[0];
  const noMessages = messages.filter(m => m.role !== 'SYSTEM').length === 0;

  // "Continue this chat" card: only when the client had a live-agent chat in the last 7 days
  // and the conversation hasn't started yet. Purely additive — absent otherwise.
  const showContinueCard =
    !!continuation &&
    Date.now() - continuation.endedAt <= SEVEN_DAYS_MS &&
    noMessages && !topicsUsed.current && !selectedTopic &&
    (state === 'GREETING' || state === 'BOT_ACTIVE');

  return (
    <div style={{
      flex: 1, overflowY: 'auto', padding: '14px 14px',
      display: 'flex', flexDirection: 'column', gap: 10,
      background: theme.color.bg,
    }}>
      {/* Greeting */}
      {(state === 'GREETING' || state === 'BOT_ACTIVE' || state === 'ESCALATION_OFFERED' || state === 'CONNECTED_TO_AGENT') && (
        <div style={{
          background: theme.color.surfaceWell, borderRadius: theme.radius.lg,
          padding: '12px 14px', fontSize: 14, lineHeight: 1.55,
          color: theme.color.text,
          border: `1px solid ${theme.color.border}`,
          borderLeft: `3px solid ${theme.color.accent}`,
        }}>
          Hi <strong style={{ fontWeight: 600 }}>{firstName}</strong>! I'm your Bob's Mutual Funds assistant. How can I help you today?
        </div>
      )}

      {/* Continue this chat — shown above the topic pills when eligible */}
      {showContinueCard && continuation && (
        <ContinueChatCard continuation={continuation} onContinue={onContinueChat} />
      )}

      {/* Level 1: topic pills */}
      {!topicsUsed.current && !selectedTopic && predictedTopics.length > 0 && (state === 'GREETING' || state === 'BOT_ACTIVE') && noMessages && (
        <TopicButtons
          topics={predictedTopics}
          onSelect={handleTopicSelect}
          disabled={false}
        />
      )}

      {/* Level 1 → 2 transition: loading */}
      {!topicsUsed.current && selectedTopic && levelTwoQuestions === null && (
        <TypingIndicator />
      )}

      {/* Level 2: question pills */}
      {!topicsUsed.current && selectedTopic && levelTwoQuestions !== null && levelTwoQuestions.length > 0 && (
        <QuestionButtons
          topic={selectedTopic}
          questions={levelTwoQuestions}
          onSelect={handleQuestionSelect}
          disabled={false}
        />
      )}

      {/* Messages */}
      {messages.map(msg => (
        <ChatMessage key={msg.id} message={msg} />
      ))}

      {isTyping && <TypingIndicator isWaiting />}
      <div ref={bottomRef} />
    </div>
  );
}
