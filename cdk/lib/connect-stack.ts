import * as cdk from 'aws-cdk-lib';
import * as connect from 'aws-cdk-lib/aws-connect';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

interface ConnectStackProps extends cdk.StackProps {
  lexBotArn: string;
  lexBotAliasArn: string;
  startOutboundFnArn: string;
}

// Inbound chat contact flow JSON
// Built to handle: Lex bot integration, intent routing, escalation
const INBOUND_CHAT_FLOW = JSON.stringify({
  Version: '2019-10-30',
  StartAction: 'SetAttributes',
  Actions: [
    {
      Identifier: 'SetAttributes',
      Type: 'UpdateContactAttributes',
      Parameters: {
        Attributes: {
          intentSummary: { Type: 'System', Value: '$.Attributes.intentSummary' },
          clientName: { Type: 'System', Value: '$.Attributes.clientName' },
          clientId: { Type: 'System', Value: '$.Attributes.clientId' },
          currentPage: { Type: 'System', Value: '$.Attributes.currentPage' },
        },
      },
      Transitions: { NextAction: 'SetQueue', Errors: [], Conditions: [] },
    },
    {
      Identifier: 'SetQueue',
      Type: 'UpdateContactTargetQueue',
      Parameters: { QueueId: { Type: 'Text', Value: 'chat-general' } },
      Transitions: { NextAction: 'GetLexInput', Errors: [], Conditions: [] },
    },
    {
      Identifier: 'GetLexInput',
      Type: 'ConnectParticipantWithLexBot',
      Parameters: {
        Text: 'Hi! How can I help you today?',
        LexV2Bot: {
          AliasArn: 'LEX_ALIAS_ARN_PLACEHOLDER',
        },
      },
      Transitions: {
        NextAction: 'TransferToQueue',
        Errors: [{ NextAction: 'TransferToQueue', ErrorType: 'NoMatchingError' }],
        Conditions: [
          { NextAction: 'TransferToQueue', Operator: 'Equals', Operands: ['EscalateAgent'] },
          { NextAction: 'ChangeOwnershipTransfer', Operator: 'Equals', Operands: ['ChangeOwnership'] },
        ],
      },
    },
    {
      Identifier: 'ChangeOwnershipTransfer',
      Type: 'MessageParticipant',
      Parameters: {
        Text: 'Account ownership changes require our specialist team. Let me connect you now.',
      },
      Transitions: { NextAction: 'TransferToOwnershipQueue', Errors: [], Conditions: [] },
    },
    {
      Identifier: 'TransferToOwnershipQueue',
      Type: 'TransferContactToQueue',
      Parameters: { QueueId: { Type: 'Text', Value: 'change-of-ownership' } },
      Transitions: { NextAction: 'End', Errors: [], Conditions: [] },
    },
    {
      Identifier: 'TransferToQueue',
      Type: 'TransferContactToQueue',
      Parameters: { QueueId: { Type: 'Text', Value: 'chat-general' } },
      Transitions: { NextAction: 'End', Errors: [], Conditions: [] },
    },
    {
      Identifier: 'End',
      Type: 'DisconnectParticipant',
      Parameters: {},
      Transitions: {},
    },
  ],
});

// Outbound IVR contact flow for callbacks
const OUTBOUND_IVR_FLOW = JSON.stringify({
  Version: '2019-10-30',
  StartAction: 'GreetCustomer',
  Actions: [
    {
      Identifier: 'GreetCustomer',
      Type: 'MessageParticipant',
      Parameters: {
        SSML: "<speak>Hello, this is Bob's Mutual Funds calling. Am I speaking with <emphasis>$.Attributes.clientName</emphasis>?</speak>",
      },
      Transitions: { NextAction: 'GetConfirmation', Errors: [], Conditions: [] },
    },
    {
      Identifier: 'GetConfirmation',
      Type: 'GetParticipantInput',
      Parameters: {
        Text: 'Press 1 or say yes to confirm.',
        InputTimeLimitSeconds: 8,
        DTMFOptions: {
          DisableCancel: false,
          InputTerminatingKey: '#',
        },
      },
      Transitions: {
        NextAction: 'Disconnect',
        Errors: [{ NextAction: 'Disconnect', ErrorType: 'NoMatchingError' }],
        Conditions: [
          { NextAction: 'ConnectToAgent', Operator: 'Equals', Operands: ['1'] },
        ],
      },
    },
    {
      Identifier: 'ConnectToAgent',
      Type: 'MessageParticipant',
      Parameters: { Text: "Please hold while I connect you to an agent at Bob's Mutual Funds." },
      Transitions: { NextAction: 'TransferToPhoneQueue', Errors: [], Conditions: [] },
    },
    {
      Identifier: 'TransferToPhoneQueue',
      Type: 'TransferContactToQueue',
      Parameters: { QueueId: { Type: 'Text', Value: 'phone-general' } },
      Transitions: { NextAction: 'Disconnect', Errors: [], Conditions: [] },
    },
    {
      Identifier: 'Disconnect',
      Type: 'DisconnectParticipant',
      Parameters: {},
      Transitions: {},
    },
  ],
});

export class ConnectStack extends cdk.Stack {
  public readonly instanceArn: string;

  constructor(scope: Construct, id: string, props: ConnectStackProps) {
    super(scope, id, props);

    const { lexBotAliasArn } = props;

    // ── Connect instance ───────────────────────────────────────────
    const instance = new connect.CfnInstance(this, 'ConnectInstance', {
      identityManagementType: 'CONNECT_MANAGED',
      inboundCallsEnabled: true,
      outboundCallsEnabled: true,
      attributes: {
        inboundCalls: true,
        outboundCalls: true,
        contactflowLogs: true,
        autoResolveBestVoices: true,
        useCustomTtsVoices: false,
        contactLens: true,
        earlyMedia: true,
      },
    });
    this.instanceArn = instance.attrArn;

    // ── Hours of operation (24/7 for demo) ─────────────────────────
    const hours247 = new connect.CfnHoursOfOperation(this, 'HoursAllDay', {
      instanceArn: instance.attrArn,
      name: '24x7',
      timeZone: 'America/New_York',
      config: [
        { day: 'MONDAY',    startTime: { hours: 0, minutes: 0 }, endTime: { hours: 23, minutes: 59 } },
        { day: 'TUESDAY',   startTime: { hours: 0, minutes: 0 }, endTime: { hours: 23, minutes: 59 } },
        { day: 'WEDNESDAY', startTime: { hours: 0, minutes: 0 }, endTime: { hours: 23, minutes: 59 } },
        { day: 'THURSDAY',  startTime: { hours: 0, minutes: 0 }, endTime: { hours: 23, minutes: 59 } },
        { day: 'FRIDAY',    startTime: { hours: 0, minutes: 0 }, endTime: { hours: 23, minutes: 59 } },
        { day: 'SATURDAY',  startTime: { hours: 0, minutes: 0 }, endTime: { hours: 23, minutes: 59 } },
        { day: 'SUNDAY',    startTime: { hours: 0, minutes: 0 }, endTime: { hours: 23, minutes: 59 } },
      ],
    });

    // ── Queues ─────────────────────────────────────────────────────
    const chatQueue = new connect.CfnQueue(this, 'ChatGeneralQueue', {
      instanceArn: instance.attrArn,
      name: 'chat-general',
      hoursOfOperationArn: hours247.attrHoursOfOperationArn,
    });

    const phoneQueue = new connect.CfnQueue(this, 'PhoneGeneralQueue', {
      instanceArn: instance.attrArn,
      name: 'phone-general',
      hoursOfOperationArn: hours247.attrHoursOfOperationArn,
    });

    const ownershipQueue = new connect.CfnQueue(this, 'ChangeOwnershipQueue', {
      instanceArn: instance.attrArn,
      name: 'change-of-ownership',
      hoursOfOperationArn: hours247.attrHoursOfOperationArn,
    });

    // ── Security profile ───────────────────────────────────────────
    const agentSecurityProfile = new connect.CfnSecurityProfile(this, 'AgentSecurityProfile', {
      instanceArn: instance.attrArn,
      securityProfileName: 'BobsAgent',
      permissions: [
        'BasicAgentAccess',
        'OutboundCallAccess',
      ],
    });

    // ── Chat routing profile (4 concurrent chats) ──────────────────
    const chatRoutingProfile = new connect.CfnRoutingProfile(this, 'ChatRoutingProfile', {
      instanceArn: instance.attrArn,
      name: 'ChatAgent',
      description: 'Handles up to 4 concurrent chat contacts',
      defaultOutboundQueueArn: chatQueue.attrQueueArn,
      mediaConcurrencies: [
        { channel: 'CHAT', concurrency: 4 },
      ],
      queueConfigs: [
        {
          queueReference: {
            queueArn: chatQueue.attrQueueArn,
            channel: 'CHAT',
          },
          priority: 1,
          delay: 0,
        },
        {
          queueReference: {
            queueArn: ownershipQueue.attrQueueArn,
            channel: 'CHAT',
          },
          priority: 2,
          delay: 0,
        },
      ],
    });

    // ── Phone routing profile (1 voice channel) ────────────────────
    const phoneRoutingProfile = new connect.CfnRoutingProfile(this, 'PhoneRoutingProfile', {
      instanceArn: instance.attrArn,
      name: 'PhoneAgent',
      description: 'Handles inbound and outbound voice calls',
      defaultOutboundQueueArn: phoneQueue.attrQueueArn,
      mediaConcurrencies: [
        { channel: 'VOICE', concurrency: 1 },
      ],
      queueConfigs: [
        {
          queueReference: {
            queueArn: phoneQueue.attrQueueArn,
            channel: 'VOICE',
          },
          priority: 1,
          delay: 0,
        },
      ],
    });

    // ── Agent user ─────────────────────────────────────────────────
    const demoAgent = new connect.CfnUser(this, 'DemoAgent', {
      instanceArn: instance.attrArn,
      username: 'demo-agent',
      password: 'BobsMF2025!',
      identityInfo: {
        firstName: 'Demo',
        lastName: 'Agent',
        email: 'demo@bobsmutualfunds.com',
      },
      phoneConfig: {
        phoneType: 'SOFT_PHONE',
        autoAccept: false,
        afterContactWorkTimeLimit: 30,
      },
      routingProfileArn: chatRoutingProfile.attrRoutingProfileArn,
      securityProfileArns: [agentSecurityProfile.attrSecurityProfileArn],
    });

    // ── Contact flows ──────────────────────────────────────────────
    // Note: The Lex alias ARN placeholder is replaced at deploy time via a token
    const inboundFlowContent = INBOUND_CHAT_FLOW.replace(
      'LEX_ALIAS_ARN_PLACEHOLDER',
      lexBotAliasArn
    );

    const inboundChatFlow = new connect.CfnContactFlow(this, 'InboundChatFlow', {
      instanceArn: instance.attrArn,
      name: 'Bobs-Chat-Inbound',
      type: 'CONTACT_FLOW',
      content: inboundFlowContent,
    });

    const outboundIvrFlow = new connect.CfnContactFlow(this, 'OutboundIvrFlow', {
      instanceArn: instance.attrArn,
      name: 'Bobs-Outbound-IVR',
      type: 'OUTBOUND_WHISPER',
      content: OUTBOUND_IVR_FLOW,
    });

    // ── Claim a US DID phone number ────────────────────────────────
    const phoneNumber = new connect.CfnPhoneNumber(this, 'DID', {
      targetArn: instance.attrArn,
      type: 'DID',
      countryCode: 'US',
    });

    // ── Associate Lex bot with the Connect instance ────────────────
    // (Cannot be done via CfnInstance — requires a custom resource)
    const associateLexBot = new cr.AwsCustomResource(this, 'AssociateLexBot', {
      onCreate: {
        service: 'Connect',
        action: 'associateLexBot',
        parameters: {
          InstanceId: instance.attrId,
          LexV2Bot: {
            AliasArn: lexBotAliasArn,
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('AssociateLexBot'),
      },
      onDelete: {
        service: 'Connect',
        action: 'disassociateLexV2Bot',
        parameters: {
          InstanceId: instance.attrId,
          BotAliasArn: lexBotAliasArn,
          LocaleId: 'en_US',
        },
        physicalResourceId: cr.PhysicalResourceId.of('AssociateLexBot'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({ resources: ['*'] }),
    });
    associateLexBot.node.addDependency(instance);

    // ── Outputs ────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ConnectInstanceId', {
      value: instance.attrId,
      description: 'Connect Instance ID — set as env var in Lambda and agent app',
    });
    new cdk.CfnOutput(this, 'ConnectInstanceArn', { value: instance.attrArn });
    new cdk.CfnOutput(this, 'ConnectInstanceUrl', {
      value: `https://${instance.attrId}.my.connect.aws`,
      description: 'Connect admin URL',
    });
    new cdk.CfnOutput(this, 'CcpUrl', {
      value: `https://${instance.attrId}.my.connect.aws/ccp-v2`,
      description: 'CCP URL — set as VITE_CCP_URL in agent app',
    });
    new cdk.CfnOutput(this, 'InboundChatFlowId', {
      value: inboundChatFlow.attrContactFlowArn,
      description: 'Inbound chat flow ARN',
    });
    new cdk.CfnOutput(this, 'OutboundIvrFlowId', {
      value: outboundIvrFlow.attrContactFlowArn,
      description: 'Outbound IVR flow ARN',
    });
    new cdk.CfnOutput(this, 'ChatQueueId', { value: chatQueue.attrQueueArn });
    new cdk.CfnOutput(this, 'PhoneQueueId', { value: phoneQueue.attrQueueArn });
    new cdk.CfnOutput(this, 'PhoneNumber', {
      value: phoneNumber.attrAddress,
      description: 'Claimed DID number for outbound callbacks',
    });
    new cdk.CfnOutput(this, 'AgentPassword', {
      value: 'BobsMF2025!',
      description: 'Initial password for demo-agent — change after first login',
    });
  }
}
