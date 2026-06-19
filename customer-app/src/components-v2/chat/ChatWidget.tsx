import React, { useCallback, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { useChatStore } from '../../store/chatStore';
import { usePageContextStore } from '../../store/pageContextStore';
import { useChatSession } from '../../hooks/useChatSession';
import { usePredictedTopics } from '../../hooks/usePredictedTopics';
import { ChatBubbleFAB } from './ChatBubbleFAB';
import { ChatMinimizedBar } from './ChatMinimizedBar';
import { ChatPanel } from './ChatPanel';
import { useFlag } from '../../store/featureFlagsStore';
import { useVoiceStore } from '../../store/voiceStore';

// Voice ("Talk to Bob") is an experimental feature: lazy-loaded so none of its code is
// fetched or executed unless the flag is on — the off state stays completely cost-free.
const VoiceLaunchFAB = lazy(() => import('../voice/VoiceLaunchFAB').then(m => ({ default: m.VoiceLaunchFAB })));
const TalkToBobOverlay = lazy(() => import('../voice/TalkToBobOverlay').then(m => ({ default: m.TalkToBobOverlay })));

// Normalize a route path into a stable page key used for chat topic selection.
// Top-level pages keep their existing keys (home/portfolio/research/account);
// dynamic segments (a fund ticker, account id, article slug) are collapsed so
// every instance of a page maps to one key the KB can target.
// eslint-disable-next-line react-refresh/only-export-components
export function pageKeyFromPath(pathname: string): string {
  const p = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (p === '') return 'home';
  if (/^research\/fund\/[^/]+\/buy$/.test(p)) return 'research/fund/buy';
  if (/^research\/fund\/[^/]+$/.test(p)) return 'research/fund';
  if (/^account\/detail\/[^/]+$/.test(p)) return 'account/detail';
  if (/^library\/guide\/[^/]+$/.test(p)) return 'library/guide';
  if (/^library\/opinion\/[^/]+$/.test(p)) return 'library/opinion';
  return p;
}

export function ChatWidget() {
  const location = useLocation();
  // A page (e.g. the Open an Account wizard) may publish a finer-grained key than
  // the URL implies; prefer it so pills track the exact step/branch on screen.
  const pageContext = usePageContextStore(s => s.pageContext);
  const currentPage = pageContext ?? pageKeyFromPath(location.pathname);
  const voiceOn = useFlag('talkToBob');
  const voiceOpen = useVoiceStore(s => s.open);
  const openVoice = useVoiceStore(s => s.openVoice);
  const closeVoice = useVoiceStore(s => s.closeVoice);

  const chatState = useChatStore(s => s.state);
  const minimized = useChatStore(s => s.minimized);
  const unreadCount = useChatStore(s => s.unreadCount);
  const setMinimized = useChatStore(s => s.setMinimized);
  const { openChat, sendMessage, escalateToAgent, continueChat, notifyTyping, endChat, submitApproval, declineApproval } = useChatSession();

  usePredictedTopics(currentPage);

  const handleOpen = useCallback(() => {
    if (chatState === 'CLOSED') openChat(currentPage);
  }, [chatState, currentPage, openChat]);

  return (
    <>
      {chatState === 'CLOSED' && <ChatBubbleFAB onClick={handleOpen} />}
      {chatState !== 'CLOSED' && minimized && (
        // Minimized: the session stays fully alive, only the panel is hidden.
        <ChatMinimizedBar onClick={() => setMinimized(false)} unread={unreadCount} />
      )}
      {chatState !== 'CLOSED' && !minimized && (
        <ChatPanel
          currentPage={currentPage}
          onSendMessage={sendMessage}
          onEscalateToAgent={escalateToAgent}
          onContinueChat={continueChat}
          onTyping={notifyTyping}
          onEndChat={endChat}
          onSubmitApproval={submitApproval}
          onDeclineApproval={declineApproval}
        />
      )}

      {voiceOn && (
        <Suspense fallback={null}>
          <VoiceLaunchFAB onClick={openVoice} />
          {voiceOpen && <TalkToBobOverlay currentPage={currentPage} onClose={closeVoice} />}
        </Suspense>
      )}
    </>
  );
}
