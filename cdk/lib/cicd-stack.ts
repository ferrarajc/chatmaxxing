import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

// GitHub repo allowed to assume the deploy role (via the 'production' environment).
const GITHUB_REPO = 'ferrarajc/chatmaxxing';
const BOOTSTRAP_QUALIFIER = 'hnb659fds'; // default CDK bootstrap qualifier (see cdk- roles)

/**
 * CI/CD identity for GitHub Actions → AWS, via OIDC (no long-lived keys).
 *
 * Creates the GitHub OIDC provider and a `bobs-github-deploy` role that the
 * `deploy-cdk.yml` workflow assumes (only from the `production` environment, i.e. merges to
 * main). The role is least-privilege: it can only assume the CDK bootstrap roles, which is all
 * `cdk deploy` needs — the bootstrap roles hold the actual deploy permissions.
 */
export class CicdStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const provider = new iam.CfnOIDCProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIdList: ['sts.amazonaws.com'],
      // AWS validates GitHub's OIDC via its own trust store now, but the API still requires a
      // thumbprint list. These are GitHub's well-known thumbprints.
      thumbprintList: [
        '6938fd4d98bab03faadb97b34396831e3780aea1',
        '1c58a3a8518e8759bf075b76b750d4f2df264fcd',
      ],
    });

    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: 'bobs-github-deploy',
      description: 'Assumed by GitHub Actions (main -> production environment) to run cdk deploy.',
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.FederatedPrincipal(
        provider.attrArn,
        {
          StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
          // Only the 'production' GitHub Environment (used by deploy-cdk.yml) can assume this.
          StringLike: { 'token.actions.githubusercontent.com:sub': `repo:${GITHUB_REPO}:environment:production` },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
    });

    // cdk deploy works by assuming the bootstrap roles — grant only that.
    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: [`arn:aws:iam::${this.account}:role/cdk-${BOOTSTRAP_QUALIFIER}-*`],
    }));
    // CDK CLI reads the bootstrap version parameter directly.
    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/cdk-bootstrap/${BOOTSTRAP_QUALIFIER}/version`],
    }));

    new cdk.CfnOutput(this, 'GitHubDeployRoleArn', { value: deployRole.roleArn });
  }
}
