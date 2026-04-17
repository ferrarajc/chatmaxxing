import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cr from 'aws-cdk-lib/custom-resources';
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

    // ── Seed Alex Johnson directly via AwsCustomResource → DynamoDB PutItem ──
    new cr.AwsCustomResource(this, 'SeedTrigger', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: this.clientsTable.tableName,
          Item: {
            clientId:     { S: 'demo-client-001' },
            name:         { S: 'Alex Johnson' },
            phone:        { S: '4842384838' },
            totalBalance: { N: '241570' },
            accounts: {
              L: [
                { M: { type: { S: 'Roth IRA' },         balance: { N: '45230'  }, id: { S: 'acc-001' } } },
                { M: { type: { S: 'Traditional IRA' },   balance: { N: '128450' }, id: { S: 'acc-002' } } },
                { M: { type: { S: 'Taxable Account' },   balance: { N: '67890'  }, id: { S: 'acc-003' } } },
              ],
            },
            recentChatHistory: {
              L: [
                { M: { date: { S: '2025-03-10' }, topic: { S: 'Fund performance' }, summary: { S: 'Asked about BobsFunds 500 Index YTD returns' } } },
                { M: { date: { S: '2025-02-14' }, topic: { S: 'RMD rules' },        summary: { S: 'Asked about required minimum distributions for Traditional IRA' } } },
              ],
            },
          },
          ConditionExpression: 'attribute_not_exists(clientId)',
        },
        physicalResourceId: cr.PhysicalResourceId.of('SeedAlexJohnson'),
        ignoreErrorCodesMatching: 'ConditionalCheckFailedException',
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [this.clientsTable.tableArn],
      }),
    });

    // ── Outputs ────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ClientsTableName', { value: this.clientsTable.tableName });
    new cdk.CfnOutput(this, 'ChatSessionsTableName', { value: this.chatSessionsTable.tableName });
    new cdk.CfnOutput(this, 'CallbacksTableName', { value: this.callbacksTable.tableName });
  }
}
