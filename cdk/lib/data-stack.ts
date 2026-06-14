import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

interface DataStackProps extends cdk.StackProps {
  stage?: string;
}

export class DataStack extends cdk.Stack {
  public readonly clientsTable: dynamodb.Table;
  public readonly chatSessionsTable: dynamodb.Table;
  public readonly callbacksTable: dynamodb.Table;
  public readonly transcriptsTable: dynamodb.Table;
  public readonly transactionsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: DataStackProps) {
    super(scope, id, props);

    // '' for prod (names unchanged), '-<stage>' otherwise.
    const sfx = props?.stage && props.stage !== 'prod' ? `-${props.stage}` : '';

    // ── Clients table ──────────────────────────────────────────────
    this.clientsTable = new dynamodb.Table(this, 'ClientsTable', {
      tableName: `bobs-clients${sfx}`,
      partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Chat sessions table ────────────────────────────────────────
    this.chatSessionsTable = new dynamodb.Table(this, 'ChatSessionsTable', {
      tableName: `bobs-chat-sessions${sfx}`,
      partitionKey: { name: 'contactId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Callbacks table ────────────────────────────────────────────
    this.callbacksTable = new dynamodb.Table(this, 'CallbacksTable', {
      tableName: `bobs-callbacks${sfx}`,
      partitionKey: { name: 'callbackId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.callbacksTable.addGlobalSecondaryIndex({
      indexName: 'clientId-status-index',
      partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
    });

    // Demo client data is seeded via the /reset-client-data Lambda endpoint after deploy.
    // DynamoDB UpdateCommand (SET) creates items if they don't exist — no CDK seed needed.

    // ── Transactions table ─────────────────────────────────────────
    // One item per transaction (not an array on the client item) so histories can
    // run back to an account's inception — decades, thousands of rows — without
    // hitting the 400KB item limit or forcing the whole history onto the wire.
    //   PK clientId, SK txnSort = `${dateISO}#${seq}` → ScanIndexForward=false is
    //   newest-first natively. account-index serves per-account reads/filters
    //   (acctKey = `${clientId}#${accountId}`, composite because account IDs like
    //   `acc-001` repeat across personas).
    this.transactionsTable = new dynamodb.Table(this, 'TransactionsTable', {
      tableName: `bobs-transactions${sfx}`,
      partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'txnSort', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.transactionsTable.addGlobalSecondaryIndex({
      indexName: 'account-index',
      partitionKey: { name: 'acctKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'txnSort', type: dynamodb.AttributeType.STRING },
    });

    // ── Transcripts table ──────────────────────────────────────────
    this.transcriptsTable = new dynamodb.Table(this, 'TranscriptsTable', {
      tableName: `bobs-transcripts${sfx}`,
      partitionKey: { name: 'transcriptId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,  // never auto-delete transcript data
    });
    this.transcriptsTable.addGlobalSecondaryIndex({
      indexName: 'clientId-savedAt-index',
      partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'savedAt', type: dynamodb.AttributeType.NUMBER },
    });

    // ── Outputs ────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ClientsTableName', { value: this.clientsTable.tableName });
    new cdk.CfnOutput(this, 'ChatSessionsTableName', { value: this.chatSessionsTable.tableName });
    new cdk.CfnOutput(this, 'CallbacksTableName', { value: this.callbacksTable.tableName });
    new cdk.CfnOutput(this, 'TranscriptsTableName', { value: this.transcriptsTable.tableName });
    new cdk.CfnOutput(this, 'TransactionsTableName', { value: this.transactionsTable.tableName });
  }
}
