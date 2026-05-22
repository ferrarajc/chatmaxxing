import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { invokeNovaMicro, invokeWithTools, parseJsonFromBedrock } from '../shared/bedrock-client';
import { ALL_CLIENT_TOOLS, createToolExecutor } from '../shared/client-tools';
import {
  ChatMessage,
  ClientProfile,
  RmdData,
  formatTranscriptForBedrock,
  summarizeAccounts,
  summarizeIntents,
  jsonResponse,
} from '../shared/types';
import { TASKS, matchTaskByIntent, filterFields } from '../shared/tasks';
import { toZonedTime } from 'date-fns-tz';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo-client';
import { BeneficiaryEntry } from '../shared/beneficiary-defaults';

type AutopilotScope = 'get-intent' | 'researching' | 'callback' | 'idle-check' | 'full-auto' | 'customer-bot';

const ET_ZONE = 'America/New_York';

function nowET(): string {
  const et = toZonedTime(new Date(), ET_ZONE);
  return et.toLocaleString('en-US', {
    timeZone: ET_ZONE,
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return raw;
}

// ── Scope-specific system prompts ──────────────────────────────────────────

const FORBIDDEN_TOPICS = `
FORBIDDEN TOPICS — respond with the scripted text below and set shouldExitAutopilot=true:

1. Financial advice / investment recommendations (e.g. "what should I invest in", "which fund is best", "should I put money in X"):
   response: "I'm not able to provide personalized investment advice via chat. I can connect you with a live agent right now, or schedule a call with one of our financial advisors — which would you prefer?"
   suggestedScope: "callback"

2. Trade execution (e.g. "buy", "sell", "place an order", "redeem", "liquidate"):
   response: "Trades can't be processed through chat. You can place orders directly at bobrsmutualfunds.com/trade. I can also connect you with a live agent now, or schedule a callback with a licensed broker — which works best?"
   suggestedScope: "callback"

3. Fraud / identity theft / unauthorized account activity:
   response: "This sounds serious and I want to make sure we handle it with the urgency it deserves. I'm connecting you with a security specialist right away — they can place a hold on your account and investigate. Please hold."
   shouldExitAutopilot: true

4. Inheriting an account / deceased account holder:
   response: "I'm so sorry for your loss. I can connect you with a live agent right now, or schedule a callback with our inheritance specialist — which would you prefer? You can also find helpful information at bobrsmutualfunds.com/inheritance."
   suggestedScope: "callback"

For any of the above: set shouldExitAutopilot=true. Use the scripted response verbatim (you may adjust minor phrasing to fit context). Do NOT attempt to answer these topics yourself.

FIELD FOLLOW-UP RULE
If you asked about multiple pieces of information in your previous message and the customer only answered some of them, follow up on the unanswered fields before moving on. Never silently drop a required field.

LANGUAGE FOR RESTATING INFORMATION
When echoing back something the customer told you in this conversation, use confirmatory phrasing: "Got it — X will be Y." Reserve "I see X is currently..." for information from the existing account data shown in this system prompt — not for things the customer just said.`;

// ── Task-driven GET INTENT prompt (phase 2: field collection) ──────────────

function buildTaskFieldPrompt(
  profile: ClientProfile,
  taskId: string,
  collectedSoFar: Record<string, string>,
): string {
  const task = TASKS.find(t => t.id === taskId);
  if (!task) return '';

  const accountTypes = profile.accounts.map(a => a.type);
  const fields = filterFields(task, accountTypes, profile.accounts.length, collectedSoFar);

  // Pre-filled values (e.g. accountId when only 1 account exists)
  const preFilled: string[] = [];
  if (task.fields.some(f => f.requiresMultipleAccounts) && profile.accounts.length === 1) {
    preFilled.push(`Account: ${profile.accounts[0].type} (${profile.accounts[0].id})`);
  }

  const fieldList = fields
    .map((f, i) => `${i + 1}. ${f.label}: ${f.question}`)
    .join('\n');

  const preFilledSection = preFilled.length > 0
    ? `\nAlready known from client profile (do NOT ask the client for these):\n${preFilled.map(v => `  • ${v}`).join('\n')}\n`
    : '';

  const proposedActionFieldsSchema = fields
    .map(f => `    { "key": "${f.key}", "label": "${f.label}", "value": "[value the client gave]" }`)
    .join(',\n');

  return `You are a live financial services agent at Bob's Mutual Funds. You are already connected and speaking with ${profile.name} — this is an active, ongoing chat.
Client accounts: ${summarizeAccounts(profile.accounts)}.
${summarizeIntents(profile.intents)}

BEFORE ANYTHING ELSE:
• Do NOT introduce yourself or say your name.
• Do NOT say "connect you with a live agent" or offer to transfer — you ARE the live agent.
• Do NOT ask "is that right?" or confirm their topic — jump straight to the first uncollected field.
• One question per turn. Period.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT FIELD LIST — ONLY THESE, NOTHING ELSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task: ${task.name}

Collect ONLY the fields listed below. Do NOT ask about date of birth, Social Security number, driver's license, or anything else not listed.
${preFilledSection}
Fields to collect:
${fieldList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT COUNTS AS A SPECIFIC VALUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A field is filled ONLY when the client gives a concrete, specific answer:
• Person's name: "my wife", "she", "her", "my husband" → NOT a name. Ask for the actual full name.
• Email: must be an actual email address (e.g. sarah@gmail.com).
• "yes", "yep", "sure", "correct", "okay" → does NOT fill any field.
• Access level choices, specific dollar amounts, specific options → these count.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ONE QUESTION PER TURN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ask for exactly ONE field. Never combine. Never say "and also" or "I'll also need." Stop after one question.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO PROCEED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Read the full transcript. For each field in the list, check whether the client gave a SPECIFIC value (see above).

• If any field is still missing: briefly confirm the last answer if one was just given ("Got it — [value]."), then ask for the next uncollected field.
• When ALL fields have specific values: set shouldExitAutopilot=true, populate proposedAction, and write a response that summarizes every collected value in plain English so the client can see exactly what is about to be submitted. Example: "Just to confirm: [name] at [X]% as primary beneficiary on your [account type]. I'm getting that ready now." Do NOT use a generic phrase like "I have everything I need" or "I'll get that ready for you."

⚠️ When shouldExitAutopilot=true, proposedAction MUST be populated. Never exit with proposedAction=null.
${FORBIDDEN_TOPICS}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY valid JSON — no other text:
{
  "response": "...",
  "collectedFields": {
    "fieldKey": "specific value the client gave, or null if not yet answered"
  },
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When ALL fields are collected, replace proposedAction with:
{
  "taskId": "${task.id}",
  "taskName": "${task.name}",
  "summary": "one clear sentence describing exactly what the client wants done",
  "fields": [
${proposedActionFieldsSchema}
  ]
}`;
}

// ── Per-process expert prompts ─────────────────────────────────────────────

const ADD_ACCOUNT_ACCESS_PROMPT = (profile: ClientProfile) =>
  `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
Client accounts: ${summarizeAccounts(profile.accounts)}.
${summarizeIntents(profile.intents)}

You are handling an ADD AUTHORIZED USER request. The client wants to grant another person access to their account.

════════════════════════════════════
WHAT YOU NEED TO COLLECT — all three
════════════════════════════════════

FULL NAME of the person being added
  A real name like "Sarah Johnson". Vague references like "my wife", "she", "her" are not names — ask for the actual name.

EMAIL ADDRESS of the person being added
  Required to set up their account login. Must be a real email address.

ACCESS LEVEL — one of:
  • Full access — can view balances, place trades, and manage the account
  • View only — read-only, can see the account but cannot make changes

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself or say your name.
Collect the three pieces of information naturally — in any order that fits the conversation.
If the client volunteers a piece of information before you ask, capture it and move on.
Ask one thing at a time. If an answer is vague, ask for the specific detail.
Read the full transcript — do not re-ask for something the client already provided.

When you have all three with specific, confirmed values:
→ Set shouldExitAutopilot=true
→ Populate proposedAction with all three values
→ Briefly tell the client you have everything needed

${FORBIDDEN_TOPICS}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When all three are collected, set shouldExitAutopilot=true and replace proposedAction:
{
  "taskId": "add-account-access",
  "taskName": "Add Authorized Account User",
  "summary": "Grant [name] ([email]) [access level] access to ${profile.name}'s account",
  "fields": [
    {"key": "personName",  "label": "Person's full name",    "value": "[the name provided]"},
    {"key": "personEmail", "label": "Email address",          "value": "[the email provided]"},
    {"key": "accessLevel", "label": "Access level",           "value": "[Full access or View only]"}
  ]
}

⚠ Never set shouldExitAutopilot=true unless proposedAction is fully populated with all three values.`;

// Variant for transaction tasks — trade execution is permitted in this context
const FORBIDDEN_TOPICS_NO_TRADES = `
FORBIDDEN TOPICS — respond with the scripted text below and set shouldExitAutopilot=true:

1. Financial advice / investment recommendations (e.g. "what should I invest in", "which fund is best"):
   response: "I'm not able to provide personalized investment advice via chat. I can connect you with a live agent right now, or schedule a call with one of our financial advisors — which would you prefer?"
   suggestedScope: "callback"

2. Fraud / identity theft / unauthorized account activity:
   response: "This sounds serious and I want to make sure we handle it with the urgency it deserves. I'm connecting you with a security specialist right away — please hold."
   shouldExitAutopilot: true

3. Inheriting an account / deceased account holder:
   response: "I'm so sorry for your loss. Our inheritance team can guide you through the process. Would you like me to schedule a callback with a specialist?"
   suggestedScope: "callback"

For any of the above: set shouldExitAutopilot=true. Use the scripted response verbatim.

FIELD FOLLOW-UP RULE
If you asked about multiple pieces of information in your previous message and the customer only answered some of them, follow up on the unanswered fields before moving on. Never silently drop a required field.

LANGUAGE FOR RESTATING INFORMATION
When echoing back something the customer told you in this conversation, use confirmatory phrasing: "Got it — X will be Y." Reserve "I see X is currently..." for information from the existing account data shown in this system prompt — not for things the customer just said.`;

const UPDATE_CONTACT_INFO_PROMPT = (profile: ClientProfile) =>
  `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
${summarizeIntents(profile.intents)}

You are handling an UPDATE CONTACT INFORMATION request.

════════════════════════════════════
WHAT YOU NEED TO COLLECT — both
════════════════════════════════════

WHAT TO UPDATE — one of:
  • Phone number
  • Email address
  • Mailing address

NEW VALUE — the specific replacement:
  • Phone number: a valid 10-digit US phone number
  • Email address: a complete email address (e.g. john@gmail.com)
  • Mailing address: full address with street, city, state, and ZIP

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Ask one thing at a time. If the client volunteered both pieces in their opening message, capture them and confirm.
Read the full transcript — do not re-ask for something already provided.

When you have both values:
→ Set shouldExitAutopilot=true
→ Populate proposedAction
→ Briefly confirm what will be updated

${FORBIDDEN_TOPICS}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When both fields are collected:
{
  "taskId": "update-contact-info",
  "taskName": "Update Contact Information",
  "summary": "Update ${profile.name}'s [infoType] to [newValue]",
  "fields": [
    {"key": "infoType",  "label": "What to update", "value": "[Phone number / Email address / Mailing address]"},
    {"key": "newValue",  "label": "New value",       "value": "[the new value provided]"}
  ]
}

⚠ Never set shouldExitAutopilot=true unless proposedAction is fully populated with both values.`;

async function fetchBeneficiaries(clientId: string): Promise<BeneficiaryEntry[]> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: process.env.CLIENTS_TABLE!,
      Key: { clientId },
      ProjectionExpression: 'beneficiaries',
    }));
    return (result.Item?.beneficiaries as BeneficiaryEntry[] | undefined) ?? [];
  } catch {
    return [];
  }
}

async function fetchRmdSettings(clientId: string): Promise<RmdData> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: process.env.CLIENTS_TABLE!,
      Key: { clientId },
      ProjectionExpression: 'rmd',
    }));
    return (result.Item?.rmd as RmdData | undefined) ?? { eligible: false };
  } catch {
    return { eligible: false };
  }
}

function formatCurrentBeneficiaries(bens: BeneficiaryEntry[], accountId: string): string {
  const acctBens = bens.filter(b => b.accountId === accountId);
  if (acctBens.length === 0) return 'No beneficiaries currently on file for this account.';
  return acctBens
    .map(b => `  • ${b.name} — ${b.relationship}, ${b.percentage}% (${b.type})`)
    .join('\n');
}

const UPDATE_BENEFICIARIES_PROMPT = (profile: ClientProfile, currentBeneficiaries: BeneficiaryEntry[]) => {
  const iraAccounts = profile.accounts.filter(a =>
    a.type.toLowerCase().includes('ira') || a.type.toLowerCase().includes('sep'),
  );
  const multiIra = iraAccounts.length > 1;

  const accountList = iraAccounts.map(a => {
    const bens = formatCurrentBeneficiaries(currentBeneficiaries, a.id);
    return `  ${a.type} (${a.id}):\n${bens}`;
  }).join('\n\n');

  const accountSection = multiIra
    ? `ACCOUNT — which IRA account to update\n  Client has multiple IRA accounts:\n${accountList}\n\n  Ask which account they want to update.\n\n`
    : `Account: ${iraAccounts[0]?.type ?? 'IRA'} (${iraAccounts[0]?.id ?? 'on file'}) — pre-selected, do NOT ask for it.\n\nCurrent beneficiaries:\n${formatCurrentBeneficiaries(currentBeneficiaries, iraAccounts[0]?.id ?? '')}\n\n`;

  // Build the single-account example for the completion template
  const exampleAccountId = iraAccounts[0]?.id ?? 'acc-001';

  return `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
Client accounts: ${summarizeAccounts(iraAccounts)}.
${summarizeIntents(profile.intents)}

You are handling a CHANGE BENEFICIARY DESIGNATIONS request.

════════════════════════════════════
CURRENT STATE
════════════════════════════════════

${accountSection}
════════════════════════════════════
UNDERSTANDING THE REQUEST
════════════════════════════════════

Beneficiary changes take many forms. Read the transcript and determine what the client wants:
- ADD: they want to add one or more new beneficiaries who are not currently listed
- REMOVE: they want to remove one or more existing beneficiaries
- UPDATE: they want to change the name, relationship, percentage, or type for an existing beneficiary
- REPLACE ALL: they want a completely fresh set of beneficiaries (e.g. "I want to change everything")
- COMBINED: add some and remove others in the same conversation

Do NOT force the client to name one action type. Work naturally and figure out what they want.

COMPLETE FINAL STATE RULE: You always represent every beneficiary that will be on the account after the change — including existing ones that aren't being touched.
- ADD: existing beneficiaries stay. Final list = existing (retained) + new ones.
- REMOVE: final list = existing minus the removed ones.
- UPDATE: final list = existing with the updated details.
- REPLACE ALL: discard all existing and start fresh.
Never silently drop an existing beneficiary unless the client explicitly asks to remove them.

EXISTING BENEFICIARY ACKNOWLEDGMENT RULE: When ADDING new beneficiaries to an account that already has beneficiaries listed, you MUST acknowledge the existing beneficiaries to the client before collecting allocation percentages for the new ones. Say something like: "I see [name] is currently your primary beneficiary at [X]%. What would you like their allocation to be once we add the new beneficiaries?" Do not skip this step even if the new beneficiaries the client proposes sum to 100% on their own — that would mean removing the existing beneficiary, which requires explicit confirmation.

ALLOCATION RULE: All primary beneficiaries on an account must sum to exactly 100%.
Apply this rule to the COMPLETE FINAL LIST — existing retained beneficiaries plus new ones. Never check only the new beneficiaries in isolation.
- If new beneficiaries alone sum to 100%, that implicitly zeros out every existing beneficiary. You MUST flag this: "Adding [names] at [X%] each totals 100%, which would effectively remove [existing name] from the account. Is that what you want, or would you like to adjust the percentages so [existing name] stays on?"
- Do not exit until the math for the full final list works out.
- Example: Alice is at 100% and client wants to add Bob and Carol at 50% each. Bob+Carol=100% — you must ask: "That would leave Alice with 0%, effectively removing her. Should I remove Alice, or would you like to give her a percentage too?"

════════════════════════════════════
WHAT TO COLLECT
════════════════════════════════════

For each beneficiary in the FINAL desired state of the account:
- FULL LEGAL NAME (e.g. "Maria Rodriguez" — not "my daughter" or "her")
- RELATIONSHIP to client (spouse, child, parent, sibling, trust, estate, etc.)
- ALLOCATION PERCENTAGE (0–100; "all of it" = 100%; all primary beneficiaries must sum to 100%)
- TYPE: Primary or Secondary
  • Primary: receives assets if account holder passes
  • Secondary: backup — only receives if all primary beneficiaries predecease the holder

You do NOT need to ask about beneficiaries the client is removing — just don't include them in the final list.

If the client is only removing everyone: confirm the account they want cleared and exit with an empty list.

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Use the CURRENT STATE shown above — do not re-read or mention the database. Just work naturally.
Ask ONE question per turn. ONE question only — never list multiple questions or ask about multiple fields in the same message.
On the first turn: ask what change they want to make (add / remove / update a beneficiary), or which account if multiple IRAs.
Read the full transcript — do not re-ask for something the client already provided.

When you have the complete final intended beneficiary list for the account:
→ Set shouldExitAutopilot=true and populate proposedAction using numbered fields ben_1_*, ben_2_*, etc.

${FORBIDDEN_TOPICS}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When all beneficiaries are confirmed, return this EXACT structure with the complete final list.
Use ben_1_*, ben_2_*, ben_3_* for each beneficiary. Omit higher numbers if not applicable:
{
  "response": "Got it — I have everything I need. Let me prepare that for you.",
  "shouldExitAutopilot": true,
  "taskIdentified": null,
  "proposedAction": {
    "taskId": "update-beneficiaries",
    "taskName": "Change Beneficiary Designations",
    "summary": "Update beneficiaries on ${profile.name}'s ${iraAccounts[0]?.type ?? 'IRA'} to [brief description]",
    "fields": [
      {"key": "accountId",       "label": "Account",                    "value": "${exampleAccountId}"},
      {"key": "ben_1_name",      "label": "Beneficiary 1 name",         "value": "[full legal name]"},
      {"key": "ben_1_relationship","label": "Beneficiary 1 relationship","value": "[relationship]"},
      {"key": "ben_1_percentage","label": "Beneficiary 1 percentage",   "value": "[0–100]"},
      {"key": "ben_1_type",      "label": "Beneficiary 1 type",         "value": "Primary"},
      {"key": "ben_2_name",      "label": "Beneficiary 2 name",         "value": "[full legal name — only if a 2nd beneficiary]"},
      {"key": "ben_2_relationship","label": "Beneficiary 2 relationship","value": "[relationship — only if a 2nd beneficiary]"},
      {"key": "ben_2_percentage","label": "Beneficiary 2 percentage",   "value": "[0–100 — only if a 2nd beneficiary]"},
      {"key": "ben_2_type",      "label": "Beneficiary 2 type",         "value": "Secondary"}
    ]
  }
}

If the client wants NO beneficiaries on the account, use an empty fields array (only accountId):
{
  "proposedAction": {
    "taskId": "update-beneficiaries",
    "taskName": "Change Beneficiary Designations",
    "summary": "Remove all beneficiaries from ${profile.name}'s ${iraAccounts[0]?.type ?? 'IRA'}",
    "fields": [
      {"key": "accountId", "label": "Account", "value": "${exampleAccountId}"}
    ]
  }
}

⚠ KEY NAMES: Use "ben_1_name", "ben_1_relationship", "ben_1_percentage", "ben_1_type" — not any other spelling.
⚠ TYPE VALUES: Use "Primary" or "Secondary" — not "Contingent".
⚠ Never set shouldExitAutopilot=true unless proposedAction is fully populated.
⚠ OUTPUT FORMAT: Your ENTIRE response must be a single JSON object. No plain text. No "AGENT:" prefix. Put your question or message in the "response" field of the JSON.`;
};

const OPEN_ACCOUNT_PROMPT = (profile: ClientProfile) =>
  `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
Existing accounts: ${summarizeAccounts(profile.accounts)}.
${summarizeIntents(profile.intents)}

You are handling an OPEN A NEW ACCOUNT request.

════════════════════════════════════
WHAT YOU NEED TO COLLECT — all three
════════════════════════════════════

ACCOUNT TYPE — one of:
  • Roth IRA — contributions are post-tax; withdrawals in retirement are tax-free
  • Traditional IRA — contributions may be tax-deductible; withdrawals are taxed
  • SEP-IRA — for self-employed individuals and small business owners
  • Taxable — individual brokerage account with no contribution limits

INITIAL CONTRIBUTION AMOUNT
  How much the client wants to deposit to open the account.
  Minimum is $0 — they can add funds later. Accept "nothing right now" as $0.

FUNDING SOURCE — one of:
  • Bank transfer (ACH) — from their linked bank account
  • Check — they'll mail a check
  • Rollover — transferring from another institution

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Collect the three pieces naturally in any order. Ask ONE question per turn.
Read the full transcript — do not re-ask for something already provided.

When you have all three:
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When all three fields are confirmed, return this EXACT structure with proposedAction nested inside (copy the key names exactly):
{
  "response": "Got it — I have everything I need. Let me prepare that for you.",
  "shouldExitAutopilot": true,
  "taskIdentified": null,
  "proposedAction": {
    "taskId": "open-account",
    "taskName": "Open a New Account",
    "summary": "Open a new [accountType] for ${profile.name} with $[amount] funded via [source]",
    "fields": [
      {"key": "accountType",    "label": "Account type",          "value": "[Roth IRA / Traditional IRA / SEP-IRA / Taxable]"},
      {"key": "initialAmount",  "label": "Initial contribution",  "value": "[dollar amount, e.g. $5,000]"},
      {"key": "fundingSource",  "label": "Funding source",        "value": "[Bank transfer (ACH) / Check / Rollover]"}
    ]
  }
}

⚠ Never set shouldExitAutopilot=true unless all three fields are present in proposedAction.`;

const PLACE_PURCHASE_PROMPT = (profile: ClientProfile) => {
  const multiAccount = profile.accounts.length > 1;
  const accountSection = multiAccount
    ? `ACCOUNT — which account to purchase into\n  Options: ${profile.accounts.map(a => `${a.type} (${a.id})`).join(', ')}\n\n`
    : `(Account pre-selected: ${profile.accounts[0]?.type ?? 'on file'} — do NOT ask for it.)\n\n`;

  return `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
Client accounts: ${summarizeAccounts(profile.accounts)}.
${summarizeIntents(profile.intents)}

You are handling a BUY / MAKE A CONTRIBUTION request.

════════════════════════════════════
WHAT YOU NEED TO COLLECT
════════════════════════════════════

${accountSection}FUND — one of: BF500 (500 Index), BFGR (Growth), BFBI (Bond Income), BFIN (International), BFESG (ESG Leaders), BFST (Short-Term Bond)
  If the client uses a partial name (e.g. "the growth fund"), map it to the correct ticker.

PURCHASE AMOUNT — a specific dollar amount (e.g. "$5,000")

FUNDING SOURCE — one of:
  • Linked bank account — debited from their bank on file
  • Cash in account — from cash already sitting in the account

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Collect naturally in any order. Ask ONE question per turn.
Read the full transcript — do not re-ask for something already provided.

When all fields are collected:
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS_NO_TRADES}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When complete:
{
  "taskId": "place-purchase",
  "taskName": "Buy / Make a Contribution",
  "summary": "Purchase $[amount] of [fund] in ${profile.name}'s [account] funded via [source]",
  "fields": [
    {"key": "accountId",      "label": "Account",          "value": "[account id or type]"},
    {"key": "fund",           "label": "Fund",             "value": "[ticker symbol]"},
    {"key": "amount",         "label": "Purchase amount",  "value": "[dollar amount]"},
    {"key": "fundingSource",  "label": "Funding source",   "value": "[Linked bank account / Cash in account]"}
  ]
}

⚠ Never set shouldExitAutopilot=true unless proposedAction is fully populated.`;
};

const PLACE_SALE_PROMPT = (profile: ClientProfile) => {
  const multiAccount = profile.accounts.length > 1;
  const accountSection = multiAccount
    ? `ACCOUNT — which account to sell from\n  Options: ${profile.accounts.map(a => `${a.type} (${a.id})`).join(', ')}\n\n`
    : `(Account pre-selected: ${profile.accounts[0]?.type ?? 'on file'} — do NOT ask for it.)\n\n`;

  return `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
Client accounts: ${summarizeAccounts(profile.accounts)}.
${summarizeIntents(profile.intents)}

You are handling a SELL FUND SHARES request.

════════════════════════════════════
WHAT YOU NEED TO COLLECT
════════════════════════════════════

${accountSection}FUND TO SELL — one of: BF500, BFGR, BFBI, BFIN, BFESG, BFST
  Map partial names to the correct ticker.

AMOUNT — one of:
  • A specific dollar amount (e.g. "$10,000")
  • "Full redemption" or "all shares" (sell everything in that fund)

REASON FOR SALE — one of: Withdrawal, Fund exchange, Rebalancing, Other

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Collect naturally in any order. Ask ONE question per turn.
Read the full transcript — do not re-ask for something already provided.

When all fields are collected:
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS_NO_TRADES}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When all fields are confirmed, return this EXACT structure with proposedAction nested inside (copy the key names exactly):
{
  "response": "Got it — I have everything I need. Let me prepare that for you.",
  "shouldExitAutopilot": true,
  "taskIdentified": null,
  "proposedAction": {
    "taskId": "place-sale",
    "taskName": "Sell Fund Shares",
    "summary": "Sell [amount] of [fund] from ${profile.name}'s [account] for [reason]",
    "fields": [
      {"key": "accountId",  "label": "Account",           "value": "[account id or type — omit if pre-selected]"},
      {"key": "fund",       "label": "Fund to sell",      "value": "[ticker symbol, e.g. BF500]"},
      {"key": "amount",     "label": "Amount or shares",  "value": "[dollar amount or Full redemption]"},
      {"key": "reason",     "label": "Reason for sale",   "value": "[Withdrawal / Fund exchange / Rebalancing / Other]"}
    ]
  }
}

⚠ Never set shouldExitAutopilot=true unless all four fields are present in proposedAction.`;
};

const EXCHANGE_FUNDS_PROMPT = (profile: ClientProfile) => {
  const multiAccount = profile.accounts.length > 1;
  const accountSection = multiAccount
    ? `ACCOUNT — which account to exchange within\n  Options: ${profile.accounts.map(a => `${a.type} (${a.id})`).join(', ')}\n\n`
    : `(Account pre-selected: ${profile.accounts[0]?.type ?? 'on file'} — do NOT ask for it.)\n\n`;

  return `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
Client accounts: ${summarizeAccounts(profile.accounts)}.
${summarizeIntents(profile.intents)}

You are handling an EXCHANGE BETWEEN FUNDS request.

════════════════════════════════════
WHAT YOU NEED TO COLLECT
════════════════════════════════════

${accountSection}FUND TO EXCHANGE OUT OF — one of: BF500, BFGR, BFBI, BFIN, BFESG, BFST
  The source fund (money moves out of this fund).

FUND TO EXCHANGE INTO — one of: BF500, BFGR, BFBI, BFIN, BFESG, BFST
  The destination fund (money moves into this fund). Must be different from the source.

AMOUNT TO EXCHANGE — one of:
  • A specific dollar amount
  • "Full balance" or "everything in that fund"

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Collect naturally in any order. Ask ONE question per turn.
Read the full transcript — do not re-ask for something already provided.

If the source and destination fund are the same, point this out and ask for clarification.

When all fields are collected:
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS_NO_TRADES}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When all fields are confirmed, return this EXACT structure with proposedAction nested inside (copy the key names exactly):
{
  "response": "Got it — I have everything I need. Let me prepare that for you.",
  "shouldExitAutopilot": true,
  "taskIdentified": null,
  "proposedAction": {
    "taskId": "exchange-funds",
    "taskName": "Exchange Between Funds",
    "summary": "Exchange [amount] from [fromFund] to [toFund] in ${profile.name}'s [account]",
    "fields": [
      {"key": "accountId",  "label": "Account",                    "value": "[account id or type — omit if pre-selected]"},
      {"key": "fromFund",   "label": "Fund to exchange out of",    "value": "[ticker symbol, e.g. BF500]"},
      {"key": "toFund",     "label": "Fund to exchange into",      "value": "[ticker symbol, e.g. BFBI]"},
      {"key": "amount",     "label": "Amount to exchange",         "value": "[dollar amount or Full balance]"}
    ]
  }
}

⚠ Never set shouldExitAutopilot=true unless all four fields are present in proposedAction.`;
};

const TOGGLE_DRIP_PROMPT = (profile: ClientProfile) => {
  const multiAccount = profile.accounts.length > 1;
  const accountSection = multiAccount
    ? `ACCOUNT — which account to change dividend settings for\n  Options: ${profile.accounts.map(a => `${a.type} (${a.id})`).join(', ')}\n\n`
    : `(Account pre-selected: ${profile.accounts[0]?.type ?? 'on file'} — do NOT ask for it.)\n\n`;

  return `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
Client accounts: ${summarizeAccounts(profile.accounts)}.
${summarizeIntents(profile.intents)}

You are handling a CHANGE DIVIDEND REINVESTMENT (DRIP) request.

════════════════════════════════════
WHAT YOU NEED TO COLLECT
════════════════════════════════════

${accountSection}FUND — one of: BF500, BFGR, BFBI, BFIN, BFESG, BFST
  Which fund to change the dividend setting for.

TURN ON OR OFF — one of:
  • Turn ON (reinvest) — dividends are automatically used to buy more shares
  • Turn OFF (receive as cash) — dividends are paid out as cash to the account

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Collect naturally in any order. Ask ONE question per turn.
Read the full transcript — do not re-ask for something already provided.

When all fields are collected:
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When complete:
{
  "taskId": "toggle-drip",
  "taskName": "Change Dividend Reinvestment (DRIP)",
  "summary": "[Enable/Disable] dividend reinvestment for [fund] in ${profile.name}'s [account]",
  "fields": [
    {"key": "accountId",    "label": "Account",            "value": "[account id or type]"},
    {"key": "fund",         "label": "Fund",               "value": "[ticker symbol]"},
    {"key": "dripEnabled",  "label": "Enable or disable",  "value": "[Turn ON (reinvest) / Turn OFF (receive as cash)]"}
  ]
}

⚠ Never set shouldExitAutopilot=true unless proposedAction is fully populated.`;
};

const SETUP_AUTO_INVEST_PROMPT = (profile: ClientProfile) => {
  const multiAccount = profile.accounts.length > 1;
  const accountSection = multiAccount
    ? `ACCOUNT — which account to set up auto-investing in\n  Options: ${profile.accounts.map(a => `${a.type} (${a.id})`).join(', ')}\n\n`
    : `(Account pre-selected: ${profile.accounts[0]?.type ?? 'on file'} — do NOT ask for it.)\n\n`;

  return `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
Client accounts: ${summarizeAccounts(profile.accounts)}.
${summarizeIntents(profile.intents)}

You are handling a SET UP AUTOMATIC INVESTMENT request.

════════════════════════════════════
WHAT YOU NEED TO COLLECT — all five
════════════════════════════════════

${accountSection}FUND — one of: BF500 (500 Index), BFGR (Growth), BFBI (Bond Income), BFIN (International), BFESG (ESG Leaders), BFST (Short-Term Bond)

INVESTMENT AMOUNT — a specific dollar amount per period (e.g. "$200")

FREQUENCY — one of: Monthly or Quarterly

DAY OF MONTH — the calendar day to process the investment (1–28)
  If client says "the 1st", "the 15th", etc., map to the number.
  Only accept 1–28 (never 29, 30, or 31 — not all months have those days).

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Collect naturally in any order. Ask ONE question per turn.
Read the full transcript — do not re-ask for something already provided.

When all five fields are collected:
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS_NO_TRADES}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When all fields are confirmed, return this EXACT structure with proposedAction nested inside (copy the key names exactly):
{
  "response": "Got it — I have everything I need. Let me prepare that for you.",
  "shouldExitAutopilot": true,
  "taskIdentified": null,
  "proposedAction": {
    "taskId": "setup-auto-invest",
    "taskName": "Set Up Automatic Investment",
    "summary": "Invest $[amount] [frequency] on the [day] into [fund] in ${profile.name}'s [account]",
    "fields": [
      {"key": "accountId",   "label": "Account",             "value": "[account id or type — omit if pre-selected]"},
      {"key": "fund",        "label": "Fund",                "value": "[ticker symbol, e.g. BF500]"},
      {"key": "amount",      "label": "Investment amount",   "value": "[dollar amount, e.g. $200]"},
      {"key": "frequency",   "label": "Frequency",           "value": "[Monthly / Quarterly]"},
      {"key": "dayOfMonth",  "label": "Day of month",        "value": "[number 1–28, e.g. 15]"}
    ]
  }
}

⚠ Never set shouldExitAutopilot=true unless all five fields are present in proposedAction.`;
};

const UPDATE_AUTO_INVEST_PROMPT = (profile: ClientProfile) =>
  `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
Client accounts: ${summarizeAccounts(profile.accounts)}.
${summarizeIntents(profile.intents)}

You are handling a MODIFY AUTO-INVEST SCHEDULE request.

════════════════════════════════════
WHAT YOU NEED TO COLLECT
════════════════════════════════════

WHICH SCHEDULE — help the client identify which automatic investment they want to change.
  Ask them to describe it (e.g. "the monthly $200 into BF500 in my Roth IRA"). Accept a description, not an ID.

NEW AMOUNT — the new dollar amount per period
  If the client says "keep it the same", record "unchanged".

NEW FREQUENCY — Monthly, Quarterly, or "keep the same"

NEW DAY OF MONTH — a number from 1–28, or "keep the same"

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Collect naturally in any order. Ask ONE question per turn.
Read the full transcript — do not re-ask for something already provided.

When all four fields have answers:
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS_NO_TRADES}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When all four fields have answers, return this EXACT structure with proposedAction nested inside (copy the key names exactly):
{
  "response": "Got it — I have everything I need. Let me prepare that for you.",
  "shouldExitAutopilot": true,
  "taskIdentified": null,
  "proposedAction": {
    "taskId": "update-auto-invest",
    "taskName": "Modify Auto-Invest Schedule",
    "summary": "Update ${profile.name}'s auto-invest: [description of change]",
    "fields": [
      {"key": "scheduleDescription",  "label": "Which schedule",        "value": "[client's description, e.g. monthly $200 into BF500]"},
      {"key": "amount",               "label": "New investment amount",  "value": "[dollar amount or unchanged]"},
      {"key": "frequency",            "label": "New frequency",          "value": "[Monthly / Quarterly / Keep the same]"},
      {"key": "dayOfMonth",           "label": "Day of month",           "value": "[number 1–28 or keep the same]"}
    ]
  }
}

⚠ Never set shouldExitAutopilot=true unless all four fields are present in proposedAction.`;

const PAUSE_AUTO_INVEST_PROMPT = (profile: ClientProfile) =>
  `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
Client accounts: ${summarizeAccounts(profile.accounts)}.
${summarizeIntents(profile.intents)}

You are handling a PAUSE OR RESUME AUTO-INVEST request.

════════════════════════════════════
WHAT YOU NEED TO COLLECT — both
════════════════════════════════════

WHICH SCHEDULE — help the client identify which automatic investment they mean.
  Ask them to describe it (e.g. "the monthly $500 into BF500 in my Roth IRA").

PAUSE OR RESUME — one of:
  • Pause — stop the schedule temporarily (it remains set up, just inactive)
  • Resume — restart a paused schedule

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Collect naturally in any order. Ask ONE question per turn.
Read the full transcript — do not re-ask for something already provided.

When both fields are collected:
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When both fields are confirmed, return this EXACT structure with proposedAction nested inside (copy the key names exactly):
{
  "response": "Got it — I have everything I need. Let me prepare that for you.",
  "shouldExitAutopilot": true,
  "taskIdentified": null,
  "proposedAction": {
    "taskId": "pause-auto-invest",
    "taskName": "Pause or Resume Auto-Invest",
    "summary": "[Pause / Resume] ${profile.name}'s auto-invest: [schedule description]",
    "fields": [
      {"key": "scheduleDescription",  "label": "Which schedule",    "value": "[client's description, e.g. monthly $200 into BF500]"},
      {"key": "action",               "label": "Pause or resume",   "value": "[Pause / Resume]"}
    ]
  }
}

⚠ Never set shouldExitAutopilot=true unless both fields are present in proposedAction.`;

const REQUEST_WITHDRAWAL_PROMPT = (profile: ClientProfile) => {
  const multiAccount = profile.accounts.length > 1;
  const accountSection = multiAccount
    ? `ACCOUNT — which account to withdraw from\n  Options: ${profile.accounts.map(a => `${a.type} (${a.id})`).join(', ')}\n\n`
    : `(Account pre-selected: ${profile.accounts[0]?.type ?? 'on file'} — do NOT ask for it.)\n\n`;

  const needsWithholding = profile.accounts.some(a => ['Traditional IRA', 'SEP-IRA'].includes(a.type));
  const withholdingSection = needsWithholding
    ? `TAX WITHHOLDING — for distributions from Traditional IRA or SEP-IRA only
  Ask: "Would you like us to withhold federal income tax from this distribution? If yes, what percentage? (Standard is 10%.)"
  Accept: "no withholding", "0%", a specific percentage like "10%" or "20%"
  For Roth IRA accounts: do NOT ask about tax withholding — it does not apply.\n\n`
    : '';

  return `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
Client accounts: ${summarizeAccounts(profile.accounts)}.
${summarizeIntents(profile.intents)}

You are handling a REQUEST A DISTRIBUTION request.

════════════════════════════════════
WHAT YOU NEED TO COLLECT
════════════════════════════════════

${accountSection}WITHDRAWAL AMOUNT — a specific dollar amount, or "full balance"

DELIVERY METHOD — one of:
  • Direct deposit (ACH) — sent to their bank account on file
  • Check by mail — mailed to their address on file

${withholdingSection}════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Collect naturally in any order. Ask ONE question per turn.
Read the full transcript — do not re-ask for something already provided.

When all required fields are collected:
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When all required fields are confirmed, return this EXACT structure with proposedAction nested inside (copy the key names exactly):
{
  "response": "Got it — I have everything I need. Let me prepare that for you.",
  "shouldExitAutopilot": true,
  "taskIdentified": null,
  "proposedAction": {
    "taskId": "request-withdrawal",
    "taskName": "Request a Distribution",
    "summary": "Withdraw [amount] from ${profile.name}'s [account] via [deliveryMethod]",
    "fields": [
      {"key": "accountId",       "label": "Account",                  "value": "[account id or type — omit if pre-selected]"},
      {"key": "amount",          "label": "Amount",                   "value": "[dollar amount or Full balance]"},
      {"key": "deliveryMethod",  "label": "Delivery method",          "value": "[Direct deposit (ACH) / Check by mail]"},
      {"key": "taxWithholding",  "label": "Federal tax withholding",  "value": "[percentage, e.g. 10% — omit this field entirely for Roth IRA]"}
    ]
  }
}

⚠ Never set shouldExitAutopilot=true unless all required fields are present in proposedAction.`;
};

const SETUP_SYSTEMATIC_WITHDRAWAL_PROMPT = (profile: ClientProfile) => {
  const multiAccount = profile.accounts.length > 1;
  const accountSection = multiAccount
    ? `ACCOUNT — which account to set up recurring withdrawals from\n  Options: ${profile.accounts.map(a => `${a.type} (${a.id})`).join(', ')}\n\n`
    : `(Account pre-selected: ${profile.accounts[0]?.type ?? 'on file'} — do NOT ask for it.)\n\n`;

  return `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
Client accounts: ${summarizeAccounts(profile.accounts)}.
${summarizeIntents(profile.intents)}

You are handling a SET UP RECURRING DISTRIBUTIONS request.

════════════════════════════════════
WHAT YOU NEED TO COLLECT — all five
════════════════════════════════════

${accountSection}AMOUNT PER PERIOD — a specific dollar amount (e.g. "$500 per month")

FREQUENCY — one of: Monthly, Quarterly, Annually

START DATE — when the first withdrawal should occur
  Accept natural phrasing like "next month", "June 1st", "the 15th of each month starting July"
  Convert to a clear date.

DELIVERY METHOD — one of:
  • Direct deposit (ACH) — sent to bank account on file
  • Check by mail — mailed to address on file

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Collect naturally in any order. Ask ONE question per turn.
Read the full transcript — do not re-ask for something already provided.

When all five fields are collected:
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When all five fields are confirmed, return this EXACT structure with proposedAction nested inside (copy the key names exactly):
{
  "response": "Got it — I have everything I need. Let me prepare that for you.",
  "shouldExitAutopilot": true,
  "taskIdentified": null,
  "proposedAction": {
    "taskId": "setup-systematic-withdrawal",
    "taskName": "Set Up Recurring Distributions",
    "summary": "Set up [frequency] $[amount] distributions from ${profile.name}'s [account] starting [startDate]",
    "fields": [
      {"key": "accountId",       "label": "Account",             "value": "[account id or type — omit if pre-selected]"},
      {"key": "amount",          "label": "Amount per period",   "value": "[dollar amount, e.g. $500]"},
      {"key": "frequency",       "label": "Frequency",           "value": "[Monthly / Quarterly / Annually]"},
      {"key": "startDate",       "label": "Start date",          "value": "[specific date, e.g. June 1, 2026]"},
      {"key": "deliveryMethod",  "label": "Delivery method",     "value": "[Direct deposit (ACH) / Check by mail]"}
    ]
  }
}

⚠ Never set shouldExitAutopilot=true unless all five fields are present in proposedAction.`;
};

const UPDATE_RMD_SETTINGS_PROMPT = (profile: ClientProfile, currentRmd: RmdData) => {
  const rmdAccount = profile.accounts.find(a => a.id === currentRmd.accountId)
    ?? profile.accounts.find(a => a.type.toLowerCase().includes('ira') || a.type.toLowerCase().includes('sep'));

  const fmt = (n: number | undefined) => n != null ? `$${n.toLocaleString()}` : 'N/A';

  const recentDist = (currentRmd.distributions ?? []).slice(0, 3)
    .map(d => `  • ${d.date}: ${fmt(d.amount)} via ${d.method} ($${d.withheld} withheld)`)
    .join('\n') || '  (none on file)';

  return `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
Client accounts: ${summarizeAccounts(profile.accounts)}.
${summarizeIntents(profile.intents)}

You are handling an UPDATE RMD SETTINGS request. The client wants to change how their Required Minimum Distribution is delivered.

════════════════════════════════════
CURRENT RMD STATE
════════════════════════════════════

Account: ${rmdAccount?.type ?? 'IRA'} (${currentRmd.accountId ?? rmdAccount?.id ?? 'on file'})
2025 RMD required:      ${fmt(currentRmd.annualRmd)}
Taken this year:        ${fmt(currentRmd.takenThisYear)}
Remaining to take:      ${fmt(currentRmd.remainingThisYear)}  ← NEVER calculate this yourself; use the figure above
Deadline:               ${currentRmd.nextDeadline ?? 'December 31'}
Prior year balance:     ${fmt(currentRmd.priorYearBalance)}
Life expectancy factor: ${currentRmd.lifeExpectancyFactor ?? 'N/A'}

Current distribution preferences:
  Delivery method:     ${currentRmd.deliveryMethod ?? 'not set'}
  Frequency:           ${currentRmd.frequency ?? 'not set'}
  Federal withholding: ${currentRmd.taxWithholding != null ? `${currentRmd.taxWithholding}%` : 'not set'}

Recent distributions:
${recentDist}

════════════════════════════════════
WHAT YOU NEED TO COLLECT
════════════════════════════════════

Collect only the fields the client actually wants to change. If they mention just one field, confirm the others are staying the same before submitting.

RMD DELIVERY METHOD — one of:
  • Direct deposit (ACH) — sent to their bank account on file
  • Check by mail — mailed to their address on file

RMD FREQUENCY — one of:
  • Annual (December) — one lump sum each December
  • Monthly — spread out in equal payments throughout the year
  • Quarterly — four equal payments per year

FEDERAL TAX WITHHOLDING PERCENTAGE
  What percentage of each RMD payment to withhold for federal income tax.
  Accept: "none" or "0%", a specific percentage like "10%" or "20%"

════════════════════════════════════
RULES
════════════════════════════════════

Do NOT calculate RMD amounts or balances yourself — use only the figures in CURRENT RMD STATE above.
When the client asks about their current settings, read them from CURRENT RMD STATE above.
When the client asks how much they still need to take, read remainingThisYear from CURRENT RMD STATE — never compute it.

You are already connected to the client. Do not introduce yourself.
Ask ONE question per turn. Read the full transcript — do not re-ask for something already confirmed.

When all three preference values are confirmed (including unchanged ones):
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When all three fields are confirmed, return this EXACT structure with proposedAction nested inside (copy the key names exactly):
{
  "response": "Got it — I have everything I need. Let me prepare that for you.",
  "shouldExitAutopilot": true,
  "taskIdentified": null,
  "proposedAction": {
    "taskId": "update-rmd-settings",
    "taskName": "Update RMD Settings",
    "summary": "Update ${profile.name}'s RMD to [frequency] payments via [deliveryMethod] with [withholding]% withholding",
    "fields": [
      {"key": "deliveryMethod",  "label": "RMD delivery method",                "value": "[Direct deposit (ACH) / Check by mail]"},
      {"key": "frequency",       "label": "RMD frequency",                      "value": "[Annual (December) / Monthly / Quarterly]"},
      {"key": "taxWithholding",  "label": "Federal tax withholding percentage",  "value": "[percentage or none, e.g. 10%]"}
    ]
  }
}

⚠ Never set shouldExitAutopilot=true unless all three fields are present in proposedAction.`;
};

const INITIATE_ROLLOVER_PROMPT = (profile: ClientProfile) => {
  const multiAccount = profile.accounts.length > 1;
  const targetSection = multiAccount
    ? `RECEIVING ACCOUNT — which Bob's Mutual Funds account should receive the rollover\n  Options: ${profile.accounts.map(a => `${a.type} (${a.id})`).join(', ')}\n\n`
    : `(Receiving account pre-selected: ${profile.accounts[0]?.type ?? 'on file'} — do NOT ask for it.)\n\n`;

  return `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
Client accounts: ${summarizeAccounts(profile.accounts)}.
${summarizeIntents(profile.intents)}

You are handling an INITIATE ROLLOVER request. The client wants to transfer assets from another institution into Bob's Mutual Funds.

════════════════════════════════════
WHAT YOU NEED TO COLLECT
════════════════════════════════════

SOURCE INSTITUTION — the name of the institution or employer plan being rolled over from
  Examples: "Fidelity 401(k) from my last job", "Vanguard IRA", "ADP 403(b)"
  Accept any description that identifies where the money is coming from.

SOURCE ACCOUNT TYPE — one of:
  • Traditional 401(k)
  • Roth 401(k)
  • 403(b)
  • Traditional IRA
  • Other

ESTIMATED ROLLOVER AMOUNT — approximately how much is being transferred
  Accept ranges (e.g. "about $50,000") or "I'm not sure" (record as "unknown").

${targetSection}════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Collect naturally in any order. Ask ONE question per turn.
Read the full transcript — do not re-ask for something already provided.
Do NOT give tax advice or recommend one account type over another.

When all required fields are collected:
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When complete:
{
  "taskId": "initiate-rollover",
  "taskName": "Roll Over From Another Institution",
  "summary": "Roll over ~$[amount] from [sourceInstitution] ([sourceAccountType]) into ${profile.name}'s [account]",
  "fields": [
    {"key": "sourceInstitution",  "label": "Source institution",       "value": "[institution name / description]"},
    {"key": "sourceAccountType",  "label": "Source account type",      "value": "[Traditional 401(k) / Roth 401(k) / 403(b) / Traditional IRA / Other]"},
    {"key": "estimatedAmount",    "label": "Estimated rollover amount", "value": "[dollar amount or unknown]"},
    {"key": "targetAccountId",    "label": "Receiving account",         "value": "[account id or type]"}
  ]
}

⚠ Never set shouldExitAutopilot=true unless proposedAction is fully populated.`;
};

const ROTH_CONVERSION_PROMPT = (profile: ClientProfile) => {
  const sources = profile.accounts.filter(a => ['Traditional IRA', 'SEP-IRA'].includes(a.type));
  const sourceList = sources.map(a => `${a.type} (${a.id})`).join(', ');

  return `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
Client accounts: ${summarizeAccounts(profile.accounts)}.
${summarizeIntents(profile.intents)}

You are handling a ROTH CONVERSION request. The client wants to convert pre-tax IRA assets to a Roth IRA. This is a taxable event.

════════════════════════════════════
WHAT YOU NEED TO COLLECT — all three
════════════════════════════════════

SOURCE ACCOUNT — which pre-tax account to convert from
  Eligible accounts: ${sourceList || 'Traditional IRA or SEP-IRA on file'}
  If the client has only one eligible account, confirm it with them rather than assuming.

CONVERSION AMOUNT — one of:
  • A specific dollar amount (e.g. "$20,000")
  • "Full balance" — convert the entire account

TAX YEAR — one of: 2025 or 2026

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Collect naturally in any order. Ask ONE question per turn.
Read the full transcript — do not re-ask for something already provided.
Do NOT give tax advice or tell them whether this conversion is a good idea.

When all three are collected:
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When all three are collected:
{
  "taskId": "roth-conversion",
  "taskName": "Convert to Roth IRA",
  "summary": "Convert [amount] from ${profile.name}'s [fromAccountId] to Roth IRA for tax year [taxYear]",
  "fields": [
    {"key": "fromAccountId",  "label": "Source account",       "value": "[account id or type]"},
    {"key": "amount",         "label": "Conversion amount",    "value": "[dollar amount or full balance]"},
    {"key": "taxYear",        "label": "Tax year",             "value": "[2025 / 2026]"}
  ]
}

⚠ Never set shouldExitAutopilot=true unless proposedAction is fully populated with all three values.`;
};

const REQUEST_TAX_DOCUMENT_PROMPT = (profile: ClientProfile) =>
  `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
${summarizeIntents(profile.intents)}

You are handling a REQUEST TAX DOCUMENT request.

════════════════════════════════════
WHAT YOU NEED TO COLLECT — both
════════════════════════════════════

FORM TYPE — one of:
  • 1099-R — for retirement distributions (IRA withdrawals, rollovers)
  • 1099-B — for proceeds from sales of fund shares
  • 1099-DIV — for dividends and capital gain distributions
  • Form 5498 — for IRA contributions, rollovers, and fair market value

If the client is unsure which form they need, ask what the document is for (e.g. "filing taxes", "reporting a distribution") and help them identify the right form.

TAX YEAR — one of: 2024, 2023, 2022

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Collect naturally in any order. Ask ONE question per turn.
Read the full transcript — do not re-ask for something already provided.

When both are collected:
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When both fields are confirmed, return this EXACT structure with proposedAction nested inside (copy the key names exactly):
{
  "response": "Got it — I have everything I need. Let me prepare that for you.",
  "shouldExitAutopilot": true,
  "taskIdentified": null,
  "proposedAction": {
    "taskId": "request-tax-document",
    "taskName": "Request Tax Document",
    "summary": "Send ${profile.name} a copy of their [formType] for tax year [taxYear]",
    "fields": [
      {"key": "formType",  "label": "Form type",  "value": "[1099-R / 1099-B / 1099-DIV / Form 5498]"},
      {"key": "taxYear",   "label": "Tax year",   "value": "[2024 / 2023 / 2022]"}
    ]
  }
}

⚠ Never set shouldExitAutopilot=true unless both fields are present in proposedAction.`;

const CANCEL_RESCHEDULE_CALLBACK_PROMPT = (profile: ClientProfile) =>
  `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
${summarizeIntents(profile.intents)}

You are handling a CANCEL OR RESCHEDULE CALLBACK request.

════════════════════════════════════
WHAT YOU NEED TO COLLECT
════════════════════════════════════

ACTION — one of:
  • Cancel — remove the callback entirely
  • Reschedule — change it to a new time

NEW CALLBACK TIME (only if Reschedule)
  Ask for a specific day and time (e.g. "tomorrow at 2 PM", "Friday morning").
  If action = Cancel, do NOT ask for a new time.

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Determine the action first. If Reschedule, then ask for the new time. Ask ONE question per turn.
Read the full transcript — do not re-ask for something already provided.

When all required fields are collected:
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When all required fields are confirmed, return this EXACT structure with proposedAction nested inside (copy the key names exactly).

If action is Cancel:
{
  "response": "Got it — I have everything I need. Let me prepare that for you.",
  "shouldExitAutopilot": true,
  "taskIdentified": null,
  "proposedAction": {
    "taskId": "cancel-reschedule-callback",
    "taskName": "Cancel or Reschedule Callback",
    "summary": "Cancel ${profile.name}'s scheduled callback",
    "fields": [
      {"key": "action",  "label": "Action",  "value": "Cancel"}
    ]
  }
}

If action is Reschedule (include newScheduledTime):
{
  "response": "Got it — I have everything I need. Let me prepare that for you.",
  "shouldExitAutopilot": true,
  "taskIdentified": null,
  "proposedAction": {
    "taskId": "cancel-reschedule-callback",
    "taskName": "Cancel or Reschedule Callback",
    "summary": "Reschedule ${profile.name}'s callback to [new time]",
    "fields": [
      {"key": "action",            "label": "Action",            "value": "Reschedule"},
      {"key": "newScheduledTime",  "label": "New callback time", "value": "[the new time the client specified]"}
    ]
  }
}

⚠ Never set shouldExitAutopilot=true unless proposedAction is fully populated for the given action.`;

const UPDATE_SECURITY_PROMPT = (profile: ClientProfile) =>
  `You are a live financial services agent at Bob's Mutual Funds in an active chat with ${profile.name}.
${summarizeIntents(profile.intents)}

You are handling an UPDATE SECURITY SETTINGS request.

════════════════════════════════════
WHAT YOU NEED TO COLLECT — one field
════════════════════════════════════

SECURITY ACTION — one of:
  • Change password — reset the client's account password
  • Enable 2FA — turn on two-factor authentication
  • Disable 2FA — turn off two-factor authentication
  • Remove trusted device — remove a device that was previously trusted for login

If the client's message already makes clear which action they want, confirm it and proceed.

════════════════════════════════════
HOW TO HANDLE THIS CONVERSATION
════════════════════════════════════

You are already connected to the client. Do not introduce yourself.
Ask ONE question if needed. If the intent is clear from the transcript, confirm and proceed.
Read the full transcript — do not re-ask for something already provided.

When the security action is confirmed:
→ Set shouldExitAutopilot=true and populate proposedAction

${FORBIDDEN_TOPICS}

════════════════════════════════════
RESPONSE — return ONLY valid JSON
════════════════════════════════════
{
  "response": "...",
  "shouldExitAutopilot": false,
  "taskIdentified": null,
  "proposedAction": null
}

When the security action is confirmed, return this EXACT structure with proposedAction nested inside (copy the key name exactly):
{
  "response": "Got it — I have everything I need. Let me prepare that for you.",
  "shouldExitAutopilot": true,
  "taskIdentified": null,
  "proposedAction": {
    "taskId": "update-security",
    "taskName": "Update Security Settings",
    "summary": "[securityAction] for ${profile.name}'s account",
    "fields": [
      {"key": "securityAction",  "label": "Security action",  "value": "[Change password / Enable 2FA / Disable 2FA / Remove trusted device]"}
    ]
  }
}

⚠ Never set shouldExitAutopilot=true unless proposedAction is present in the JSON.`;

/** LLM fallback: when keyword matching fails, ask the model to classify the intent. */
async function identifyTaskWithLLM(
  intent: string,
  accountTypes: string[],
): Promise<typeof TASKS[number] | undefined> {
  const eligibleTasks = TASKS.filter(
    t => !t.eligibleAccountTypes || t.eligibleAccountTypes.some(at => accountTypes.includes(at)),
  );
  const taskList = eligibleTasks.map(t =>
    `${t.id}: ${t.description} (related terms: ${t.keywords.slice(0, 6).join(', ')})`
  ).join('\n');

  const systemPrompt =
    `You are a task classifier for a financial services contact center. ` +
    `Given a summary of a customer's intent, return the single best-matching task ID from the list below. ` +
    `Return ONLY the task ID (e.g. "add-account-access"), or the word "none" if no task fits.\n\n` +
    `Available tasks:\n${taskList}`;

  try {
    const raw = await invokeNovaMicro(
      intent,
      systemPrompt,
      50,
      { fn: 'autopilot-turn', scope: 'get-intent:classify' },
    );
    const taskId = raw.trim().toLowerCase().replace(/['"]/g, '');
    const matched = eligibleTasks.find(t => t.id === taskId);
    console.log(JSON.stringify({
      event: 'task_classify', fn: 'autopilot-turn', intent, taskId, matched: !!matched,
    }));
    return matched;
  } catch (e) {
    console.warn('Task classification LLM call failed', e);
    return undefined;
  }
}

/** Returns the specialized expert prompt for a known task, or falls back to the generic template. */
async function buildTaskSystemPrompt(profile: ClientProfile, taskId: string): Promise<string> {
  switch (taskId) {
    case 'update-contact-info':           return UPDATE_CONTACT_INFO_PROMPT(profile);
    case 'update-beneficiaries': {
      const bens = await fetchBeneficiaries(profile.clientId);
      return UPDATE_BENEFICIARIES_PROMPT(profile, bens);
    }
    case 'add-account-access':            return ADD_ACCOUNT_ACCESS_PROMPT(profile);
    case 'open-account':                  return OPEN_ACCOUNT_PROMPT(profile);
    case 'place-purchase':                return PLACE_PURCHASE_PROMPT(profile);
    case 'place-sale':                    return PLACE_SALE_PROMPT(profile);
    case 'exchange-funds':                return EXCHANGE_FUNDS_PROMPT(profile);
    case 'toggle-drip':                   return TOGGLE_DRIP_PROMPT(profile);
    case 'setup-auto-invest':             return SETUP_AUTO_INVEST_PROMPT(profile);
    case 'update-auto-invest':            return UPDATE_AUTO_INVEST_PROMPT(profile);
    case 'pause-auto-invest':             return PAUSE_AUTO_INVEST_PROMPT(profile);
    case 'request-withdrawal':            return REQUEST_WITHDRAWAL_PROMPT(profile);
    case 'setup-systematic-withdrawal':   return SETUP_SYSTEMATIC_WITHDRAWAL_PROMPT(profile);
    case 'update-rmd-settings': {
      const rmd = await fetchRmdSettings(profile.clientId);
      return UPDATE_RMD_SETTINGS_PROMPT(profile, rmd);
    }
    case 'initiate-rollover':             return INITIATE_ROLLOVER_PROMPT(profile);
    case 'roth-conversion':               return ROTH_CONVERSION_PROMPT(profile);
    case 'request-tax-document':          return REQUEST_TAX_DOCUMENT_PROMPT(profile);
    case 'cancel-reschedule-callback':    return CANCEL_RESCHEDULE_CALLBACK_PROMPT(profile);
    case 'update-security':               return UPDATE_SECURITY_PROMPT(profile);
    default:                              return buildTaskFieldPrompt(profile, taskId, {});
  }
}

// ── General GET INTENT prompt (fallback when no task matched) ──────────────

const GET_INTENT_PROMPT = (profile: ClientProfile, intent: string) =>
  `You are a live human financial services agent at Bob's Mutual Funds. You have already been connected to the client via chat — this is an ongoing live conversation.
Client: ${profile.name}. Accounts: ${summarizeAccounts(profile.accounts)}.
Current intent label: "${intent}".${summarizeIntents(profile.intents)}

CRITICAL CONTEXT: You are the agent the client is already speaking with. Do NOT offer to "connect them to a live agent" or "transfer" them — you ARE the live agent. Do NOT say you will arrange anything externally. You are here, ready to help.

Your goal is GET INTENT: ask focused questions to fully understand what the client needs today.
${FORBIDDEN_TOPICS}

Rules:
- Read the full transcript carefully. If you (the agent) have NOT yet sent any message, send a warm greeting introducing yourself by first name, briefly acknowledge what you can see about their inquiry, and immediately ask your FIRST detail question. Do NOT ask "is that right?" or similar topic confirmations — the client already confirmed their intent by escalating to a live agent. Jump straight to collecting the specific details you need.
- Otherwise, ask ONE focused clarifying question to fill the most important remaining blank.
- Do NOT ask multiple questions at once.
- Before deciding to exit, reason through: write out every piece of information you would need in order to take immediate action on this request with zero follow-up questions. Then check whether each of those pieces has been answered with a SPECIFIC answer (not just a topic confirmation). A client saying "yes", "correct", "you got it", or similar without giving a specific detail does NOT fill any blank — only concrete answers to specific questions count. If any blanks remain, ask ONE focused question to fill the most important gap. Only set shouldExitAutopilot=true once every piece is accounted for with a specific answer.
- NEVER set shouldExitAutopilot=true on the same turn you are sending your opening greeting. You must wait for the client to reply to at least one of your detail questions first.
- Set shouldExitAutopilot=true if the client asks to speak with a different person or escalate to a supervisor.
- CRITICAL EXIT RULE: When setting shouldExitAutopilot=true, send ONLY a brief acknowledgment that you (the agent) are personally about to take action — never imply someone else is coming. Examples: "Got it — let me look into that for you right now." / "Perfect, I have everything I need. Give me just a moment." / "Understood, I'll take care of that." For forbidden topics, use the scripted response verbatim. Do NOT answer the question or provide information in the same turn you exit. The acknowledgment is the entire response.

Return ONLY valid JSON: {"response": "...", "shouldExitAutopilot": false, "suggestedScope": null, "taskIdentified": null, "proposedAction": null}`;

const RESEARCHING_PROMPT = (profile: ClientProfile) =>
  `You are a professional financial services agent at Bob's Mutual Funds handling a live chat.
Client: ${profile.name}.

Your goal is RESEARCHING: you are working on something and the client is waiting.
If the client sends a message, respond warmly and let them know you're still working on it.
If the client asks to escalate or seems frustrated, set shouldExitAutopilot=true.

Return ONLY valid JSON: {"response": "...", "shouldExitAutopilot": false, "suggestedScope": null}`;

const CALLBACK_PROMPT = (profile: ClientProfile, nowETStr: string) =>
  `You are a professional financial services agent at Bob's Mutual Funds handling a live chat.
Client: ${profile.name} (ID: ${profile.clientId}).
Client phone on file: ${profile.phone ? formatPhone(profile.phone) : 'not on file'}.
Current time in ET: ${nowETStr}.

Your goal is CALLBACK: schedule a phone callback for this client.

Read the transcript carefully to determine what has already been established:
A) Has the callback need been acknowledged/offered?
B) Has the phone number been confirmed? (client said yes to the number on file, or provided a different number)
C) Has the callback time been confirmed? (client specified a time and you haven't yet returned scheduleCallback)
D) Has scheduleCallback already been returned? (look for a [CALLBACK_SCHEDULED] system message in the transcript)

Based on what's been collected, respond appropriately — one step at a time:

1. If A is not done: Acknowledge the callback need (say you're happy to set one up, or that this topic requires a call).
2. If A done, B not done: Ask about the phone: "The number I have on file for you is [formatted phone]. Is that the best number to reach you for a callback?"
   - If the client confirms yes → B is done.
   - If the client says no or provides a different number → use the number they provide.
3. If A and B done, C not done: Ask about time.
   - If current ET time is before 7:00 PM: "Agents are available until 7:30 PM Eastern time. What time would work for you?"
   - If current ET time is 7:00 PM or later: "Our agents are wrapping up for today. I can schedule this for tomorrow or another weekday — what day and time works best?"
   - Client responses like "3 PM", "3:30", "tomorrow at 2" → parse to ISO8601 UTC. Today's date in context of "${nowETStr}".
4. If A, B, C are done and D is not done: Return scheduleCallback JSON with the extracted phone and time.
   RULES FOR THIS STEP: set shouldExitAutopilot=false, closeChat=false, scheduleCallback=<filled in>.
   Your response should confirm the scheduled time to the client (e.g. "Great — I've scheduled your callback for [time]. You'll receive a call at [number].").
   IMPORTANT: Always display phone numbers in (XXX) XXX-XXXX format in your response text. The phoneNumber field in scheduleCallback should still be 10 digits only.
   Do NOT ask "Is there anything else?" in this same turn. Stop here and wait.
5. If D is done AND you have already asked "Is there anything else?":
   - If the client says no, thanks, or goodbye → send a warm closing message, set shouldExitAutopilot=true and closeChat=true.
   - If the client says yes or raises a new topic → set shouldExitAutopilot=true, closeChat=false, response="".
6. If D is done AND you have NOT yet asked "Is there anything else?" → ask it now.
   RULES FOR THIS STEP: set shouldExitAutopilot=false, closeChat=false, scheduleCallback=null.
   Do NOT close the chat here — wait for the client's reply.

Return ONLY valid JSON:
{
  "response": "...",
  "shouldExitAutopilot": false,
  "closeChat": false,
  "suggestedScope": null,
  "scheduleCallback": {
    "clientId": "${profile.clientId}",
    "clientName": "${profile.name}",
    "phoneNumber": "10 digits only e.g. 6102345678",
    "scheduledTimeISO": "ISO8601 UTC datetime e.g. 2026-04-25T19:00:00.000Z",
    "intentSummary": "one sentence describing why the client needs a callback"
  } | null
}
scheduleCallback must be null unless you have a confirmed phone AND time and D is not yet done.
closeChat must be true ONLY when the conversation is fully complete and should be ended.`;

const IDLE_CHECK_PROMPT = (profile: ClientProfile) =>
  `You are a professional financial services agent at Bob's Mutual Funds handling a live chat.
Client: ${profile.name}.

Your goal is IDLE CHECK: the client appears to have gone quiet. Respond warmly to their message.
If they've come back and are responsive, set shouldExitAutopilot=true so normal handling resumes.

Return ONLY valid JSON: {"response": "...", "shouldExitAutopilot": true, "suggestedScope": null}`;

const SELF_SERVICE_PAGES = `
SELF-SERVICE PAGES
The client is on the Bob's Mutual Funds portal at ferrarajc.github.io/chatmaxxing. Never say "complete a form on our website" or "find this on our website." Instead, give brief instructions and include a markdown link directly to the relevant page: [Link Text](/path).
IMPORTANT: Do NOT link to bobrsmutualfunds.com for page links — that domain is not the client's portal. Use only the paths and URLs listed below.

Action pages (in-app, relative links):
- Update beneficiaries: /account/beneficiaries
- Set up or change auto-invest: /account/auto-invest
- View RMD details: /account/rmd
- Download tax documents: /account/tax-documents
- Open a new account: /open-account
- View portfolio: /portfolio

In-app resource pages (relative links):
- Estate planning & beneficiary guidance: /resources/estate-planning
- IRA contribution limits: /resources/ira-contribution-limits
- Roth IRA overview: /resources/roth-ira
- Rollover guide: /resources/rollover
- SEP IRA guide: /resources/sep-ira
- Self-employed retirement options: /resources/self-employed-retirement
- Tax deductions: /resources/tax-deductions
- Tax-efficient investing: /resources/tax-efficient-investing

Knowledge base articles (React routes inside the portal — use the full path exactly as listed, never construct or abbreviate):
Link to KB articles proactively: include a link whenever the client's question touches a related topic, even if you already answered it fully.
Keyword triggers → full path:
- fees, expense ratio, management fee, cost, what do you charge, how much does it cost → /help/fees
- cost basis, FIFO, average cost, specific identification, capital gain, change cost basis → /help/cost-basis
- dividend reinvestment, DRIP, reinvest dividends, cash dividend → /help/drip
- statement, account statement, paperless, monthly statement → /help/statements
- 1099, tax form, tax document, year-end form → /help/tax-documents
- fund performance, returns, how has my fund done, NAV history → /help/fund-performance
- prospectus, fund documents, investment objective, risk disclosure → /help/prospectus
- how to buy, how to sell, place a trade, submit an order, step-by-step trade → /help/place-trade
- trading window, order cutoff, settlement period, market order, trading hours → /help/trading
- wire transfer, outgoing wire, wire fee → /help/wire-transfer
- transfer account, ACATS, move my account, transfer in from another firm → /help/account-transfer
- authorized user, add someone to account, power of attorney, view-only access → /help/account-access
- ownership change, account registration, re-register account → /help/ownership-form
- inherit account, deceased account, beneficiary claim → /help/inheritance
- open account, account types, new account, fund my account → /help/open-account
- beneficiary designation, primary beneficiary, contingent beneficiary → /help/beneficiary
- RMD, required minimum distribution, minimum withdrawal age → /help/rmd-guide
- rollover, 401k to IRA, direct rollover, transfer my 401k → /help/rollover-guide
- IRA contribution limit, how much can I contribute, catch-up contribution → /help/ira-limits
- auto-invest, automatic investment, recurring purchase, systematic investment → /help/sip
- contact, phone number, hours, email, address, call us → /help/contact
- estate planning, inherited IRA, estate services, step-up in basis → /help/estate-planning

When the client's request maps to a self-service action page: respond with 1-2 sentences explaining what to do, include the action page link, and optionally a KB article link. Keep shouldExitAutopilot=false — you are handling this request successfully.

Example — client says "I want to update my beneficiaries":
"You can update your beneficiaries directly at [Beneficiaries](/account/beneficiaries) — it only takes a minute. For guidance on beneficiary designation rules, see our [Beneficiary Designations](/help/beneficiary) page."

Example — client asks about expense ratios, fees, or management fees:
"Our fund expense ratios range from 0.03% (500 Index) to 0.25% (Growth) — no account maintenance fees or trading fees. Full details at [Fees & Expense Ratios](/help/fees)."

Example — client asks about cost basis or changing their cost basis method:
"You can change your cost basis method under My Account > Tax Settings before placing a sale. See [Cost Basis Methods](/help/cost-basis) for a full explanation of the available methods."`;

function extractLinkedPaths(transcript: ChatMessage[]): string[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const paths = new Set<string>();
  for (const msg of transcript) {
    if (msg.role === 'BOT' || msg.role === 'AGENT') {
      let match;
      while ((match = linkRegex.exec(msg.content)) !== null) {
        paths.add(match[2]);
      }
    }
  }
  return [...paths];
}

const FULL_AUTO_PROMPT = (profile: ClientProfile, intent: string, alreadyLinked: string[], currentPage?: string) =>
  `You are a friendly, professional financial services agent at Bob's Mutual Funds handling a live chat.
Client: ${profile.name}. Accounts: ${summarizeAccounts(profile.accounts)}.
Current topic: "${intent}".

Your goal is FULL AUTO: serve this client completely through this conversation. You are knowledgeable and capable — engage with the customer, understand their need, and provide real answers. You may ask clarifying or follow-up questions. You may write freeform answers. Use page links as helpful supplements, not as your primary mode of response.
${FORBIDDEN_TOPICS}
${SELF_SERVICE_PAGES}
${currentPage ? `CURRENT PAGE: The client is already viewing "${currentPage}". Do not link to this page — they are on it. Use your awareness of what is on this page to give specific, contextual guidance.` : ''}
${(() => { const excluded = [...alreadyLinked, ...(currentPage ? [currentPage] : [])]; return excluded.length > 0 ? `DO NOT LINK to any of these pages (already visited or currently viewing): ${excluded.join(', ')}. If the most relevant page is on this list, help a different way: answer directly, ask a follow-up question, or reference a different resource.` : ''; })()}

Set shouldExitAutopilot=true ONLY in these two cases:
1. The client has explicitly asked to speak with a live agent, human, or representative.
2. A FORBIDDEN TOPIC applies (see above) — use the scripted response for that topic.

Do NOT set shouldExitAutopilot=true for account actions (give the self-service link instead), questions you can answer (answer them), low confidence (do your best or ask a clarifying question), or client frustration (be empathetic and help more). When in doubt, set shouldExitAutopilot=false and help.

When escalating because the client explicitly asked: respond with "I'll connect you with a live agent right now." For forbidden topics: use the scripted response. Never mention live agent support when shouldExitAutopilot=false.

Only set suggestedScope="callback" if the client explicitly asked for a callback. Suggest suggestedScope="idle-check" if the client seems to have gone quiet.

Output ONLY a JSON object — no prose, no markdown, no explanation before or after it:
{"response": "YOUR_RESPONSE_HERE", "shouldExitAutopilot": false, "suggestedScope": null}
Replace YOUR_RESPONSE_HERE with your actual reply. The other fields are booleans/null as shown.`;

const CUSTOMER_BOT_PROMPT = (profile: ClientProfile, alreadyLinked: string[], currentPage?: string) =>
  `You are the Bob's Mutual Funds virtual assistant — a knowledgeable, friendly helper in the client's portal chat.
Client: ${profile.name}. Accounts: ${summarizeAccounts(profile.accounts)}.

RESPONSE STYLE — follow this for every message:
1. Acknowledge what the client is asking. Show you understand their situation.
2. Give a direct, informative answer (2-4 sentences). Use their account data when relevant.
3. Include a page link as a supplement — never as your only response.
4. When appropriate, invite engagement with a specific follow-up question.

BAD: "You can manage account access at [Account Access](/help/account-access). Let me know if you have questions!"
GOOD: "Adding an authorized user lets someone view and manage your account on their behalf — you control what level of access they get. You'll need their full name, date of birth, and relationship to you. Start the process at [Account Access](/help/account-access) — it takes about 5 minutes. Would you like to know what information to have ready?"

${FORBIDDEN_TOPICS}
${SELF_SERVICE_PAGES}
${currentPage ? `CURRENT PAGE: The client is already viewing "${currentPage}". Do not link to this page. Use your knowledge of what's on it to give specific, contextual guidance.` : ''}
${(() => { const excluded = [...alreadyLinked, ...(currentPage ? [currentPage] : [])]; return excluded.length > 0 ? `DO NOT LINK to these pages (already visited/viewing): ${excluded.join(', ')}.` : ''; })()}

Set shouldExitAutopilot=true ONLY when the client has explicitly asked to speak with a live agent. Do NOT escalate for account questions, topics you can answer, or anything covered by a self-service page — handle those directly. When in doubt, help.

When escalating: respond "I'll connect you with a live agent right now." Never mention live agent support when shouldExitAutopilot=false.

Output ONLY a JSON object:
{"response": "YOUR_RESPONSE_HERE", "shouldExitAutopilot": false, "suggestedScope": null}`;

// ── Hallucination protection — appended to all tool-enabled system prompts ─
const HALLUCINATION_PROTECTION_RULE = `

CRITICAL DATA RULE: You only know what is explicitly written in this system prompt or what a tool call returned. Never state, reference, or imply specific financial data (account balances, holdings quantities, transaction amounts, phone numbers, email addresses, beneficiary names, or any client-specific numbers) that was not provided here or returned by a tool. If you need data not already in context, call the appropriate tool first.`;

// ── Exit message instruction appended to system prompts at LLM call sites ─
const EXIT_MESSAGE_INSTRUCTION = `

EXIT MESSAGE RULE
When shouldExitAutopilot is true, also set exitMessage to a ≤20-word sentence addressed to the human agent explaining why autopilot is handing back control (third person, e.g. "All fields collected — proposed action is ready for review." or "Customer requested escalation to a supervisor."). When shouldExitAutopilot is false, set exitMessage to null.`;

// ── Escalation hard-override ───────────────────────────────────────────────
const ESCALATION_RE = /\b(speak to|talk to|connect me|transfer me|live agent|real person|human agent|representative|escalate|supervisor|speak with|talk with)\b/i;
const TRADE_RE = /\b(buy|sell|purchase|trade|place.?order|liquidat|redeem)\b/i;
const CALLBACK_INTENT_RE = /\b(callback|call back|schedule.*call|phone call|call me|ring me)\b/i;
// Matches cancel/reschedule of an *existing* callback — must NOT be redirected to the callback scope
const CANCEL_RESCHEDULE_CALLBACK_RE = /\b(cancel|reschedule|change|move|update)\b.{0,30}\b(callback|call back)\b/i;

// ── Handler ────────────────────────────────────────────────────────────────

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const {
      transcript,
      clientProfile,
      scope = 'full-auto',
      currentIntent,
      currentPage,
    }: {
      transcript: ChatMessage[];
      clientProfile: ClientProfile;
      scope?: AutopilotScope;
      currentIntent?: string;
      currentPage?: string;
    } = JSON.parse(event.body ?? '{}');

    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return jsonResponse(400, { error: 'transcript is required and must be a non-empty array' });
    }

    const profile: ClientProfile = clientProfile ?? {
      clientId: 'demo-client-001',
      name: 'Alex Johnson',
      phone: '4842384838',
      accounts: [{ type: 'Roth IRA', balance: 45230, id: 'acc-001' }],
      totalBalance: 45230,
      recentChatHistory: [],
    };

    const lastCustomerMsg = [...transcript].reverse().find(m => m.role === 'CUSTOMER')?.content ?? '';

    // ── Task-driven get-intent logic ───────────────────────────────────────
    let taskIdentifiedForResponse: string | null = null;

    if (scope === 'get-intent') {
      // If callback intent — suggest switching to the callback scope immediately
      // Exception: cancel/reschedule of an existing callback is its own task, not a new callback request
      if (!CANCEL_RESCHEDULE_CALLBACK_RE.test(currentIntent ?? '') &&
          (CALLBACK_INTENT_RE.test(currentIntent ?? '') || CALLBACK_INTENT_RE.test(lastCustomerMsg))) {
        return jsonResponse(200, {
          response: '',
          shouldExitAutopilot: true,
          exitMessage: 'Customer requested a callback — switching to callback scope.',
          suggestedScope: 'callback',
          closeChat: false,
          scheduleCallback: null,
          taskIdentified: null,
          proposedAction: null,
        });
      }

      // Check if a task has already been identified (look for [TASK: id] in transcript)
      const taskMarker = transcript
        .filter(m => m.role === 'SYSTEM')
        .map(m => m.content.match(/^\[TASK:\s*([^\]]+)\]$/))
        .find(Boolean);

      const activeTaskId = taskMarker?.[1]?.trim() ?? null;

      if (activeTaskId) {
        // Phase 2: LLM expert owns the entire task conversation

        if (ESCALATION_RE.test(lastCustomerMsg)) {
          return jsonResponse(200, {
            response: '',
            shouldExitAutopilot: true,
            exitMessage: 'Customer requested escalation to a live agent.',
            suggestedScope: null,
            closeChat: false,
            scheduleCallback: null,
            taskIdentified: null,
            proposedAction: null,
          });
        }

        const taskSystemPrompt = await buildTaskSystemPrompt(profile, activeTaskId) + EXIT_MESSAGE_INSTRUCTION + HALLUCINATION_PROTECTION_RULE;
        const p2ContactId = transcript[0]?.content?.slice(0, 8);
        const p2Executor = createToolExecutor(profile.clientId, { contactId: p2ContactId });
        let taskResponse = '';
        let taskShouldExit = false;
        let taskProposedAction: Record<string, unknown> | null = null;
        let taskExitMessage: string | null = null;
        let taskToolsUsed: string[] = [];

        try {
          const result = await invokeWithTools(
            taskSystemPrompt,
            [{ role: 'user', content: formatTranscriptForBedrock(transcript) }],
            ALL_CLIENT_TOOLS,
            p2Executor,
            700,
            { fn: 'autopilot-turn', contactId: p2ContactId, clientId: profile.clientId, scope: `get-intent:${activeTaskId}` },
            true,
          );
          taskToolsUsed = result.toolsUsed;
          const parsed = parseJsonFromBedrock<{
            response: string;
            shouldExitAutopilot: boolean;
            exitMessage?: string | null;
            proposedAction?: Record<string, unknown> | null;
          }>(result.text);

          taskResponse = parsed.response ?? '';
          taskShouldExit = parsed.shouldExitAutopilot ?? false;
          taskExitMessage = parsed.exitMessage ?? null;
          taskProposedAction = parsed.proposedAction ?? null;

          // Safety guard: never exit without a proposedAction
          if (taskShouldExit && !taskProposedAction) taskShouldExit = false;
        } catch (e) {
          console.warn('Task expert LLM call failed', e);
          taskResponse = "I'm pulling some information, give me just a few moments please.";
          taskShouldExit = true;
          taskExitMessage = 'Autopilot stopped due to an unexpected processing error.';
        }

        console.log(JSON.stringify({
          event: 'autopilot_decision', fn: 'autopilot-turn',
          scope: `get-intent:${activeTaskId}`, shouldExitAutopilot: taskShouldExit,
          hasProposedAction: !!taskProposedAction,
        }));

        return jsonResponse(200, {
          response: taskResponse,
          shouldExitAutopilot: taskShouldExit,
          exitMessage: taskExitMessage,
          suggestedScope: null,
          closeChat: false,
          scheduleCallback: null,
          taskIdentified: null,
          proposedAction: taskProposedAction,
          toolsUsed: taskToolsUsed,
        });
      } else {
        // Phase 1: task identification — try keyword match first (no LLM call)
        const accountTypes = profile.accounts.map(a => a.type);
        const matchedTask = matchTaskByIntent(currentIntent ?? '', accountTypes);

        // LLM fallback when keyword match misses (e.g. "give his wife access" vs keyword "give access")
        const resolvedTask = matchedTask
          ?? await identifyTaskWithLLM(currentIntent ?? '', accountTypes);

        if (resolvedTask) {
          // Phase 1: task identified — LLM expert handles the first turn
          taskIdentifiedForResponse = resolvedTask.id;
          const p1SystemPrompt = await buildTaskSystemPrompt(profile, resolvedTask.id) + EXIT_MESSAGE_INSTRUCTION;

          let p1Response = '';
          let p1ShouldExit = false;
          let p1ProposedAction: Record<string, unknown> | null = null;
          let p1ExitMessage: string | null = null;
          let p1ToolsUsed: string[] = [];

          try {
            const p1ContactId = transcript[0]?.content?.slice(0, 8);
            const p1Executor = createToolExecutor(profile.clientId, { contactId: p1ContactId });
            const result = await invokeWithTools(
              p1SystemPrompt + HALLUCINATION_PROTECTION_RULE,
              [{ role: 'user', content: formatTranscriptForBedrock(transcript) }],
              ALL_CLIENT_TOOLS,
              p1Executor,
              700,
              { fn: 'autopilot-turn', contactId: p1ContactId, clientId: profile.clientId, scope: `get-intent:identify:${resolvedTask.id}` },
              true,
            );
            p1ToolsUsed = result.toolsUsed;
            const parsed = parseJsonFromBedrock<{
              response: string;
              shouldExitAutopilot: boolean;
              exitMessage?: string | null;
              proposedAction?: Record<string, unknown> | null;
            }>(result.text);

            p1Response = parsed.response ?? '';
            p1ShouldExit = parsed.shouldExitAutopilot ?? false;
            p1ExitMessage = parsed.exitMessage ?? null;
            p1ProposedAction = parsed.proposedAction ?? null;
            if (p1ShouldExit && !p1ProposedAction) p1ShouldExit = false;
          } catch (e) {
            console.warn('Task expert LLM call (phase 1) failed', e);
            p1Response = "I can help with that — could I get a few details?";
          }

          console.log(JSON.stringify({
            event: 'autopilot_decision', fn: 'autopilot-turn',
            scope: `get-intent:identify:${resolvedTask.id}`, shouldExitAutopilot: p1ShouldExit,
          }));

          return jsonResponse(200, {
            response: p1Response,
            shouldExitAutopilot: p1ShouldExit,
            exitMessage: p1ExitMessage,
            suggestedScope: null,
            closeChat: false,
            scheduleCallback: null,
            taskIdentified: resolvedTask.id,
            proposedAction: p1ProposedAction,
            toolsUsed: p1ToolsUsed,
          });
        }
        // No keyword or LLM match — fall through to general GET_INTENT_PROMPT below
      }
    }

    // ── Standard scope handling ────────────────────────────────────────────

    let systemPrompt: string;
    switch (scope) {
      case 'get-intent':
        systemPrompt = GET_INTENT_PROMPT(profile, currentIntent ?? 'general inquiry');
        break;
      case 'researching':
        systemPrompt = RESEARCHING_PROMPT(profile);
        break;
      case 'callback':
        systemPrompt = CALLBACK_PROMPT(profile, nowET());
        break;
      case 'idle-check':
        systemPrompt = IDLE_CHECK_PROMPT(profile);
        break;
      case 'customer-bot':
        systemPrompt = CUSTOMER_BOT_PROMPT(profile, extractLinkedPaths(transcript), currentPage);
        break;
      default:
        systemPrompt = FULL_AUTO_PROMPT(profile, currentIntent ?? 'general inquiry', extractLinkedPaths(transcript), currentPage);
    }

    const augmentedSystemPrompt = systemPrompt + EXIT_MESSAGE_INSTRUCTION + HALLUCINATION_PROTECTION_RULE;
    const contactId = transcript[0]?.content?.slice(0, 8);
    const executor = createToolExecutor(profile.clientId, { contactId });

    let response = '';
    let shouldExitAutopilot = false;
    let suggestedScope: string | null = null;
    let closeChat = false;
    let scheduleCallback: Record<string, string> | null = null;
    let exitMessage: string | null = null;
    let toolsUsed: string[] = [];

    try {
      const result = await invokeWithTools(
        augmentedSystemPrompt,
        [{ role: 'user', content: formatTranscriptForBedrock(transcript) }],
        ALL_CLIENT_TOOLS,
        executor,
        500,
        { fn: 'autopilot-turn', contactId, clientId: profile.clientId, scope },
        true,
      );
      toolsUsed = result.toolsUsed;
      const parsed = parseJsonFromBedrock<{
        response: string;
        shouldExitAutopilot: boolean;
        exitMessage?: string | null;
        suggestedScope?: string | null;
        closeChat?: boolean;
        scheduleCallback?: Record<string, string> | null;
      }>(result.text);

      response = parsed.response ?? '';
      shouldExitAutopilot = parsed.shouldExitAutopilot ?? false;
      exitMessage = parsed.exitMessage ?? null;
      suggestedScope = parsed.suggestedScope ?? null;
      closeChat = parsed.closeChat ?? false;
      scheduleCallback = parsed.scheduleCallback ?? null;
    } catch (e) {
      console.warn('Autopilot LLM call failed', e);
      shouldExitAutopilot = false;
      response = "I'm having a bit of trouble right now — could you try rephrasing your question?";
    }

    // Business-rule hard overrides
    if (ESCALATION_RE.test(lastCustomerMsg)) {
      shouldExitAutopilot = true;
      exitMessage = 'Customer requested escalation to a live agent.';
    }
    if (scope !== 'callback' && scope !== 'customer-bot' && TRADE_RE.test(lastCustomerMsg)) {
      shouldExitAutopilot = true;
      suggestedScope = 'callback';
      exitMessage = 'Trade request detected — please handle in the callback scope.';
    }

    console.log(JSON.stringify({
      event: 'autopilot_decision',
      fn: 'autopilot-turn',
      scope,
      contactId: transcript[0]?.content?.slice(0, 8),
      agentTurnCount: transcript.filter(m => m.role === 'AGENT').length,
      shouldExitAutopilot,
      suggestedScope,
      responseChars: response.length,
    }));

    return jsonResponse(200, {
      response,
      shouldExitAutopilot,
      exitMessage: shouldExitAutopilot ? (exitMessage ?? 'Autopilot exited.') : null,
      suggestedScope,
      closeChat,
      scheduleCallback,
      taskIdentified: taskIdentifiedForResponse,
      proposedAction: null,
      toolsUsed,
    });
  } catch (err) {
    console.error('autopilot-turn error', err);
    return jsonResponse(500, { error: 'Autopilot turn failed', shouldExitAutopilot: true });
  }
};
