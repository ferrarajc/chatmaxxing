import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { invokeNovaMicro, parseJsonFromBedrock } from '../shared/bedrock-client';
import { ClientProfile, jsonResponse } from '../shared/types';

const PAGE_DESCRIPTIONS: Record<string, string> = {
  home:      'Home dashboard showing portfolio summary, market data, and featured funds',
  portfolio: 'Portfolio page showing account balances, holdings, allocation chart, and recent transactions',
  research:  'Fund research page with fund cards, performance data, and comparison tools',
  account:   'Account settings page with personal info, security settings, beneficiary, and tax documents',
};

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const { topic, clientId, currentPage } = JSON.parse(event.body ?? '{}') as {
      topic: string;
      clientId: string;
      currentPage: string;
    };

    if (!topic) {
      return jsonResponse(400, { error: 'topic is required' });
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

    const pageDesc = PAGE_DESCRIPTIONS[currentPage ?? 'home'] ?? PAGE_DESCRIPTIONS.home;
    const accountCtx = accountTypes.length > 0
      ? `Client's account types: ${accountTypes.join(', ')}.`
      : '';

    const systemPrompt = `You are a virtual assistant for Bob's Mutual Funds, a financial services company.
${accountCtx}
Current page: ${pageDesc}.
Topic selected by client: "${topic}"

Generate exactly 4 specific questions this client is most likely to ask within the topic "${topic}".
Rules:
- Questions MUST be answerable using: account balance data, fund performance data, general educational info (IRAs, taxes, fund concepts), beneficiary or contact info updates, or callback scheduling.
- Do NOT generate questions about: executing trades, personalized investment recommendations, fraud or security incidents, or account inheritance and estate matters.
- Make questions specific to this client's account types (e.g. do not ask about RMDs if the client only has a Roth IRA or taxable account).
- Each question should be concise — under 12 words.
- Return ONLY valid JSON with no explanation: {"questions": ["...", "...", "...", "..."]}`;

    const userPrompt = `Generate 4 common questions a client might ask about: "${topic}"`;

    const raw = await invokeNovaMicro(userPrompt, systemPrompt, 200);
    const parsed = parseJsonFromBedrock<{ questions: string[] }>(raw);
    const questions = (parsed.questions ?? []).slice(0, 4);

    return jsonResponse(200, { questions });
  } catch (err) {
    console.error('predict-questions error', err);
    return jsonResponse(200, { questions: [] });
  }
};
