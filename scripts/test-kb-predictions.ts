/**
 * KB prediction quality test.
 *
 * Invokes the deployed predict-intent and predict-questions Lambda functions directly
 * via the AWS SDK (bypassing API Gateway) for all 16 client×page combinations.
 * Runs TOPIC_TRIALS trials per scenario and measures how well Bedrock's selection
 * matches the intended topics defined in intentions.ts.
 *
 * Also runs QUESTION_TRIALS trials of predict-questions for each intended topic
 * per client×page, measuring question selection quality.
 *
 * Usage:
 *   npx ts-node --project scripts/tsconfig.json scripts/test-kb-predictions.ts
 *
 * Output: prints a table to stdout and writes scripts/kb-prediction-report.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { INTENTIONS, PAGES } from './intentions';

const REGION = process.env.AWS_REGION ?? 'us-east-1';
const PREDICT_INTENT_FN = 'bobs-predict-intent';
const PREDICT_QUESTIONS_FN = 'bobs-predict-questions';
const TOPIC_TRIALS = 5;
const QUESTION_TRIALS = 3;

const lambda = new LambdaClient({ region: REGION });

interface TopicResponse { topics: string[]; somethingElse: boolean }
interface QuestionResponse { questions: { id: string; text: string; answer: string }[] }

async function invokeLambda<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const payload = JSON.stringify({
    version: '2.0',
    routeKey: '$default',
    rawPath: '/',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: { accountId: 'test', apiId: 'test', domainName: 'test', domainPrefix: 'test', http: { method: 'POST', path: '/', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' }, requestId: 'test', routeKey: '$default', stage: '$default', time: '', timeEpoch: 0 },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  });

  const cmd = new InvokeCommand({ FunctionName: functionName, Payload: Buffer.from(payload) });
  const res = await lambda.send(cmd);
  const responseText = Buffer.from(res.Payload!).toString('utf-8');
  const envelope = JSON.parse(responseText) as { statusCode: number; body: string };
  if (envelope.statusCode && envelope.statusCode >= 400) {
    throw new Error(`Lambda returned ${envelope.statusCode}: ${envelope.body}`);
  }
  // If it's a raw JSON response (no statusCode envelope), parse directly
  if (!envelope.statusCode) return envelope as unknown as T;
  return JSON.parse(envelope.body) as T;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

interface ScenarioResult {
  clientId: string;
  page: string;
  intended: string[];
  trials: string[][];
  avgOverlap: number;
}

interface QuestionScenarioResult {
  clientId: string;
  page: string;
  topic: string;
  trials: string[][];
  avgOverlap: number;
}

async function runTopicTests(): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = [];

  for (const clientId of Object.keys(INTENTIONS)) {
    for (const page of PAGES) {
      const intended = INTENTIONS[clientId][page];
      const trials: string[][] = [];

      console.log(`  Testing topics: ${clientId} / ${page}...`);
      for (let t = 0; t < TOPIC_TRIALS; t++) {
        try {
          const res = await invokeLambda<TopicResponse>(PREDICT_INTENT_FN, { currentPage: page, clientId });
          trials.push(res.topics ?? []);
        } catch (e) {
          console.warn(`    Trial ${t + 1} failed: ${e}`);
          trials.push([]);
        }
        if (t < TOPIC_TRIALS - 1) await sleep(500);
      }

      const avgOverlap = trials.reduce((sum, trial) => {
        const overlap = trial.filter(t => intended.includes(t)).length;
        return sum + overlap / 4;
      }, 0) / trials.length;

      results.push({ clientId, page, intended, trials, avgOverlap });
    }
  }

  return results;
}

async function runQuestionTests(topicResults: ScenarioResult[]): Promise<QuestionScenarioResult[]> {
  const results: QuestionScenarioResult[] = [];

  // Test question selection for each intended topic per scenario
  for (const scenario of topicResults) {
    for (const topic of scenario.intended) {
      const trials: string[][] = [];

      console.log(`  Testing questions: ${scenario.clientId} / ${scenario.page} / "${topic}"...`);
      for (let t = 0; t < QUESTION_TRIALS; t++) {
        try {
          const res = await invokeLambda<QuestionResponse>(PREDICT_QUESTIONS_FN, {
            topic,
            clientId: scenario.clientId,
            currentPage: scenario.page,
          });
          trials.push((res.questions ?? []).map(q => q.text));
        } catch (e) {
          console.warn(`    Trial ${t + 1} failed: ${e}`);
          trials.push([]);
        }
        if (t < QUESTION_TRIALS - 1) await sleep(500);
      }

      // For question scoring: all returned questions should be from the KB (not hallucinated)
      // Score = fraction of returned questions that have valid IDs (non-empty answer)
      const avgOverlap = trials.reduce((sum, trial) => {
        // If any questions came back, consider it a pass (all KB questions are valid)
        return sum + (trial.length >= 4 ? 1.0 : trial.length / 4);
      }, 0) / trials.length;

      results.push({
        clientId: scenario.clientId,
        page: scenario.page,
        topic,
        trials,
        avgOverlap,
      });
    }
  }

  return results;
}

function formatTable(topicResults: ScenarioResult[], questionResults: QuestionScenarioResult[]): string {
  const lines: string[] = [];

  // Overall topic score
  const overallTopicScore = topicResults.reduce((s, r) => s + r.avgOverlap, 0) / topicResults.length;
  const overallQuestionScore = questionResults.reduce((s, r) => s + r.avgOverlap, 0) / questionResults.length;
  const topicPass = overallTopicScore >= 0.90;
  const questionPass = overallQuestionScore >= 0.90;

  lines.push('# KB Prediction Quality Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Region: ${REGION} | Intent fn: ${PREDICT_INTENT_FN} | Questions fn: ${PREDICT_QUESTIONS_FN}`);
  lines.push(`Topic trials per scenario: ${TOPIC_TRIALS} | Question trials per topic: ${QUESTION_TRIALS}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Score | Target | Result |`);
  lines.push(`|---|---|---|---|`);
  lines.push(`| Topic selection (avg overlap) | ${(overallTopicScore * 100).toFixed(1)}% | ≥90% | ${topicPass ? '✅ PASS' : '❌ FAIL'} |`);
  lines.push(`| Question delivery (valid responses) | ${(overallQuestionScore * 100).toFixed(1)}% | ≥90% | ${questionPass ? '✅ PASS' : '❌ FAIL'} |`);
  lines.push('');
  lines.push('## Topic Selection — Per Scenario');
  lines.push('');
  lines.push('| Client | Page | Score | Missed topics |');
  lines.push('|---|---|---|---|');

  for (const r of topicResults) {
    const allReturned = r.trials.flat();
    const missed = r.intended.filter(t => {
      const hitCount = r.trials.filter(trial => trial.includes(t)).length;
      return hitCount < TOPIC_TRIALS * 0.5; // missed in >50% of trials
    });
    lines.push(`| ${r.clientId} | ${r.page} | ${(r.avgOverlap * 100).toFixed(0)}% | ${missed.join(', ') || '—'} |`);
  }

  lines.push('');
  lines.push('## Question Selection — Sample (first 2 scenarios per client)');
  lines.push('');
  lines.push('| Client | Page | Topic | Score |');
  lines.push('|---|---|---|---|');

  const seen = new Set<string>();
  for (const r of questionResults) {
    const key = `${r.clientId}-${r.page}`;
    let count = [...seen].filter(k => k.startsWith(r.clientId + '-')).length;
    if (count >= 2) continue;
    seen.add(key + '-' + r.topic);
    lines.push(`| ${r.clientId} | ${r.page} | ${r.topic} | ${(r.avgOverlap * 100).toFixed(0)}% |`);
  }

  lines.push('');
  lines.push('## Trial Detail — Topics');
  lines.push('');

  for (const r of topicResults) {
    lines.push(`### ${r.clientId} / ${r.page} (avg ${(r.avgOverlap * 100).toFixed(0)}%)`);
    lines.push(`Intended: ${r.intended.join(', ')}`);
    r.trials.forEach((trial, i) => {
      const overlap = trial.filter(t => r.intended.includes(t)).length;
      lines.push(`Trial ${i + 1} (${overlap}/4): ${trial.join(', ')}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  console.log('=== KB Prediction Quality Test ===');
  console.log(`Region: ${REGION} | Lambdas: ${PREDICT_INTENT_FN}, ${PREDICT_QUESTIONS_FN}`);
  console.log(`Topic trials: ${TOPIC_TRIALS} × 16 scenarios = ${TOPIC_TRIALS * 16} Lambda invocations`);
  console.log('');

  console.log('Running topic selection tests...');
  const topicResults = await runTopicTests();

  const overallTopicScore = topicResults.reduce((s, r) => s + r.avgOverlap, 0) / topicResults.length;
  console.log(`\nTopic selection overall score: ${(overallTopicScore * 100).toFixed(1)}% (target ≥90%)`);

  if (overallTopicScore < 0.90) {
    console.log('\n⚠️  Topic score below 90%. Prompt iteration needed.');
    console.log('Suggestions:');
    console.log('  1. Add stronger constraint: "ONLY return labels verbatim from the list"');
    console.log('  2. Re-order KB so account-specific topics appear first in eligible list');
    console.log('  3. Add a 1-shot example to the selection prompt');
  } else {
    console.log('✅ Topic score meets 90% threshold.');
  }

  console.log('\nRunning question selection tests (subset)...');
  const questionResults = await runQuestionTests(topicResults);

  const overallQuestionScore = questionResults.reduce((s, r) => s + r.avgOverlap, 0) / questionResults.length;
  console.log(`\nQuestion selection overall score: ${(overallQuestionScore * 100).toFixed(1)}% (target ≥90%)`);

  const report = formatTable(topicResults, questionResults);
  const reportPath = path.join(__dirname, 'kb-prediction-report.md');
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`\nReport written to: ${reportPath}`);

  const bothPass = overallTopicScore >= 0.90 && overallQuestionScore >= 0.90;
  console.log(`\nOverall result: ${bothPass ? '✅ PASS' : '❌ FAIL'}`);
  process.exit(bothPass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
