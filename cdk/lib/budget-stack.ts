import * as cdk from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import { Construct } from 'constructs';

interface BudgetStackProps extends cdk.StackProps {
  monthlyLimitUsd?: number;
  notifyEmail: string;
}

/**
 * Account-level monthly cost guardrail. Emails the owner at 80% actual and 100% forecasted
 * spend, so a runaway (e.g. a stuck chat loop hammering OpenAI/Bedrock, or unexpected dev
 * usage) is caught immediately. Prod-only — there is one budget per account.
 */
export class BudgetStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BudgetStackProps) {
    super(scope, id, props);

    const limit = props.monthlyLimitUsd ?? 15;
    const sub = [{ subscriptionType: 'EMAIL', address: props.notifyEmail }];

    new budgets.CfnBudget(this, 'MonthlyCostBudget', {
      budget: {
        budgetName: 'bobs-monthly-cost',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: limit, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        {
          notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold: 80, thresholdType: 'PERCENTAGE' },
          subscribers: sub,
        },
        {
          notification: { notificationType: 'FORECASTED', comparisonOperator: 'GREATER_THAN', threshold: 100, thresholdType: 'PERCENTAGE' },
          subscribers: sub,
        },
      ],
    });
  }
}
