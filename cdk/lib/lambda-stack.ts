import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as path from 'path';
import { Construct } from 'constructs';

interface LambdaStackProps extends cdk.StackProps {
  clientsTable: dynamodb.Table;
  chatSessionsTable: dynamodb.Table;
  callbacksTable: dynamodb.Table;
  transcriptsTable: dynamodb.Table;
  transactionsTable: dynamodb.Table;
  fundsTable: dynamodb.Table;
  verificationTable: dynamodb.Table;
  replyEventsTable: dynamodb.Table;
  agentsTable: dynamodb.Table;
  stage?: string;
}

export class LambdaStack extends cdk.Stack {
  public readonly predictIntentFn: NodejsFunction;
  public readonly executeCallbackFn: NodejsFunction;
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const { clientsTable, chatSessionsTable, callbacksTable, transcriptsTable, transactionsTable, fundsTable, verificationTable, replyEventsTable, agentsTable, stage } = props;

    // '' for prod (names unchanged), '-<stage>' otherwise. Applied to every physical
    // resource name (Lambda functionName, role name, API name) so dev is fully isolated.
    const sfx = stage && stage !== 'prod' ? `-${stage}` : '';

    // ── Shared base config ─────────────────────────────────────────
    const baseEnv: Record<string, string> = {
      CLIENTS_TABLE: clientsTable.tableName,
      SESSIONS_TABLE: chatSessionsTable.tableName,
      CALLBACKS_TABLE: callbacksTable.tableName,
      TRANSCRIPTS_TABLE: transcriptsTable.tableName,
      TRANSACTIONS_TABLE: transactionsTable.tableName,
      FUNDS_TABLE: fundsTable.tableName,
      REPLY_EVENTS_TABLE: replyEventsTable.tableName,
      BEDROCK_MODEL_ID: 'us.amazon.nova-micro-v1:0',
      BEDROCK_REGION: this.region,
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      // Resolved by CloudFormation from SSM at deploy time — no shell variable needed.
      // To set: aws ssm put-parameter --name "bobs-openai-api-key" --value sk-... --type String --overwrite
      OPENAI_API_KEY: ssm.StringParameter.valueForStringParameter(this, 'bobs-openai-api-key'),
      // Arize observability — get both from app.arize.com → Settings.
      // Leave blank to disable; all LLM calls still work normally without them.
      ARIZE_API_KEY:   process.env.ARIZE_API_KEY   ?? '',
      ARIZE_SPACE_KEY: process.env.ARIZE_SPACE_KEY ?? '',
    };

    const lambdaDir = path.join(__dirname, '../../lambda');

    // ── EventBridge Scheduler execution role ───────────────────────
    const schedulerRole = new iam.Role(this, 'SchedulerRole', {
      roleName: `bobs-scheduler-role${sfx}`,
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });

    // ── execute-callback (referenced by schedule-callback) ─────────
    this.executeCallbackFn = new NodejsFunction(this, 'ExecuteCallbackFn', {
      functionName: `bobs-execute-callback${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'execute-callback/handler.ts'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ...baseEnv,
        CONNECT_INSTANCE_ID: '467c849e-e16e-404a-b9f8-ebb623f84c8b',
        OUTBOUND_FLOW_ID: '0552dda6-bc44-460b-ba77-b876a1f7c40c',   // Bobs-Outbound-IVR
        PHONE_QUEUE_ID: '0f75bd89-94ec-40ee-b76c-520d0ff9480c',      // phone-general
      },
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    callbacksTable.grantReadWriteData(this.executeCallbackFn);
    this.executeCallbackFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['connect:StartOutboundVoiceContact'],
      resources: ['*'],
    }));
    schedulerRole.addToPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [this.executeCallbackFn.functionArn],
    }));

    // ── start-chat ─────────────────────────────────────────────────
    const startChatFn = new NodejsFunction(this, 'StartChatFn', {
      functionName: `bobs-start-chat${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'start-chat/handler.ts'),
      timeout: cdk.Duration.seconds(29),
      memorySize: 256,
      environment: {
        ...baseEnv,
        CONNECT_INSTANCE_ID: process.env.CONNECT_INSTANCE_ID ?? '467c849e-e16e-404a-b9f8-ebb623f84c8b',
        CONNECT_CHAT_FLOW_ID: process.env.CONNECT_CHAT_FLOW_ID ?? '5e4fec02-582e-43f0-8200-e652064fb381',
        CONNECT_AGENT_FLOW_ID: process.env.CONNECT_AGENT_FLOW_ID ?? '2da1a6bd-e5ac-480c-98fd-e215ab806f98',
      },
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    chatSessionsTable.grantWriteData(startChatFn);
    startChatFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['connect:StartChatContact'],
      resources: ['*'],
    }));

    // ── predict-intent (also Lex fulfillment hook) ─────────────────
    this.predictIntentFn = new NodejsFunction(this, 'PredictIntentFn', {
      functionName: `bobs-predict-intent${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'predict-intent/handler.ts'),
      timeout: cdk.Duration.seconds(29),
      memorySize: 512,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    clientsTable.grantReadData(this.predictIntentFn);
    chatSessionsTable.grantReadData(this.predictIntentFn);
    this.predictIntentFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }));
    // Allow Lex to invoke this Lambda
    this.predictIntentFn.addPermission('LexInvoke', {
      principal: new iam.ServicePrincipal('lexv2.amazonaws.com'),
      action: 'lambda:InvokeFunction',
    });

    // ── predict-questions (two-level pill drill-down) ──────────────
    const predictQuestionsFn = new NodejsFunction(this, 'PredictQuestionsFn', {
      functionName: `bobs-predict-questions${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'predict-questions/handler.ts'),
      timeout: cdk.Duration.seconds(29),
      memorySize: 256,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    clientsTable.grantReadData(predictQuestionsFn);
    predictQuestionsFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }));

    // ── next-best-response ─────────────────────────────────────────
    const nextBestResponseFn = new NodejsFunction(this, 'NextBestResponseFn', {
      functionName: `bobs-next-best-response${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'next-best-response/handler.ts'),
      timeout: cdk.Duration.seconds(29),
      memorySize: 512,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    clientsTable.grantReadData(nextBestResponseFn);
    transactionsTable.grantReadData(nextBestResponseFn);
    fundsTable.grantReadData(nextBestResponseFn);  // get_funds tool
    nextBestResponseFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }));

    // ── schedule-callback ──────────────────────────────────────────
    const scheduleCallbackFn = new NodejsFunction(this, 'ScheduleCallbackFn', {
      functionName: `bobs-schedule-callback${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'schedule-callback/handler.ts'),
      timeout: cdk.Duration.seconds(29),
      memorySize: 256,
      environment: {
        ...baseEnv,
        SCHEDULER_ROLE_ARN: schedulerRole.roleArn,
        EXECUTE_CALLBACK_FN_ARN: this.executeCallbackFn.functionArn,
      },
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    callbacksTable.grantWriteData(scheduleCallbackFn);
    scheduleCallbackFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['scheduler:CreateSchedule', 'iam:PassRole'],
      resources: ['*'],
    }));

    // ── autopilot-turn ─────────────────────────────────────────────
    const autopilotTurnFn = new NodejsFunction(this, 'AutopilotTurnFn', {
      functionName: `bobs-autopilot-turn${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'autopilot-turn/handler.ts'),
      timeout: cdk.Duration.seconds(29),
      memorySize: 512,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    autopilotTurnFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }));
    autopilotTurnFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['connect:*'],
      resources: ['*'],
    }));
    clientsTable.grantReadData(autopilotTurnFn);
    transactionsTable.grantReadData(autopilotTurnFn);
    fundsTable.grantReadData(autopilotTurnFn);  // get_funds tool

    // ── generate-acw ──────────────────────────────────────────────
    const generateAcwFn = new NodejsFunction(this, 'GenerateAcwFn', {
      functionName: `bobs-generate-acw${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'generate-acw/handler.ts'),
      timeout: cdk.Duration.seconds(29),
      memorySize: 256,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });

    // ── send-agent-message ─────────────────────────────────────────
    const sendAgentMessageFn = new NodejsFunction(this, 'SendAgentMessageFn', {
      functionName: `bobs-send-agent-message${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'send-agent-message/handler.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    // ConnectParticipant API uses bearer token auth (not IAM) — no extra policy needed

    // ── client-log ─────────────────────────────────────────────────
    const clientLogFn = new NodejsFunction(this, 'ClientLogFn', {
      functionName: `bobs-client-log${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'client-log/handler.ts'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        ...baseEnv,
        // Pager Doodie push on customer-site access-code entry. Resolved from SSM
        // at deploy time (same pattern as bobs-openai-api-key). To set the values:
        //   aws ssm put-parameter --name "bobs-pagerdoodie-api-base" --value <url> --type String --overwrite
        //   aws ssm put-parameter --name "bobs-pagerdoodie-api-key"  --value <key> --type String --overwrite
        PAGERDOODIE_API_BASE: ssm.StringParameter.valueForStringParameter(this, 'bobs-pagerdoodie-api-base'),
        PAGERDOODIE_API_KEY: ssm.StringParameter.valueForStringParameter(this, 'bobs-pagerdoodie-api-key'),
      },
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });

    // ── agent-connection ───────────────────────────────────────────
    const agentConnectionFn = new NodejsFunction(this, 'AgentConnectionFn', {
      functionName: `bobs-agent-connection${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'agent-connection/handler.ts'),
      timeout: cdk.Duration.seconds(29),
      memorySize: 256,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    agentConnectionFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['connect:*'],
      resources: ['*'],
    }));

    // ── agent-availability (is the previous agent on queue?) ───────
    const agentAvailabilityFn = new NodejsFunction(this, 'AgentAvailabilityFn', {
      functionName: `bobs-agent-availability${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'agent-availability/handler.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: {
        ...baseEnv,
        CONNECT_INSTANCE_ID: process.env.CONNECT_INSTANCE_ID ?? '467c849e-e16e-404a-b9f8-ebb623f84c8b',
      },
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    agentAvailabilityFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['connect:*'],
      resources: ['*'],
    }));

    // ── execute-task (agent proposed-action execution) ─────────────
    const executeTaskFn = new NodejsFunction(this, 'ExecuteTaskFn', {
      functionName: `bobs-execute-task${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'execute-task/handler.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    clientsTable.grantReadWriteData(executeTaskFn);
    callbacksTable.grantReadWriteData(executeTaskFn);
    transactionsTable.grantReadWriteData(executeTaskFn);

    // ── reset-beneficiaries (browser-accessible demo reset endpoint) ─
    const resetBeneficiariesFn = new NodejsFunction(this, 'ResetBeneficiariesFn', {
      functionName: `bobs-reset-beneficiaries${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'reset-beneficiaries/handler.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    clientsTable.grantReadWriteData(resetBeneficiariesFn);

    // ── reset-all-data (browser-accessible full demo reset endpoint) ─
    const resetClientDataFn = new NodejsFunction(this, 'ResetClientDataFn', {
      functionName: `bobs-reset-client-data${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'reset-all-data/handler.ts'),
      // Seeds thousands of transaction rows across 4 clients via BatchWrite — needs
      // more headroom than the other 15s/256MB demo Lambdas.
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    clientsTable.grantReadWriteData(resetClientDataFn);
    transactionsTable.grantReadWriteData(resetClientDataFn);

    // ── client-data (beneficiaries / auto-invest / RMD read+write) ─
    const clientDataFn = new NodejsFunction(this, 'ClientDataFn', {
      functionName: `bobs-client-data${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'client-data/handler.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    clientsTable.grantReadWriteData(clientDataFn);
    transactionsTable.grantReadWriteData(clientDataFn);

    // ── save-transcript ────────────────────────────────────────────
    const saveTranscriptFn = new NodejsFunction(this, 'SaveTranscriptFn', {
      functionName: `bobs-save-transcript${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'save-transcript/handler.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    transcriptsTable.grantWriteData(saveTranscriptFn);
    chatSessionsTable.grantWriteData(saveTranscriptFn);
    // Writes lastAgentChat (continuation memory) onto the client record at chat end.
    clientsTable.grantWriteData(saveTranscriptFn);

    // ── log-reply (agent-response telemetry) ───────────────────────
    const logReplyFn = new NodejsFunction(this, 'LogReplyFn', {
      functionName: `bobs-log-reply${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'log-reply/handler.ts'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    replyEventsTable.grantWriteData(logReplyFn);

    // ── get-transcripts ────────────────────────────────────────────
    const getTranscriptsFn = new NodejsFunction(this, 'GetTranscriptsFn', {
      functionName: `bobs-get-transcripts${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'get-transcripts/handler.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    transcriptsTable.grantReadData(getTranscriptsFn);

    // ── pin-transcript ─────────────────────────────────────────────
    const pinTranscriptFn = new NodejsFunction(this, 'PinTranscriptFn', {
      functionName: `bobs-pin-transcript${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'pin-transcript/handler.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    transcriptsTable.grantReadWriteData(pinTranscriptFn);

    // ── verify (real email + SMS verification for the My Account hub) ──
    // SES_SENDER / SMS_ORIGINATION resolve from SSM at deploy time (like OPENAI_API_KEY) so the
    // OIDC prod deploy picks them up. The seeded placeholder value "unset" (or blank) ⇒ the handler
    // returns a clean "not configured" instead of throwing. To enable / point them:
    //   aws ssm put-parameter --name bobs-ses-sender      --value "Bob's <no-reply@yourdomain>" --type String --overwrite
    //   aws ssm put-parameter --name bobs-sms-origination --value "+1800…"                       --type String --overwrite
    //   • SES_SENDER      = a verified SES sender identity
    //   • SMS_ORIGINATION = an origination identity (toll-free number / phone-pool / sender-id ARN)
    const verifyFn = new NodejsFunction(this, 'VerifyFn', {
      functionName: `bobs-verify${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'verify/handler.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: {
        ...baseEnv,
        VERIFICATION_TABLE: verificationTable.tableName,
        SES_SENDER: ssm.StringParameter.valueForStringParameter(this, 'bobs-ses-sender'),
        SMS_ORIGINATION: ssm.StringParameter.valueForStringParameter(this, 'bobs-sms-origination'),
      },
      // The SES + SMS clients aren't guaranteed in the Lambda runtime, so bundle them;
      // the DynamoDB SDK is runtime-provided, so keep it external (matches the other fns).
      bundling: {
        minify: true, forceDockerBundling: false,
        externalModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb', '@aws-sdk/util-dynamodb'],
      },
    });
    verificationTable.grantReadWriteData(verifyFn);
    clientsTable.grantReadWriteData(verifyFn);
    verifyFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['ses:SendEmail'], resources: ['*'] }));
    verifyFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['sms-voice:SendTextMessage'], resources: ['*'] }));

    // ── prep-callback (agentic AI call-prep research) ──
    // Invoked async (no API route) the moment a callback is booked; uses the client-data tools
    // to research the ask and write a dossier onto the callback record. Generous timeout — the
    // tool-using research is deeper than real-time turns and not user-facing.
    const prepCallbackFn = new NodejsFunction(this, 'PrepCallbackFn', {
      functionName: `bobs-prep-callback${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'prep-callback/handler.ts'),
      timeout: cdk.Duration.seconds(120),
      memorySize: 512,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    callbacksTable.grantReadWriteData(prepCallbackFn);
    clientsTable.grantReadData(prepCallbackFn);
    transactionsTable.grantReadData(prepCallbackFn);
    fundsTable.grantReadData(prepCallbackFn);
    transcriptsTable.grantReadData(prepCallbackFn);  // fetch the real originating transcript by conversation id
    // schedule-callback fires prep the moment a callback is booked.
    prepCallbackFn.grantInvoke(scheduleCallbackFn);
    scheduleCallbackFn.addEnvironment('PREP_CALLBACK_FN_ARN', prepCallbackFn.functionArn);

    // ── agent-callbacks (phone-agent cockpit data API: list/get/complete/seed-demo) ──
    const agentCallbacksFn = new NodejsFunction(this, 'AgentCallbacksFn', {
      functionName: `bobs-agent-callbacks${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'agent-callbacks/handler.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: { ...baseEnv, PREP_CALLBACK_FN_ARN: prepCallbackFn.functionArn },
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    callbacksTable.grantReadWriteData(agentCallbacksFn);
    clientsTable.grantReadData(agentCallbacksFn);
    prepCallbackFn.grantInvoke(agentCallbacksFn);

    // ── HTTP API Gateway ───────────────────────────────────────────
    const api = new apigwv2.HttpApi(this, 'BobsApi', {
      apiName: `bobs-api${sfx}`,
      corsPreflight: {
        allowOrigins: [
          'https://ferrarajc.github.io',
          'http://localhost:5173',
          'http://localhost:5174',
          // dev API only: extra local ports so a port-flap on the vite dev server
          // (5175/5176 when 5173/5174 are taken) isn't CORS-blocked. Prod CORS unchanged.
          ...(stage !== 'prod' ? ['http://localhost:5175', 'http://localhost:5176'] : []),
        ],
        allowMethods: [
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['content-type', 'authorization'],
        maxAge: cdk.Duration.hours(1),
      },
    });

    // ── tts (OpenAI text-to-speech for the "Talk to Bob" voice feature) ──
    const ttsFn = new NodejsFunction(this, 'TtsFn', {
      functionName: `bobs-tts${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'tts/handler.ts'),
      timeout: cdk.Duration.seconds(29),
      memorySize: 512,
      environment: {
        ...baseEnv,
        OPENAI_TTS_MODEL: process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts',
        OPENAI_TTS_VOICE: process.env.OPENAI_TTS_VOICE ?? 'onyx',
        // ElevenLabs alternate TTS engine — resolved from SSM at deploy (set via
        // aws ssm put-parameter --name bobs-elevenlabs-api-key --value <key> --type String --overwrite).
        // Seeded "unset" ⇒ the handler returns a clean "not configured".
        ELEVENLABS_API_KEY: ssm.StringParameter.valueForStringParameter(this, 'bobs-elevenlabs-api-key'),
      },
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    // No DynamoDB access — calls OpenAI /v1/audio/speech over HTTPS.

    const routes: [string, NodejsFunction][] = [
      ['/tts', ttsFn],
      ['/start-chat', startChatFn],
      ['/predict-intent', this.predictIntentFn],
      ['/predict-questions', predictQuestionsFn],
      ['/next-best-response', nextBestResponseFn],
      ['/schedule-callback', scheduleCallbackFn],
      ['/agent-callbacks', agentCallbacksFn],
      ['/autopilot-turn', autopilotTurnFn],
      ['/generate-acw', generateAcwFn],
      ['/agent-connection', agentConnectionFn],
      ['/agent-availability', agentAvailabilityFn],
      ['/send-agent-message', sendAgentMessageFn],
      ['/client-log', clientLogFn],
      ['/client-data', clientDataFn],
      ['/execute-task', executeTaskFn],
      ['/save-transcript', saveTranscriptFn],
      ['/log-reply', logReplyFn],
      ['/pin-transcript', pinTranscriptFn],
      ['/verify', verifyFn],
    ];
    const postRoutes: apigwv2.HttpRoute[] = [];
    for (const [path, fn] of routes) {
      postRoutes.push(...api.addRoutes({
        path,
        methods: [apigwv2.HttpMethod.POST],
        integration: new HttpLambdaIntegration(`${fn.node.id}Integration`, fn),
      }));
    }

    // ── market-data (Yahoo Finance delayed quotes proxy) ──────────────
    const marketDataFn = new NodejsFunction(this, 'MarketDataFn', {
      functionName: `bobs-market-data${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'market-data/handler.ts'),
      timeout: cdk.Duration.seconds(29),
      memorySize: 256,
      environment: {},
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    // No DynamoDB access — fetches Yahoo Finance over HTTPS

    api.addRoutes({
      path: '/market-data',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('MarketDataIntegration', marketDataFn),
    });

    // ── get-funds (static fund catalog from DynamoDB, module-cached) ───
    const getFundsFn = new NodejsFunction(this, 'GetFundsFn', {
      functionName: `bobs-get-funds${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'get-funds/handler.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    fundsTable.grantReadData(getFundsFn);

    api.addRoutes({
      path: '/funds',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetFundsIntegration', getFundsFn),
    });

    // ── reset-funds (seed bobs-funds from the bundled fund catalog) ────
    const resetFundsFn = new NodejsFunction(this, 'ResetFundsFn', {
      functionName: `bobs-reset-funds${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'reset-funds/handler.ts'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    fundsTable.grantReadWriteData(resetFundsFn);

    api.addRoutes({
      path: '/reset-funds',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('ResetFundsIntegration', resetFundsFn),
    });

    // ── supervisor-stats (Supervisor Dashboard aggregates + AI insights) ─
    // AGENTS_TABLE is set per-function (not in baseEnv) so existing lambdas' deployed
    // config is untouched — this whole feature is additive.
    const supervisorStatsFn = new NodejsFunction(this, 'SupervisorStatsFn', {
      functionName: `bobs-supervisor-stats${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'supervisor-stats/handler.ts'),
      timeout: cdk.Duration.seconds(45), // insights view makes 2 LLM calls
      memorySize: 512,
      environment: { ...baseEnv, AGENTS_TABLE: agentsTable.tableName },
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    agentsTable.grantReadData(supervisorStatsFn);
    transcriptsTable.grantReadData(supervisorStatsFn);
    callbacksTable.grantReadData(supervisorStatsFn);

    api.addRoutes({
      path: '/supervisor-stats',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('SupervisorStatsIntegration', supervisorStatsFn),
    });

    // ── reset-agents (seed bobs-agents from the bundled roster + generator) ─
    const resetAgentsFn = new NodejsFunction(this, 'ResetAgentsFn', {
      functionName: `bobs-reset-agents${sfx}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'reset-agents/handler.ts'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: { ...baseEnv, AGENTS_TABLE: agentsTable.tableName },
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    agentsTable.grantReadWriteData(resetAgentsFn);

    api.addRoutes({
      path: '/reset-agents',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('ResetAgentsIntegration', resetAgentsFn),
    });

    // GET routes for browser-accessible reset endpoints
    api.addRoutes({
      path: '/reset-beneficiaries',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('ResetBeneficiariesIntegration', resetBeneficiariesFn),
    });
    api.addRoutes({
      path: '/reset-client-data',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('ResetClientDataIntegration', resetClientDataFn),
    });

    // GET route for transcript review UI
    api.addRoutes({
      path: '/get-transcripts',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetTranscriptsIntegration', getTranscriptsFn),
    });

    // ── Route-level throttling on costly endpoints ─────────────────
    // Prevents bot spam from running up OpenAI / Connect costs.
    // These limits are per-API (global), not per-IP — WAF would be needed for per-IP.
    const cfnStage = api.defaultStage?.node.defaultChild as apigwv2.CfnStage;
    // RouteSettings references routes by key (POST /start-chat, POST /autopilot-turn). On a
    // fresh stack create CFN may build the stage before those routes exist, which 404s. Make
    // the stage depend on the POST routes so they're created first.
    for (const r of postRoutes) api.defaultStage!.node.addDependency(r);
    cfnStage.addOverride('Properties.RouteSettings', {
      'POST /start-chat':     { ThrottlingBurstLimit: 5,  ThrottlingRateLimit: 3  },
      'POST /autopilot-turn': { ThrottlingBurstLimit: 10, ThrottlingRateLimit: 10 },
    });

    this.apiUrl = api.apiEndpoint;

    // ── Outputs ────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.apiEndpoint,
      description: 'API Gateway URL — set as VITE_API_URL in both apps',
    });
    new cdk.CfnOutput(this, 'SchedulerRoleArn', { value: schedulerRole.roleArn });
    new cdk.CfnOutput(this, 'ExecuteCallbackFnArn', { value: this.executeCallbackFn.functionArn });
    new cdk.CfnOutput(this, 'PredictIntentFnArn', { value: this.predictIntentFn.functionArn });
  }
}
