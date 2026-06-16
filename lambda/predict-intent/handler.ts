import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { invokeNovaMicro, parseJsonFromBedrock } from '../shared/bedrock-client';
import {
  ClientProfile,
  jsonResponse,
} from '../shared/types';
import { getEligibleTopics, getUniversalFallbackTopics } from '../shared/kb';

// ─── Main handler ─────────────────────────────────────────────────────────────
// This Lambda serves the live HTTP `/predict-intent` chat-pill predictor (Nova Micro).
// It previously also doubled as an Amazon Lex V2 fulfillment hook, but Lex was
// disassociated from Connect (2026-06-14), so that path is gone.

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  return handleApiMode(event);
};

const PAGE_DESCRIPTIONS: Record<string, string> = {
  home:      'Home dashboard showing portfolio summary, market data, and featured funds',
  portfolio: 'Portfolio page showing account balances, holdings, allocation chart, and recent transactions',
  research:  'Fund research page with fund cards, performance data, and comparison tools',
  account:   'Account settings page with personal info, security settings, beneficiary, and tax documents',
};

async function handleApiMode(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const { currentPage, clientId } = JSON.parse(event.body ?? '{}');

    let recentTopics: string[] = [];
    let accountTypes: string[] = [];
    if (clientId) {
      try {
        const result = await docClient.send(
          new GetCommand({ TableName: process.env.CLIENTS_TABLE!, Key: { clientId } }),
        );
        if (result.Item) {
          const profile = result.Item as ClientProfile;
          recentTopics = profile.recentChatHistory?.map(h => h.topic) ?? [];
          accountTypes = profile.accounts?.map(a => a.type) ?? [];
        }
      } catch (e) {
        console.warn('Could not fetch client profile', e);
      }
    }

    const page = currentPage ?? 'home';
    const pageDesc = PAGE_DESCRIPTIONS[page] ?? PAGE_DESCRIPTIONS.home;

    // Filter KB to topics eligible for this page + client's account types.
    // If nothing matches (e.g. a SEP page viewed by a non-SEP client), fall back
    // to a few universal topics so the page never shows an empty pill set.
    let eligible = getEligibleTopics(page, accountTypes).map(t => t.label);
    if (eligible.length === 0) {
      eligible = getUniversalFallbackTopics().map(t => t.label);
    }
    const fallback = eligible.slice(0, 4);

    // With 4 or fewer eligible topics there's nothing for the model to rank —
    // return the curated set directly. This covers most sub-pages (no LLM call).
    if (eligible.length <= 4) {
      return jsonResponse(200, { topics: fallback, somethingElse: true });
    }

    let topics: string[] = fallback;
    try {
      const systemPrompt = `You are a virtual assistant for Bob's Mutual Funds.
Page: ${pageDesc}.
Client account types: ${accountTypes.join(', ') || 'unknown'}.
Recent topics: ${recentTopics.join(', ') || 'none'}.

Select exactly 4 topics from the list below that are most relevant to this client right now.

PAGE-SPECIFIC GUIDANCE:
- portfolio page: Prioritize balance/transaction topics AND topics distinctive to this client's account types (e.g. SEP-IRA topics for SEP-IRA holders, RMD topics for Traditional IRA holders). Include "Fund performance" if eligible.
- research page: Prioritize fund comparison and investment education topics. Do NOT repeat topics already covered on the portfolio page.
- account page: Always include at least one of these account management topics if eligible: "Update contact info", "Security settings", "Change beneficiary". Also include account-type-specific topics.
- home page: Always include at least one action/contact topic if eligible: "Schedule a callback", "Open a new account", "Auto-invest setup". Blend with relevant account-specific topics.

RULES:
- Select ONLY from the provided list — do NOT invent or rephrase any topic.
- Return labels VERBATIM, character-for-character as they appear in the list.
- Return ONLY valid JSON: {"topics": ["...", "...", "...", "..."]}

Topic list: ${eligible.join(' | ')}`;

      const raw = await invokeNovaMicro('Select 4 topics for this client.', systemPrompt, 150);
      const parsed = parseJsonFromBedrock<{ topics: string[] }>(raw);
      const selected = (parsed.topics ?? []).filter(t => eligible.includes(t));
      // Fill any missing slots with fallback labels not already selected
      const filled = [...selected];
      for (const label of fallback) {
        if (filled.length >= 4) break;
        if (!filled.includes(label)) filled.push(label);
      }
      topics = filled.slice(0, 4);
    } catch (e) {
      console.warn('Topic selection failed, using fallback', e);
    }

    return jsonResponse(200, { topics, somethingElse: true });
  } catch (err) {
    console.error('predict-intent API error', err);
    return jsonResponse(500, { error: 'Failed to predict intent' });
  }
}
