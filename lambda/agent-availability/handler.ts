import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  ConnectClient,
  ListUsersCommand,
  GetCurrentUserDataCommand,
} from '@aws-sdk/client-connect';
import { jsonResponse } from '../shared/types';

const connectClient = new ConnectClient({ region: process.env.AWS_REGION });

/**
 * Reports whether a specific agent (by Connect username) is currently on queue
 * and Available — used by the customer "Continue this chat" card to decide
 * whether to offer "wait for this agent" vs. "first available agent".
 *
 * Always degrades safely: any unknown user or Connect error returns
 * { available: false } so the caller falls back to first-available routing.
 */
export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  let agentUsername = '';
  let agentName = '';
  try {
    const body = JSON.parse(event.body ?? '{}') as { agentUsername?: string; agentName?: string };
    agentUsername = (body.agentUsername ?? '').trim();
    agentName = (body.agentName ?? '').trim();

    if (!agentUsername) {
      return jsonResponse(200, { available: false, agentUsername, agentName });
    }

    const instanceId = process.env.CONNECT_INSTANCE_ID!;

    // 1. Resolve username → userId (paginate defensively; demo instances are small).
    let userId: string | undefined;
    let resolvedName = agentName;
    let nextToken: string | undefined;
    do {
      const page = await connectClient.send(new ListUsersCommand({
        InstanceId: instanceId,
        MaxResults: 100,
        NextToken: nextToken,
      }));
      const match = (page.UserSummaryList ?? []).find(
        u => (u.Username ?? '').toLowerCase() === agentUsername.toLowerCase(),
      );
      if (match) { userId = match.Id; break; }
      nextToken = page.NextToken;
    } while (nextToken);

    if (!userId) {
      return jsonResponse(200, { available: false, agentUsername, agentName: resolvedName });
    }

    // 2. Live status — present in UserDataList only while logged in.
    const data = await connectClient.send(new GetCurrentUserDataCommand({
      InstanceId: instanceId,
      Filters: { Agents: [userId] },
      MaxResults: 1,
    }));
    const entry = (data.UserDataList ?? [])[0];
    const statusName = entry?.Status?.StatusName ?? '';
    const available = statusName === 'Available';

    return jsonResponse(200, { available, agentUsername, agentName: resolvedName });
  } catch (err) {
    console.warn('agent-availability error', err);
    // Fail safe — connect to the first available agent.
    return jsonResponse(200, { available: false, agentUsername, agentName });
  }
};
