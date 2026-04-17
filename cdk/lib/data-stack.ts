import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { Construct } from 'constructs';

export class DataStack extends cdk.Stack {
  public readonly clientsTable: dynamodb.Table;
  public readonly chatSessionsTable: dynamodb.Table;
  public readonly callbacksTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── Clients table ──────────────────────────────────────────────
    this.clientsTable = new dynamodb.Table(this, 'ClientsTable', {
      tableName: 'bobs-clients',
      partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Chat sessions table ────────────────────────────────────────
    this.chatSessionsTable = new dynamodb.Table(this, 'ChatSessionsTable', {
      tableName: 'bobs-chat-sessions',
      partitionKey: { name: 'contactId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Callbacks table ────────────────────────────────────────────
    this.callbacksTable = new dynamodb.Table(this, 'CallbacksTable', {
      tableName: 'bobs-callbacks',
      partitionKey: { name: 'callbackId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.callbacksTable.addGlobalSecondaryIndex({
      indexName: 'clientId-status-index',
      partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
    });

    // ── Seed Lambda (runs once on deploy to insert Alex Johnson) ───
    const seedFn = new lambda.Function(this, 'SeedFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');
exports.handler = async () => {
  const client = new DynamoDBClient({});
  const item = {
    clientId: 'demo-client-001',
    name: 'Alex Johnson',
    phone: '4842384838',
    accounts: [
      { type: 'Roth IRA', balance: 45230, id: 'acc-001' },
      { type: 'Traditional IRA', balance: 128450, id: 'acc-002' },
      { type: 'Taxable Account', balance: 67890, id: 'acc-003' },
    ],
    totalBalance: 241570,
    recentChatHistory: [
      { date: '2025-03-10', topic: 'Fund performance', summary: 'Asked about BobsFunds 500 Index YTD returns' },
      { date: '2025-02-14', topic: 'RMD rules', summary: 'Asked about required minimum distributions for Traditional IRA' },
    ],
  };
  await client.send(new PutItemCommand({
    TableName: process.env.CLIENTS_TABLE,
    Item: marshall(item, { removeUndefinedValues: true }),
    ConditionExpression: 'attribute_not_exists(clientId)',
  }));
  return { status: 'seeded' };
};
      `),
      timeout: cdk.Duration.seconds(30),
      environment: { CLIENTS_TABLE: this.clientsTable.tableName },
    });
    this.clientsTable.grantWriteData(seedFn);

    // Custom resource triggers the seed fn on deploy
    new cr.AwsCustomResource(this, 'SeedTrigger', {
      onCreate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: seedFn.functionName,
          InvocationType: 'RequestResponse',
        },
        physicalResourceId: cr.PhysicalResourceId.of('SeedTrigger'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [seedFn.functionArn],
      }),
    });

    // ── Outputs ────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ClientsTableName', { value: this.clientsTable.tableName });
    new cdk.CfnOutput(this, 'ChatSessionsTableName', { value: this.chatSessionsTable.tableName });
    new cdk.CfnOutput(this, 'CallbacksTableName', { value: this.callbacksTable.tableName });
  }
}
