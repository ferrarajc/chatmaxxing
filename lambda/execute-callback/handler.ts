import { ConnectClient, StartOutboundVoiceContactCommand } from '@aws-sdk/client-connect';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';

const connectClient = new ConnectClient({ region: process.env.AWS_REGION });

interface ExecuteCallbackEvent {
  callbackId: string;
}

export const handler = async (event: ExecuteCallbackEvent): Promise<void> => {
  const { callbackId } = event;

  console.log('Executing callback', callbackId);

  // Load callback record
  const result = await docClient.send(
    new GetCommand({
      TableName: process.env.CALLBACKS_TABLE!,
      Key: { callbackId },
    }),
  );

  if (!result.Item) {
    console.error('Callback record not found', callbackId);
    return;
  }

  const callback = result.Item;

  if (callback.status !== 'scheduled') {
    console.log('Callback already processed, skipping', callbackId);
    return;
  }

  try {
    // Place the outbound call
    await connectClient.send(
      new StartOutboundVoiceContactCommand({
        InstanceId: process.env.CONNECT_INSTANCE_ID!,
        ContactFlowId: process.env.OUTBOUND_FLOW_ID!,
        QueueId: process.env.PHONE_QUEUE_ID!,
        DestinationPhoneNumber: `+1${callback.phoneNumber.replace(/\D/g, '')}`,
        Attributes: {
          clientName: 'Alex Johnson',   // hardcoded for demo
          callbackId,
          intentSummary: callback.intentSummary ?? '',
          clientId: callback.clientId,
        },
      }),
    );

    await docClient.send(
      new UpdateCommand({
        TableName: process.env.CALLBACKS_TABLE!,
        Key: { callbackId },
        UpdateExpression: 'SET #s = :s, initiatedAt = :t',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':s': 'initiated',
          ':t': new Date().toISOString(),
        },
      }),
    );

    console.log('Outbound call placed for callback', callbackId);
  } catch (err) {
    console.error('Failed to place outbound call', err);
    await docClient.send(
      new UpdateCommand({
        TableName: process.env.CALLBACKS_TABLE!,
        Key: { callbackId },
        UpdateExpression: 'SET #s = :s',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':s': 'failed' },
      }),
    );
    throw err;
  }
};
