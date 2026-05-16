import React, { useEffect, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useClientStore } from '../../store/clientStore';
import { usePredictQuestions } from '../../hooks/usePredictQuestions';
import { KBQuestionResult } from '../../types';
import { ChatMessage } from './ChatMessage';
import { TopicButtons } from './TopicButtons';
import { QuestionButtons } from './QuestionButtons';
import { TypingIndicator } from './TypingIndicator';

interface Props {
  currentPage: string;
  onSendMessage: (text: string) => void;
}

export function ChatBody({ currentPage, onSendMessage }: Props) {
  const { state, messages, predictedTopics, selectedTopic, levelTwoQuestions, isTyping } = useChatStore();
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
    // Inject question as CUSTOMER message, then pre-written answer as BOT messages
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
  const showingGreeting = state === 'GREETING' || state === 'BOT_ACTIVE' || state === 'ESCALATION_OFFERED' || state === 'CONNECTED_TO_AGENT';
  const noMessages = messages.filter(m => m.role !== 'SYSTEM').length === 0;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Greeting */}
      {showingGreeting && (
        <div style={{
          background: '#f3f6ff', borderRadius: 12, padding: '10px 14px',
          fontSize: 14, lineHeight: 1.5, color: '#1e3a5f',
        }}>
          Hi <strong>{firstName}</strong>! I'm your Bob's Mutual Funds assistant. How can I help you today?
        </div>
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

      {isTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
