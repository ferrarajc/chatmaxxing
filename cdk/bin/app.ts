#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DataStack } from '../lib/data-stack';
import { LambdaStack } from '../lib/lambda-stack';
import { LexStack } from '../lib/lex-stack';
import { ConnectStack } from '../lib/connect-stack';
import { CicdStack } from '../lib/cicd-stack';
import { BudgetStack } from '../lib/budget-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

// Deployment stage. 'prod' (default) keeps every resource name byte-identical to what's
// already deployed — DO NOT change that. 'dev' suffixes every resource with '-dev', producing
// a fully isolated parallel environment (own tables + API) for testing before prod.
// Set via `STAGE=dev` env (used by `npm run deploy:dev`) or `-c stage=dev`.
const stage = process.env.STAGE ?? (app.node.tryGetContext('stage') as string | undefined) ?? 'prod';
const isProd = stage === 'prod';
const sfx = isProd ? '' : `-${stage}`;

const dataStack = new DataStack(app, `BobsDataStack${sfx}`, { env, stage });

const lambdaStack = new LambdaStack(app, `BobsLambdaStack${sfx}`, {
  env,
  stage,
  clientsTable: dataStack.clientsTable,
  chatSessionsTable: dataStack.chatSessionsTable,
  callbacksTable: dataStack.callbacksTable,
  transcriptsTable: dataStack.transcriptsTable,
  transactionsTable: dataStack.transactionsTable,
  fundsTable: dataStack.fundsTable,
  verificationTable: dataStack.verificationTable,
  agentsTable: dataStack.agentsTable,
});
lambdaStack.addDependency(dataStack);

// Lex (Lex bot) and Connect (contact flows) are prod-only — the dev environment reuses the
// prod Connect instance for any live-chat testing (a second Connect instance is heavyweight).
if (isProd) {
  const lexStack = new LexStack(app, 'BobsLexStack', {
    env,
    fulfillmentLambdaArn: lambdaStack.predictIntentFn.functionArn,
  });
  lexStack.addDependency(lambdaStack);

  const connectStack = new ConnectStack(app, 'BobsConnectStack', {
    env,
    startOutboundFnArn: lambdaStack.executeCallbackFn.functionArn,
  });
  connectStack.addDependency(lexStack);

  // CI/CD identity (GitHub OIDC → deploy role) and a monthly cost guardrail. Account-level,
  // so prod-only and deployed manually (rarely change).
  new CicdStack(app, 'BobsCicdStack', { env });
  new BudgetStack(app, 'BobsBudgetStack', { env, notifyEmail: 'ferrarajc@yahoo.com', monthlyLimitUsd: 15 });
}

// Tag dev resources so Cost Explorer can break out dev vs prod spend.
if (!isProd) {
  cdk.Tags.of(dataStack).add('Stage', stage);
  cdk.Tags.of(lambdaStack).add('Stage', stage);
}
