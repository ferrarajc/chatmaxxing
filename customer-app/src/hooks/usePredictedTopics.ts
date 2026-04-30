import { useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { useClientStore } from '../store/clientStore';
import { post } from '../api/client';

interface PredictResponse {
  topics: string[];
  somethingElse: boolean;
}

export function usePredictedTopics(currentPage: string) {
  const setTopics = useChatStore(s => s.setTopics);
  const clientId = useClientStore(s => s.activePersona.clientId);

  useEffect(() => {
    post<PredictResponse>('/predict-intent', {
      clientId,
      currentPage,
    })
      .then(res => setTopics(res.topics))
      .catch(() => {
        // Fallback topics by page
        const fallbacks: Record<string, string[]> = {
          portfolio: ['Check my balance', 'Recent transactions', 'Fund performance', 'Place a trade'],
          research:  ['Compare funds', 'Top performers', 'Bond fund details', 'ESG options'],
          account:   ['Update contact info', 'Change beneficiary', 'Tax documents', 'Security settings'],
          home:      ['Open an account', 'Learn about IRAs', 'Check recent activity', 'Talk to an advisor'],
        };
        setTopics(fallbacks[currentPage] ?? ['Check my balance', 'Fund performance', 'Talk to an advisor', 'Account help']);
      });
  }, [currentPage, clientId, setTopics]);
}
