#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DataStack } from '../lib/data-stack';
import { LambdaStack } from '../lib/lambda-stack';
import { LexStack } from '../lib/lex-stack';
import { ConnectStack } from '../lib/connect-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

const dataStack = new DataStack(app, 'BobsDataStack', { env });

const lambdaStack = new LambdaStack(app, 'BobsLambdaStack', {
  env,
  clientsTable: dataStack.clientsTable,
  chatSessionsTable: dataStack.chatSessionsTable,
  callbacksTable: dataStack.callbacksTable,
});
lambdaStack.addDependency(dataStack);

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
