/**
 * Heqya — AI Conversation Quality Evaluation Loop
 *
 * Main exports. See README.md for quick start.
 */

export { runScenario, runAllScenarios }       from './core/runner.mjs';
export { evaluateConversation, evaluateAll, computeAggregateScore } from './core/evaluator.mjs';
export { writeReports, checkHighSeverityPassRates }                 from './core/reporter.mjs';
export { runLoop }                            from './core/loop.mjs';
export { createHttpJsonAdapter }              from './adapters/http-json.mjs';
