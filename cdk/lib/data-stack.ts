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
  public readonly fundsTable: dynamodb.Table;
  public readonly verificationTable: dynamodb.Table;
  public readonly agentsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: DataStackProps) {
    super(scope, id, props);

    // '' for prod (names unchanged), '-<stage>' otherwise.
    const sfx = props?.stage && props.stage !== 'prod' ? `-${props.stage}` : '';

    // ── Clients table ──────────────────────────────────────────────
    this.clientsTable = new dynamodb.Table(this, 'ClientsTable', {
      tableName: `bobs-clients${sfx}`,
      partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Chat sessions table ────────────────────────────────────────
    this.chatSessionsTable = new dynamodb.Table(this, 'ChatSessionsTable', {
      tableName: `bobs-chat-sessions${sfx}`,
      partitionKey: { name: 'contactId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Callbacks table ────────────────────────────────────────────
    this.callbacksTable = new dynamodb.Table(this, 'CallbacksTable', {
      tableName: `bobs-callbacks${sfx}`,
      partitionKey: { name: 'callbackId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
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
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
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
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,  // never auto-delete transcript data
    });
    this.transcriptsTable.addGlobalSecondaryIndex({
      indexName: 'clientId-savedAt-index',
      partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'savedAt', type: dynamodb.AttributeType.NUMBER },
    });

    // ── Funds table ────────────────────────────────────────────────
    // Static fund-catalog reference data (the 36-fund lineup) — name, ticker, expense
    // ratio, group, descriptions, risk, etc. This is the runtime source of truth for the
    // content pages AND the AI systems, so they can never drift out of sync. Seeded from
    // customer-app/src/data/funds.ts via the /reset-funds Lambda. Only ~36 small items and
    // changes < once/day, so reads are a single full Scan (module-cached in the readers).
    // Live prices/returns are NOT here — those stay in the market-data Lambda (Yahoo).
    this.fundsTable = new dynamodb.Table(this, 'FundsTable', {
      tableName: `bobs-funds${sfx}`,
      partitionKey: { name: 'ticker', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Verification codes table ───────────────────────────────────
    // Short-lived one-time codes for real email/SMS verification on the My Account
    // hub. PK codeId = `${clientId}#${channel}#${target}`; rows auto-expire via the
    // `expiresAt` TTL (~10 min) so stale codes can't accumulate or be reused.
    this.verificationTable = new dynamodb.Table(this, 'VerificationTable', {
      tableName: `bobs-verification-codes${sfx}`,
      partitionKey: { name: 'codeId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Agents table ───────────────────────────────────────────────
    // Supervisor Dashboard workforce roster: ~82 agents (the real Connect users plus a
    // fictional population) each carrying a deterministic weekly performance history.
    // Demo aggregates ONLY — real conversations stay in bobs-transcripts and are blended
    // at read time by supervisor-stats. Seeded via the /reset-agents Lambda; fully
    // reseedable, so no PITR/RETAIN needed.
    this.agentsTable = new dynamodb.Table(this, 'AgentsTable', {
      tableName: `bobs-agents${sfx}`,
      partitionKey: { name: 'agentUsername', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Outputs ────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ClientsTableName', { value: this.clientsTable.tableName });
    new cdk.CfnOutput(this, 'ChatSessionsTableName', { value: this.chatSessionsTable.tableName });
    new cdk.CfnOutput(this, 'CallbacksTableName', { value: this.callbacksTable.tableName });
    new cdk.CfnOutput(this, 'TranscriptsTableName', { value: this.transcriptsTable.tableName });
    new cdk.CfnOutput(this, 'TransactionsTableName', { value: this.transactionsTable.tableName });
    new cdk.CfnOutput(this, 'FundsTableName', { value: this.fundsTable.tableName });
    new cdk.CfnOutput(this, 'VerificationTableName', { value: this.verificationTable.tableName });
    new cdk.CfnOutput(this, 'AgentsTableName', { value: this.agentsTable.tableName });
  }
}
