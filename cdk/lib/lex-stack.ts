import * as cdk from 'aws-cdk-lib';
import * as lex from 'aws-cdk-lib/aws-lex';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

interface LexStackProps extends cdk.StackProps {
  fulfillmentLambdaArn: string;
}

export class LexStack extends cdk.Stack {
  public readonly botArn: string;
  public readonly botAliasArn: string;
  public readonly botId: string;
  public readonly botAliasId: string;

  constructor(scope: Construct, id: string, props: LexStackProps) {
    super(scope, id, props);

    const { fulfillmentLambdaArn } = props;

    // ── IAM role for the Lex bot ───────────────────────────────────
    const lexRole = new iam.Role(this, 'LexRole', {
      roleName: 'bobs-lex-role',
      assumedBy: new iam.ServicePrincipal('lexv2.amazonaws.com'),
      inlinePolicies: {
        LexPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['polly:SynthesizeSpeech'],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              actions: ['lambda:InvokeFunction'],
              resources: [fulfillmentLambdaArn],
            }),
          ],
        }),
      },
    });

    const fulfillmentHook = {
      lambdaCodeHook: {
        lambdaArn: fulfillmentLambdaArn,
        codeHookInterfaceVersion: '1.0',
      },
      enabled: true,
    };

    // Helper: build a simple intent definition
    const intent = (
      name: string,
      utterances: string[],
      slots?: lex.CfnBot.SlotProperty[],
    ): lex.CfnBot.IntentProperty => ({
      name,
      sampleUtterances: utterances.map(u => ({ utterance: u })),
      slots: slots ?? [],
      slotPriorities: slots?.map((s, i) => ({ slotName: s.name, priority: i + 1 })) ?? [],
      fulfillmentCodeHook: fulfillmentHook,
      dialogCodeHook: { enabled: true },
    });

    // ── Bot definition ─────────────────────────────────────────────
    const bot = new lex.CfnBot(this, 'BobsAssistant', {
      name: 'BobsAssistant',
      roleArn: lexRole.roleArn,
      dataPrivacy: { ChildDirected: false },
      idleSessionTtlInSeconds: 300,
      autoBuildBotLocales: true,
      botLocales: [
        {
          localeId: 'en_US',
          nluConfidenceThreshold: 0.40,
          slotTypes: [
            {
              name: 'FundNameType',
              valueSelectionSetting: { resolutionStrategy: 'TOP_RESOLUTION' },
              slotTypeValues: [
                { sampleValue: { value: 'BobsFunds 500 Index' } },
                { sampleValue: { value: 'BobsFunds Growth' } },
                { sampleValue: { value: 'BobsFunds Bond Income' } },
                { sampleValue: { value: 'BobsFunds International' } },
                { sampleValue: { value: 'BobsFunds ESG Leaders' } },
                { sampleValue: { value: 'BobsFunds Short-Term Treasury' } },
              ],
            },
          ],
          intents: [
            intent('Greeting', [
              'hi', 'hello', 'hey', 'good morning', 'good afternoon',
              'hey there', 'hi there', 'howdy',
            ]),
            intent('AccountBalance', [
              'what is my balance',
              'show my account balance',
              'how much money do I have',
              'check my account',
              'what are my holdings',
              'show me my accounts',
            ]),
            {
              name: 'FundPerformance',
              sampleUtterances: [
                { utterance: 'how is {FundName} doing' },
                { utterance: 'what is the performance of {FundName}' },
                { utterance: 'show me {FundName} returns' },
                { utterance: 'how has {FundName} performed' },
                { utterance: 'what are the returns on {FundName}' },
              ],
              slots: [
                {
                  name: 'FundName',
                  slotTypeName: 'FundNameType',
                  valueElicitationSetting: {
                    slotConstraint: 'Optional',
                    promptSpecification: {
                      maxRetries: 2,
                      messageGroupsList: [
                        {
                          message: {
                            plainTextMessage: {
                              value: 'Which fund are you asking about? For example, BobsFunds 500 Index or BobsFunds Growth.',
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              ],
              slotPriorities: [{ slotName: 'FundName', priority: 1 }],
              fulfillmentCodeHook: fulfillmentHook,
              dialogCodeHook: { enabled: true },
            },
            intent('PlaceOrder', [
              'I want to invest',
              'buy some shares',
              'place a trade',
              'I want to put money into',
              'move money to',
              'transfer funds',
            ]),
            intent('ChangeOwnership', [
              'change account owner',
              'transfer account ownership',
              'I inherited an account',
              'my relative passed away',
              'estate account',
              'beneficiary account transfer',
              'deceased account holder',
            ]),
            intent('TechnicalHelp', [
              'I cannot log in',
              'app is not working',
              'website is broken',
              'I forgot my password',
              'reset my password',
              'technical problem',
              'having trouble with the site',
            ]),
            intent('EscalateAgent', [
              'talk to a person',
              'speak with an agent',
              'I need a human',
              'connect me to support',
              'live agent please',
              'human please',
              'I want to speak to someone',
              'can I talk to a representative',
            ]),
            intent('ScheduleCallback', [
              'call me back',
              'I want a callback',
              'schedule a call',
              'have someone call me',
              'call me at',
              'reach me by phone',
            ]),
            {
              name: 'FallbackIntent',
              parentIntentSignature: 'AMAZON.FallbackIntent',
              fulfillmentCodeHook: fulfillmentHook,
            },
          ],
          voiceSettings: { voiceId: 'Joanna', engine: 'neural' },
        },
      ],
    });

    // ── Bot version ────────────────────────────────────────────────
    const botVersion = new lex.CfnBotVersion(this, 'BotVersion', {
      botId: bot.ref,
      botVersionLocaleSpecification: [
        {
          localeId: 'en_US',
          botVersionLocaleDetails: { sourceBotVersion: 'DRAFT' },
        },
      ],
    });
    botVersion.addDependency(bot);

    // ── Bot alias (live) ───────────────────────────────────────────
    const botAlias = new lex.CfnBotAlias(this, 'BotAlias', {
      botId: bot.ref,
      botAliasName: 'live',
      botVersion: botVersion.attrBotVersion,
      botAliasLocaleSettings: [
        {
          localeId: 'en_US',
          botAliasLocaleSetting: {
            enabled: true,
            codeHookSpecification: {
              lambdaCodeHook: {
                lambdaArn: fulfillmentLambdaArn,
                codeHookInterfaceVersion: '1.0',
              },
            },
          },
        },
      ],
    });
    botAlias.addDependency(botVersion);

    // ── Resource policy: let Amazon Connect invoke this bot alias ──────
    const lexConnectPolicy = new cr.AwsCustomResource(this, 'LexConnectPolicy', {
      onCreate: {
        service: 'LexModelsV2',
        action: 'createResourcePolicy',
        parameters: {
          resourceArn: botAlias.attrArn,
          policy: cdk.Fn.sub(
            '{"Version":"2012-10-17","Statement":[{"Sid":"AllowConnect","Effect":"Allow","Principal":{"Service":"connect.amazonaws.com"},"Action":["lex:RecognizeText","lex:RecognizeUtterance","lex:StartConversation","lex:DeleteSession","lex:PutSession"],"Resource":"${AliasArn}","Condition":{"StringEquals":{"aws:SourceAccount":"${AccountId}"},"ArnLike":{"aws:SourceArn":"arn:aws:connect:${Region}:${AccountId}:instance/*"}}}]}',
            { AliasArn: botAlias.attrArn, AccountId: this.account, Region: this.region },
          ),
        },
        physicalResourceId: cr.PhysicalResourceId.of('LexConnectPolicy'),
      },
      onDelete: {
        service: 'LexModelsV2',
        action: 'deleteResourcePolicy',
        parameters: {
          resourceArn: botAlias.attrArn,
        },
        physicalResourceId: cr.PhysicalResourceId.of('LexConnectPolicy'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({ resources: ['*'] }),
    });
    lexConnectPolicy.node.addDependency(botAlias);

    this.botArn = `arn:aws:lex:${this.region}:${this.account}:bot/${bot.ref}`;
    this.botAliasArn = botAlias.attrArn;
    this.botId = bot.ref;
    this.botAliasId = botAlias.attrBotAliasId;

    // ── Outputs ────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'BotId', {
      value: bot.ref,
      description: 'Lex Bot ID — needed for Connect association',
    });
    new cdk.CfnOutput(this, 'BotAliasId', {
      value: botAlias.attrBotAliasId,
      description: 'Lex Bot Alias ID — needed for Connect association',
    });
  }
}
