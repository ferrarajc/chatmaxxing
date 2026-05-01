import { useChatStore } from '../store/chatStore';
import { useClientStore } from '../store/clientStore';
import { KBQuestionResult } from '../types';
import { post } from '../api/client';

interface PredictQuestionsResponse {
  questions: KBQuestionResult[];
}

export function usePredictQuestions() {
  const store = useChatStore();
  const clientId = useClientStore(s => s.activePersona.clientId);

  const fetchQuestions = async (topic: string, currentPage: string) => {
    store.setSelectedTopic(topic);
    store.setLevelTwoQuestions(null);
    try {
      const res = await post<PredictQuestionsResponse>('/predict-questions', {
        topic,
        clientId,
        currentPage,
      });
      store.setLevelTwoQuestions(res.questions ?? []);
    } catch {
      store.setLevelTwoQuestions([]);
    }
  };

  return { fetchQuestions };
}
