import React, { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useChatStore } from '../../store/chatStore';
import { ChatBubbleFAB } from './ChatBubbleFAB';
import { ChatPanel } from './ChatPanel';

export function ChatWidget() {
  const { state, transitionTo, sendUserMessage, escalateToAgent } = useChatStore();
  const location = useLocation();
  const currentPage = location.pathname;

  const handleOpenChat = useCallback(() => {
    if (state === 'CLOSED') {
      transitionTo('GREETING');
    }
  }, [state, transitionTo]);

  const isOpen = state !== 'CLOSED';

  return (
    <>
      {!isOpen && <ChatBubbleFAB onClick={handleOpenChat} />}
      {isOpen && (
        <ChatPanel
          currentPage={currentPage}
          onSendMessage={sendUserMessage}
          onEscalateToAgent={escalateToAgent}
        />
      )}
    </>
  );
}
