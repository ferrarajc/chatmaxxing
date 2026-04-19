import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';

interface LambdaStackProps extends cdk.StackProps {
  clientsTable: dynamodb.Table;
  chatSessionsTable: dynamodb.Table;
  callbacksTable: dynamodb.Table;
}

export class LambdaStack extends cdk.Stack {
  public readonly predictIntentFn: NodejsFunction;
  public readonly executeCallbackFn: NodejsFunction;
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const { clientsTable, chatSessionsTable, callbacksTable } = props;

    // ── Shared base config ─────────────────────────────────────────
    const baseEnv: Record<string, string> = {
      CLIENTS_TABLE: clientsTable.tableName,
      SESSIONS_TABLE: chatSessionsTable.tableName,
      CALLBACKS_TABLE: callbacksTable.tableName,
      BEDROCK_MODEL_ID: 'amazon.nova-micro-v1:0',
      BEDROCK_REGION: this.region,
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
    };

    const lambdaDir = path.join(__dirname, '../../lambda');

    // ── EventBridge Scheduler execution role ───────────────────────
    const schedulerRole = new iam.Role(this, 'SchedulerRole', {
      roleName: 'bobs-scheduler-role',
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });

    // ── execute-callback (referenced by schedule-callback) ─────────
    this.executeCallbackFn = new NodejsFunction(this, 'ExecuteCallbackFn', {
      functionName: 'bobs-execute-callback',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'execute-callback/handler.ts'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ...baseEnv,
        CONNECT_INSTANCE_ID: 'PLACEHOLDER',   // filled via SSM/manual after Connect deploy
        OUTBOUND_FLOW_ID: 'PLACEHOLDER',
        PHONE_QUEUE_ID: 'PLACEHOLDER',
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
      functionName: 'bobs-start-chat',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'start-chat/handler.ts'),
      timeout: cdk.Duration.seconds(29),
      memorySize: 256,
      environment: {
        ...baseEnv,
        CONNECT_INSTANCE_ID: 'PLACEHOLDER',
        CONNECT_CHAT_FLOW_ID: 'PLACEHOLDER',
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
      functionName: 'bobs-predict-intent',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'predict-intent/handler.ts'),
      timeout: cdk.Duration.seconds(29),
      memorySize: 256,
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

    // ── next-best-response ─────────────────────────────────────────
    const nextBestResponseFn = new NodejsFunction(this, 'NextBestResponseFn', {
      functionName: 'bobs-next-best-response',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'next-best-response/handler.ts'),
      timeout: cdk.Duration.seconds(29),
      memorySize: 256,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });
    nextBestResponseFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }));

    // ── schedule-callback ──────────────────────────────────────────
    const scheduleCallbackFn = new NodejsFunction(this, 'ScheduleCallbackFn', {
      functionName: 'bobs-schedule-callback',
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
      functionName: 'bobs-autopilot-turn',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'autopilot-turn/handler.ts'),
      timeout: cdk.Duration.seconds(29),
      memorySize: 256,
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

    // ── client-log ─────────────────────────────────────────────────
    const clientLogFn = new NodejsFunction(this, 'ClientLogFn', {
      functionName: 'bobs-client-log',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: path.join(lambdaDir, 'client-log/handler.ts'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: baseEnv,
      bundling: { minify: true, forceDockerBundling: false, externalModules: ['@aws-sdk/*'] },
    });

    // ── agent-connection ───────────────────────────────────────────
    const agentConnectionFn = new NodejsFunction(this, 'AgentConnectionFn', {
      functionName: 'bobs-agent-connection',
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

    // ── HTTP API Gateway ───────────────────────────────────────────
    const api = new apigwv2.HttpApi(this, 'BobsApi', {
      apiName: 'bobs-api',
      corsPreflight: {
        allowOrigins: [
          'https://ferrarajc.github.io',
          'http://localhost:5173',
          'http://localhost:5174',
        ],
        allowMethods: [
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['content-type', 'authorization'],
        maxAge: cdk.Duration.hours(1),
      },
    });

    const routes: [string, NodejsFunction][] = [
      ['/start-chat', startChatFn],
      ['/predict-intent', this.predictIntentFn],
      ['/next-best-response', nextBestResponseFn],
      ['/schedule-callback', scheduleCallbackFn],
      ['/autopilot-turn', autopilotTurnFn],
      ['/agent-connection', agentConnectionFn],
      ['/client-log', clientLogFn],
    ];
    for (const [path, fn] of routes) {
      api.addRoutes({
        path,
        methods: [apigwv2.HttpMethod.POST],
        integration: new HttpLambdaIntegration(`${fn.node.id}Integration`, fn),
      });
    }

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
