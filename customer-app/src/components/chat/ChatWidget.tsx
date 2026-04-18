import React, { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useChatStore } from '../../store/chatStore';
import { useChatSession } from '../../hooks/useChatSession';
import { usePredictedTopics } from '../../hooks/usePredictedTopics';
import { ChatBubbleFAB } from './ChatBubbleFAB';
import { ChatPanel } from './ChatPanel';

export function ChatWidget() {
  const location = useLocation();
  const currentPage = location.pathname.replace('/', '') || 'home';

  const chatState = useChatStore(s => s.state);
  const { openChat, sendMessage, escalateToAgent } = useChatSession();

  usePredictedTopics(currentPage);

  const handleOpen = useCallback(() => {
    if (chatState === 'CLOSED') openChat(currentPage);
  }, [chatState, currentPage, openChat]);

  return (
    <>
      {chatState === 'CLOSED' && <ChatBubbleFAB onClick={handleOpen} />}
      {chatState !== 'CLOSED' && (
        <ChatPanel
          currentPage={currentPage}
          onSendMessage={sendMessage}
          onEscalateToAgent={escalateToAgent}
        />
      )}
    </>
  );
}
