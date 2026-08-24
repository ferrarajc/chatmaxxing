// ── One simulation, end to end ───────────────────────────────────────────────
//
// A faithful replay of what agent-app/src/components/ChatColumn.tsx does, then what
// ProposedActionCard + submitProposedAction.ts do. Fidelity matters in two places the
// old harnesses got wrong:
//
//   • The [TASK: id] marker is APPENDED AT THE END of the transcript, which is where the
//     real app puts it (ChatColumn.tsx:538-544). Both old harnesses inserted it near the
//     start; the Lambda's `.reverse().find()` tolerates either, but the flattened prompt
//     the model sees is different, so the old tests were exercising a transcript shape
//     that production never produces.
//   • The clientProfile carries NO holdings, because the agent-app mirror has none. That
//     is precisely why fetchHoldings() exists in the handler. Handing the expert holdings
//     here would make the simulation easier than production.
//
// Two parallel views are built as it runs. clientView is what the customer saw, and is
// the ONLY thing detectors and the judge are allowed to read. agentView keeps everything
// else for the report.

import { getFacts } from './facts.mjs';
import { toClientProfile } from './personas.mjs';
import { openingMessage, systemPrompt, customerReply } from './customer.mjs';
import { diffSnapshots, checkBalanceIdentity, expectationFor, summaryAgreesWithLedger } from './ledger.mjs';
import { assertProposedAction, assertExecution } from './assert.mjs';
import { detect } from './detect.mjs';

const HOLDING_REPLIES = [
  "I'm pulling some information, give me just a few moments please.",
  'I can help with that — could I get a few details?',
  "Thanks — I'm getting that set up for you now.",
];

/** The confirmation string composed exactly as submitProposedAction.ts composes it. */
export function composeConfirmation(summary, referenceNumber) {
  return referenceNumber
    ? `Confirmation\nRef: ${referenceNumber}\n\n${summary}`
    : `Confirmation\n\n${summary}`;
}

export async function runSimulation({
  api, task, goal, snapshot, simIndex, apiKey, pace,
  maxTurns = 14, submit = true, forceTask = false,
}) {
  const facts = await getFacts();
  const clientProfile = toClientProfile(snapshot);
  const taskFields = facts.filterFields(task, snapshot.accounts.map(a => a.type),
    snapshot.accounts.length, {});

  const transcript = [];          // what the Lambda sees (roles CUSTOMER/AGENT/SYSTEM)
  const clientView = [];          // what the customer saw
  const agentView = [];           // everything else, indexed by clientView position
  const history = [];             // the customer LLM's own memory

  const push = (role, text) => { clientView.push({ i: clientView.length, role, text }); return clientView.length - 1; };

  const opening = openingMessage(task, goal, simIndex);
  transcript.push({ role: 'CUSTOMER', content: opening, timestamp: Date.now() });
  push('you', opening);
  history.push({ role: 'assistant', content: `I said: "${opening}"` });

  const system = systemPrompt(goal, task, simIndex);
  let proposedAction = null;
  let actionTurnIndex = null;
  let sawTaskMarker = false;
  let rateLimited = false;
  let exitedWithoutAction = false;
  let routingMiss = null;

  for (let turn = 0; turn < maxTurns; turn++) {
    if (pace) await pace.beforeAgentTurn(transcript);

    const result = await api.autopilotTurn({
      transcript,
      clientProfile,
      currentIntent: goal.intentText,
      forceTaskId: forceTask && turn === 0 ? task.id : undefined,
    });

    const at = result.response ? push('agent', result.response) : null;
    agentView.push({ turnIndex: at, raw: result });

    if (result.response) {
      transcript.push({ role: 'AGENT', content: result.response, timestamp: Date.now() });
      if (HOLDING_REPLIES.includes(result.response.trim())) rateLimited = true;
    }

    // Routing: the first task the classifier picked. A miss is a real finding.
    if (result.taskIdentified && !sawTaskMarker) {
      sawTaskMarker = true;
      if (result.taskIdentified !== task.id) routingMiss = result.taskIdentified;
      transcript.push({ role: 'SYSTEM', content: `[TASK: ${result.taskIdentified}]`, timestamp: Date.now() });
    }

    if (result.proposedAction) {
      proposedAction = result.proposedAction;
      actionTurnIndex = at ?? clientView.length - 1;
      break;
    }
    if (result.shouldExitAutopilot) { exitedWithoutAction = true; break; }
    if (!result.response) break;

    const reply = await customerReply({ apiKey, system, history, agentMessage: result.response });
    if (!reply) break;
    history.push({ role: 'user', content: `Agent: "${result.response}"` },
                  { role: 'assistant', content: reply });
    transcript.push({ role: 'CUSTOMER', content: reply, timestamp: Date.now() });
    push('you', reply);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  let before = null, after = null, execResult = null, diff = null, ledgerChecks = [], identity = [];
  let summaryCheck = null;

  if (submit && proposedAction) {
    const fields = Object.fromEntries((proposedAction.fields ?? []).map(f => [f.key, f.value]));
    before = await api.snapshot(goal.clientId);
    execResult = await api.executeTask({ taskId: proposedAction.taskId, clientId: goal.clientId, fields });
    after = await api.snapshot(goal.clientId);
    diff = diffSnapshots(before, after);

    if (execResult?.success) {
      const msg = composeConfirmation(proposedAction.summary, execResult.referenceNumber);
      transcript.push({ role: 'AGENT', content: msg, timestamp: Date.now() });
      push('agent', msg);
      identity = await checkBalanceIdentity(after);
      ledgerChecks = expectationFor(goal, diff, before);
      summaryCheck = summaryAgreesWithLedger(proposedAction.summary, diff);
    }
  }

  // ── Judge it ──────────────────────────────────────────────────────────────
  const assertions = [
    ...(await assertProposedAction({ goal, proposedAction, taskFields, snapshot, task })),
    ...(execResult ? assertExecution({ result: execResult }) : []),
  ];
  const findings = await detect({ clientView, goal, snapshot, taskFields, actionTurnIndex });

  for (const p of identity) {
    findings.push({ code: 'BALANCE_IDENTITY_BROKEN', severity: 'fail', turnIndex: actionTurnIndex,
      message: `After the write, an account no longer satisfies balance = cash + holdings: ${p}`,
      evidence: '', source: 'deterministic' });
  }
  if (summaryCheck && !summaryCheck.ok) {
    findings.push({ code: 'SUMMARY_LEDGER_DISAGREEMENT', severity: 'fail',
      turnIndex: clientView.length - 1,
      message: `The confirmation the client received disagrees with the ledger — ${summaryCheck.note}.`,
      evidence: proposedAction?.summary ?? '', source: 'deterministic' });
  }
  if (execResult?.success && diff && !diff.changedAnything()) {
    findings.push({ code: 'SUCCESS_BUT_NOTHING_WROTE', severity: 'fail', turnIndex: actionTurnIndex,
      message: 'execute-task reported success and issued a reference number, but the client record did not change at all.',
      evidence: execResult.message, source: 'deterministic' });
  }
  if (routingMiss) {
    findings.push({ code: 'ROUTING_MISS', severity: 'warn', turnIndex: 0,
      message: `The classifier picked "${routingMiss}" for this opener, not "${task.id}".`,
      evidence: opening, source: 'deterministic' });
  }
  if (exitedWithoutAction) {
    findings.push({ code: 'EXITED_WITHOUT_ACTION', severity: 'fail', turnIndex: clientView.length - 1,
      message: 'The expert handed back to a human without producing a proposed action.',
      evidence: '', source: 'deterministic' });
  }

  const failed = findings.filter(f => f.severity === 'fail').length
    + assertions.filter(a => !a.ok).length
    + ledgerChecks.filter(c => !c.ok).length;

  return {
    simIndex, goal, opening, forceTask,
    clientView, agentView, transcript,
    proposedAction, execResult, before, after, diff,
    assertions, ledgerChecks, findings, summaryCheck, actionTurnIndex,
    verdict: rateLimited ? 'inconclusive' : (failed === 0 ? 'pass' : 'fail'),
    failedCount: failed,
  };
}
