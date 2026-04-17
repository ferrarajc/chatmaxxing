import * as cdk from 'aws-cdk-lib';
import * as connect from 'aws-cdk-lib/aws-connect';
import { Construct } from 'constructs';

interface ConnectStackProps extends cdk.StackProps {
  startOutboundFnArn: string;
}

export class ConnectStack extends cdk.Stack {
  public readonly instanceArn: string;

  constructor(scope: Construct, id: string, props: ConnectStackProps) {
    super(scope, id, props);

    // ── Connect instance ───────────────────────────────────────────
    const instance = new connect.CfnInstance(this, 'ConnectInstance', {
      identityManagementType: 'CONNECT_MANAGED',
      instanceAlias: 'bobs-mutual-funds',
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
    // Minimal placeholder flows — queue routing is updated post-deploy via Connect console
    // or via aws connect update-contact-flow-content after stack is up
    const inboundFlowContent = JSON.stringify({
      Version: '2019-10-30',
      StartAction: 'End',
      Actions: [{ Identifier: 'End', Type: 'DisconnectParticipant', Parameters: {}, Transitions: {} }],
    });

    const outboundIvrContent = JSON.stringify({
      Version: '2019-10-30',
      StartAction: 'End',
      Actions: [{ Identifier: 'End', Type: 'DisconnectParticipant', Parameters: {}, Transitions: {} }],
    });

    const inboundChatFlow = new connect.CfnContactFlow(this, 'InboundChatFlow', {
      instanceArn: instance.attrArn,
      name: 'Bobs-Chat-Inbound',
      type: 'CONTACT_FLOW',
      content: inboundFlowContent,
    });

    const outboundIvrFlow = new connect.CfnContactFlow(this, 'OutboundIvrFlow', {
      instanceArn: instance.attrArn,
      name: 'Bobs-Outbound-IVR',
      type: 'CONTACT_FLOW',
      content: outboundIvrContent,
    });

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
    new cdk.CfnOutput(this, 'AgentPassword', {
      value: 'BobsMF2025!',
      description: 'Initial password for demo-agent — change after first login',
    });
  }
}
