# Bob's Mutual Funds — Setup Guide

## Prerequisites

Install these tools before starting:

```bash
# Node.js 20+
# Download from https://nodejs.org/

# AWS CLI v2
# Download from https://aws.amazon.com/cli/

# AWS CDK
npm install -g aws-cdk

# Verify
node --version   # v20+
aws --version    # aws-cli/2.x
cdk --version    # 2.x
```

---

## Step 1 — Configure AWS credentials

```bash
aws configure
```

Enter when prompted:
- **AWS Access Key ID** — from your AWS IAM user
- **AWS Secret Access Key** — from your AWS IAM user
- **Default region name** — `us-east-1`
- **Default output format** — `json`

Verify it works:
```bash
aws sts get-caller-identity
```

You should see your account ID, user ID, and ARN.

---

## Step 2 — Bootstrap CDK

```bash
# Get your account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

cdk bootstrap aws://$ACCOUNT_ID/us-east-1
```

This only needs to be done once per account/region.

---

## Step 3 — Install dependencies

```bash
# From the repo root (C:\Users\ferra\chatmaxxing)
cd cdk && npm install && cd ..
cd lambda && npm install && cd ..
cd customer-app && npm install && cd ..
cd agent-app && npm install && cd ..
```

---

## Step 4 — Deploy CDK stacks (in order)

```bash
cd cdk

# 1. DynamoDB tables + seed data
npx cdk deploy BobsDataStack

# 2. Lambda functions + API Gateway
npx cdk deploy BobsLambdaStack

# 3. Lex bot
npx cdk deploy BobsLexStack

# 4. Amazon Connect instance (takes ~5 min)
npx cdk deploy BobsConnectStack
```

**Save the outputs** printed at the end of each deploy — you'll need them in Step 6.

Key outputs to note:
- `BobsLambdaStack.ApiUrl` → your API Gateway URL
- `BobsConnectStack.ConnectInstanceId` → your Connect instance ID
- `BobsConnectStack.CcpUrl` → CCP URL for the agent app
- `BobsConnectStack.PhoneNumber` → the DID number claimed for callbacks
- `BobsConnectStack.AgentPassword` → initial agent password

---

## Step 5 — Manual Amazon Connect console steps (~20 min)

These steps cannot be automated via CDK and must be done in the AWS Console.

### 5a. Add GitHub Pages to Approved Origins

1. Go to [Amazon Connect console](https://console.aws.amazon.com/connect)
2. Click your instance → **Approved origins**
3. Add: `https://ferrarajc.github.io`
4. Also add: `http://localhost:5173` and `http://localhost:5174` for local dev

### 5b. Build the Lex bot

1. Go to [Amazon Lex console](https://console.aws.amazon.com/lex)
2. Find `BobsAssistant` → click **Build** → wait for build to complete (~2 min)
3. Verify the alias `live` is active

### 5c. Verify agent user

1. Back in Amazon Connect console → your instance → **Users → User management**
2. Find `demo-agent` → click Edit
3. Verify routing profile is `ChatAgent`
4. Log in to `https://YOUR_INSTANCE_ID.my.connect.aws` with:
   - Username: `demo-agent`
   - Password: (from CDK output, usually `BobsMF2025!`)
5. Change password on first login

### 5d. Update Lambda environment variables

After Connect deploys, update the Lambdas that have `PLACEHOLDER` values:

```bash
# Get values from CDK outputs, then:
aws lambda update-function-configuration \
  --function-name bobs-start-chat \
  --environment "Variables={
    CONNECT_INSTANCE_ID=YOUR_INSTANCE_ID,
    CONNECT_CHAT_FLOW_ID=YOUR_INBOUND_FLOW_ID,
    ...
  }"

# Repeat for bobs-execute-callback (needs CONNECT_INSTANCE_ID, OUTBOUND_FLOW_ID, PHONE_QUEUE_ID)
```

Or update them directly in the Lambda console for the demo.

---

## Step 6 — Configure environment variables

### Customer app

```bash
cp customer-app/.env.example customer-app/.env.local
```

Edit `customer-app/.env.local`:
```
VITE_API_URL=https://YOUR_API_GATEWAY_ID.execute-api.us-east-1.amazonaws.com
VITE_AWS_REGION=us-east-1
VITE_CONNECT_INSTANCE_URL=https://YOUR_INSTANCE_ID.my.connect.aws
```

### Agent app

```bash
cp agent-app/.env.example agent-app/.env.local
```

Edit `agent-app/.env.local`:
```
VITE_API_URL=https://YOUR_API_GATEWAY_ID.execute-api.us-east-1.amazonaws.com
VITE_AWS_REGION=us-east-1
VITE_CCP_URL=https://YOUR_INSTANCE_ID.my.connect.aws/ccp-v2
```

---

## Step 7 — Test locally

```bash
# Terminal 1: customer app
cd customer-app && npm run dev
# → http://localhost:5173

# Terminal 2: agent app
cd agent-app && npm run dev
# → http://localhost:5174
```

**End-to-end test:**
1. Open `http://localhost:5173/chatmaxxing/` (or just `/` with base URL)
2. Click the chat bubble → widget opens with "Hi Alex!"
3. Open `http://localhost:5174/chatmaxxing/agent/` → log in as `demo-agent`
4. Send a message in the customer app → see it appear in the agent desktop

---

## Step 8 — Deploy to GitHub Pages

### Add GitHub Secrets

In your repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|---|---|
| `VITE_API_URL` | Your API Gateway URL |
| `VITE_AWS_REGION` | `us-east-1` |
| `VITE_CONNECT_INSTANCE_URL` | Your Connect instance URL |
| `VITE_CCP_URL` | Your CCP URL |

### Enable GitHub Pages

In repo → **Settings → Pages**:
- Source: **Deploy from a branch**
- Branch: `gh-pages` / `/ (root)`

### Trigger deploy

```bash
git add .
git commit -m "Initial build"
git push origin main
```

GitHub Actions will build and deploy both apps. Check the **Actions** tab for progress.

**Live URLs after deploy:**
- Customer app: `https://ferrarajc.github.io/chatmaxxing/`
- Agent desktop: `https://ferrarajc.github.io/chatmaxxing/agent/`

---

## Cost Summary

| Service | Est. monthly cost |
|---|---|
| Amazon Connect chat (~500 msgs) | $0 (free tier) |
| Amazon Connect DID phone number | ~$0.90 |
| Outbound callback calls | ~$0.20 |
| Amazon Bedrock Nova Micro | ~$0.50 |
| Lambda / DynamoDB / EventBridge | $0 (free tier) |
| GitHub Pages | $0 |
| **Total** | **~$1.60–3/month** |

---

## Troubleshooting

**Chat widget shows "Unable to connect"**
- Check `VITE_API_URL` is set correctly
- Check Lambda logs in CloudWatch for errors
- Ensure the Connect instance ID and flow ID are set in Lambda environment variables

**Agent desktop shows blank 4 columns / no Streams**
- Check `VITE_CCP_URL` is correct
- Ensure `https://ferrarajc.github.io` is in Connect Approved Origins
- Open browser console — look for "amazon-connect-streams" errors

**Callback doesn't fire**
- Check EventBridge Scheduler in AWS console
- Check `bobs-execute-callback` Lambda CloudWatch logs
- Ensure `CONNECT_INSTANCE_ID`, `OUTBOUND_FLOW_ID`, `PHONE_QUEUE_ID` are set

**Lex bot isn't responding**
- Go to Lex console → Build the bot if it shows "Not built"
- Check that the `live` alias points to the latest version
- Check Lambda logs for `bobs-predict-intent`
