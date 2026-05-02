import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { invokeNovaMicro, parseJsonFromBedrock } from '../shared/bedrock-client';
import { ClientProfile, jsonResponse } from '../shared/types';
import { getKBTopicByLabel, getEligibleQuestions } from '../shared/kb';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const { topic, clientId } = JSON.parse(event.body ?? '{}') as {
      topic: string;
      clientId: string;
      currentPage: string;
    };

    if (!topic) {
      return jsonResponse(400, { error: 'topic is required' });
    }

    const kbTopic = getKBTopicByLabel(topic);
    if (!kbTopic) {
      return jsonResponse(200, { questions: [] });
    }

    let accountTypes: string[] = [];
    if (clientId) {
      try {
        const result = await docClient.send(
          new GetCommand({ TableName: process.env.CLIENTS_TABLE!, Key: { clientId } }),
        );
        if (result.Item) {
          const profile = result.Item as ClientProfile;
          accountTypes = profile.accounts?.map(a => a.type) ?? [];
        }
      } catch (e) {
        console.warn('Could not fetch client profile for predict-questions', e);
      }
    }

    const eligible = getEligibleQuestions(kbTopic, accountTypes);
    const fallback = eligible.slice(0, 4).map(q => ({ id: q.id, text: q.text, answer: q.answer, link: q.link }));

    if (eligible.length <= 4) {
      return jsonResponse(200, { questions: fallback });
    }

    // Ask Bedrock to select the 4 most relevant questions for this client
    let questions = fallback;
    try {
      const systemPrompt = `You are a virtual assistant for Bob's Mutual Funds.
Client account types: ${accountTypes.join(', ') || 'unknown'}.
Topic: "${topic}".

From the list below, choose the 4 questions most relevant to this specific client.
RULES:
- You MUST select ONLY from the provided question IDs — do NOT invent IDs.
- Return ONLY valid JSON: {"ids": ["...", "...", "...", "..."]}

Questions: ${eligible.map(q => `${q.id}: ${q.text}`).join(' | ')}`;

      const raw = await invokeNovaMicro('Select 4 questions for this client.', systemPrompt, 100);
      const parsed = parseJsonFromBedrock<{ ids: string[] }>(raw);
      const eligibleIds = eligible.map(q => q.id);
      const chosen = (parsed.ids ?? [])
        .filter(id => eligibleIds.includes(id))
        .map(id => eligible.find(q => q.id === id)!)
        .filter(Boolean);

      // Fill any missing slots from fallback
      const filled = [...chosen];
      for (const q of eligible) {
        if (filled.length >= 4) break;
        if (!filled.find(f => f.id === q.id)) filled.push(q);
      }
      questions = filled.slice(0, 4).map(q => ({ id: q.id, text: q.text, answer: q.answer, link: q.link }));
    } catch (e) {
      console.warn('Question selection failed, using fallback', e);
    }

    return jsonResponse(200, { questions });
  } catch (err) {
    console.error('predict-questions error', err);
    return jsonResponse(200, { questions: [] });
  }
};
