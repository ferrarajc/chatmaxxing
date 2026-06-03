/**
 * Heqya — Generic Reporter
 *
 * Takes run results + evaluations, produces:
 *   1. results/report-NNN.md        — human-readable quality report
 *   2. results/latest.json          — machine-readable scores
 *   3. results/NEXT_FIX.md          — AI-generated fix guidance
 *   4. results/fixes.json           — structured fix recommendations (for UI)
 *   5. results/transcripts-NNN.json — full conversation transcripts (for UI drill-down)
 *
 * Entirely driven by the heuristics config — no hardwired codes or thresholds.
 *
 * SCORE FORMULA:
 *   overallScore = # conversations with zero Fail grades / total conversations
 *   A conversation passes if every applicable heuristic returned Pass, Marginal, or N/A.
 */

import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// ── Aggregate heuristic statistics ────────────────────────────────────────────

function aggregateByCode(evaluations, codes) {
  const stats = {};
  for (const code of Object.keys(codes)) {
    stats[code] = { pass: 0, marginal: 0, fail: 0, na: 0, total: 0 };
  }
  for (const ev of evaluations) {
    for (const [code, grade] of Object.entries(ev.scores ?? {})) {
      if (!stats[code]) continue;
      stats[code].total++;
      if      (grade === 'Pass')     stats[code].pass++;
      else if (grade === 'Marginal') stats[code].marginal++;
      else if (grade === 'Fail')     stats[code].fail++;
      else                           stats[code].na++;
    }
  }
  return stats;
}

// ── Score: binary pass (no Fail grades) / total ───────────────────────────────

function computeOverallScore(evaluations) {
  if (!evaluations.length) return 0;
  const passed = evaluations.filter(ev => {
    if (ev.evaluatorError) return false;
    return !Object.values(ev.scores ?? {}).some(g => g === 'Fail');
  }).length;
  return Math.round((passed / evaluations.length) * 100) / 100;
}

// ── AI-generated fix guidance ─────────────────────────────────────────────────

/**
 * Generate structured fix recommendations from the observed failures.
 *
 * @param {object[]} evaluations   - EvalResult[]
 * @param {object[]} runResults    - RunResult[]
 * @param {object}   heuristics    - { document, codes, domainKnowledge? }
 * @param {object}   llm           - { apiKey, baseUrl?, evaluatorModel? }
 * @returns {Promise<Array<{title: string, body: string}>>}
 */
async function generateAIFixGuidance(evaluations, runResults, heuristics, llm) {
  const { codes } = heuristics;

  // Collect per-heuristic failure info
  const failingHeuristics = [];
  for (const [code, def] of Object.entries(codes)) {
    const failures = evaluations.filter(ev => ev.scores?.[code] === 'Fail' || ev.scores?.[code] === 'Marginal');
    if (!failures.length) continue;

    const examples = failures.slice(0, 3).map(ev => {
      const run = runResults.find(r => r.scenarioId === ev.scenarioId);
      const note = ev.notes?.[code] ?? '';
      const violatedIdxs = ev.violatedTurns?.[code] ?? [];
      const excerpts = violatedIdxs.slice(0, 2).map(i => {
        const msg = run?.transcript?.[i];
        if (!msg) return null;
        const role = msg.role === 'customer' ? 'CUSTOMER' : 'BOT';
        return `  [Turn ${i}] ${role}: "${(msg.content ?? '').slice(0, 300)}"`;
      }).filter(Boolean);
      return `  Scenario: ${ev.scenarioId}\n  Note: ${note}\n${excerpts.join('\n')}`;
    }).join('\n\n');

    failingHeuristics.push({
      code,
      name:      def.name,
      criterion: def.criterion ?? '',
      failures:  failures.length,
      total:     evaluations.filter(ev => ev.scores?.[code] && ev.scores[code] !== 'N/A').length,
      examples,
    });
  }

  if (!failingHeuristics.length) {
    return [{ title: 'No fixes required', body: 'All heuristics passed in this run.' }];
  }

  const systemPrompt = [
    'You are an expert in AI chatbot quality improvement.',
    'You will receive a list of heuristics that failed in an evaluation run,',
    'along with specific examples of failure from the conversation transcripts.',
    '',
    'Your task: write specific, actionable fix recommendations grounded in the observed failures.',
    'Each fix should name exactly what needs to change in the system prompt or application logic.',
    'Be concrete — reference specific turns, patterns, or phrasings from the evidence.',
    'Do not give generic advice.',
    '',
    'Return ONLY a JSON object with key "fixes" containing an array.',
    'Each element: { "title": "short title (≤8 words)", "body": "detailed fix text (2-5 sentences)" }',
    'Maximum 4 fixes total. Combine related failures into one fix where sensible.',
  ].join('\n');

  const userMessage = [
    '## Failing Heuristics and Observed Evidence',
    '',
    ...failingHeuristics.map(h => [
      `### ${h.code} — ${h.name}`,
      `Failing in ${h.failures} of ${h.total} applicable scenarios.`,
      `Criterion: ${h.criterion}`,
      '',
      'Evidence from failing scenarios:',
      h.examples,
    ].join('\n')),
    '',
    'Write fix recommendations based on this specific evidence.',
  ].join('\n');

  try {
    const res = await fetch(llm.baseUrl ?? OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llm.apiKey}`,
      },
      body: JSON.stringify({
        model:           llm.evaluatorModel ?? 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage  },
        ],
        max_tokens:      1200,
        temperature:     0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Fix guidance LLM error (HTTP ${res.status}): ${err}`);
    }

    const data   = await res.json();
    const raw    = data.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);
    const fixes  = parsed.fixes ?? [];
    if (Array.isArray(fixes) && fixes.length > 0) return fixes;
    return [{ title: 'Review failures', body: 'See report for details.' }];
  } catch (err) {
    console.error(`  ⚠ Fix guidance generation failed: ${err.message}`);
    // Fallback: build simple fixes from the failure data
    return failingHeuristics.map(h => ({
      title: `Fix ${h.code} — ${h.name}`,
      body:  `${h.code} failed in ${h.failures} of ${h.total} applicable scenarios. Review the evidence above and update the system prompt to address: ${h.criterion}`,
    }));
  }
}

// ── NEXT_FIX.md from structured fixes ─────────────────────────────────────────

function fixesToMarkdown(iteration, score, threshold, fixes, stats, codes) {
  const below = score < threshold;
  let md = `# NEXT_FIX — Iteration ${iteration}\n\n`;
  md += `## Status\n`;
  md += `- **Overall score:** ${(score * 100).toFixed(1)}%  (threshold: ${Math.round(threshold * 100)}%)\n`;
  md += `- **Result:** ${below ? '✗ BELOW THRESHOLD' : '✓ THRESHOLD MET'}\n\n`;

  // Heuristic summary
  const failing = Object.entries(codes)
    .map(([code, def]) => {
      const s = stats[code] ?? { pass: 0, marginal: 0, fail: 0, na: 0 };
      const applicable = s.pass + s.marginal + s.fail;
      return { code, name: def.name, fail: s.fail, marginal: s.marginal, applicable };
    })
    .filter(h => h.fail > 0 || h.marginal > 0);

  if (failing.length > 0) {
    md += `## Heuristics With Issues\n\n`;
    for (const h of failing) {
      const parts = [];
      if (h.fail > 0) parts.push(`${h.fail} fail`);
      if (h.marginal > 0) parts.push(`${h.marginal} marginal`);
      md += `- **${h.code} — ${h.name}**: ${parts.join(', ')} of ${h.applicable} applicable\n`;
    }
    md += '\n---\n\n';
  }

  md += `## Proposed Fixes\n\n`;
  for (const fix of fixes) {
    md += `### ${fix.title}\n\n${fix.body}\n\n`;
  }

  return md;
}

// ── Human report ──────────────────────────────────────────────────────────────

function generateReport(iteration, runResults, evaluations, stats, codes, score, threshold) {
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const scoreStr  = `${(score * 100).toFixed(1)}%`;
  const threshStr = `${Math.round(threshold * 100)}%`;
  const passed    = evaluations.filter(ev => !Object.values(ev.scores ?? {}).some(g => g === 'Fail')).length;
  const status    = score >= threshold ? '✓ THRESHOLD MET' : '✗ BELOW THRESHOLD';

  let md = `# Heqya Quality Report — Iteration ${iteration} — ${timestamp}\n\n`;
  md += `## Overall Score: ${scoreStr} / 100%  —  ${status} (threshold: ${threshStr})\n\n`;
  md += `**${passed} of ${evaluations.length} conversations passed all heuristics.**\n\n`;

  // Heuristic summary table
  md += `## Heuristic Summary\n\n`;
  md += `| Code | Name | Pass | Marginal | Fail | N/A |\n`;
  md += `|------|------|------|----------|------|-----|\n`;

  for (const [code, def] of Object.entries(codes)) {
    const s        = stats[code] ?? { pass: 0, marginal: 0, fail: 0, na: 0 };
    const failMark = s.fail > 0 ? `**${s.fail}**` : s.fail;
    md += `| ${code} | ${def.name} | ${s.pass} | ${s.marginal} | ${failMark} | ${s.na} |\n`;
  }

  // Per-scenario results
  md += `\n## Scenario Results\n\n`;

  for (const ev of evaluations) {
    const run   = runResults.find(r => r.scenarioId === ev.scenarioId);
    const fails = Object.entries(ev.scores ?? {}).filter(([, g]) => g === 'Fail').map(([c]) => c);
    const margs = Object.entries(ev.scores ?? {}).filter(([, g]) => g === 'Marginal').map(([c]) => c);
    const ok    = !ev.evaluatorError && fails.length === 0;

    md += `### \`${ev.scenarioId}\`\n`;
    md += `**Turns:** ${run?.turnCount ?? '?'}  |  **Exit:** ${run?.exitReason ?? '?'}  |  **Result:** ${ok ? '✓ Pass' : '✗ Fail'}\n\n`;

    if (ev.evaluatorError) {
      md += `**Evaluator error:** ${ev.evaluatorError}\n\n`;
    } else if (fails.length > 0 || margs.length > 0) {
      if (fails.length > 0) {
        md += `**Failed:** ${fails.map(c => `${c} (${codes[c]?.name ?? c})`).join(', ')}\n\n`;
        for (const c of fails) {
          const note = ev.notes?.[c];
          if (note) md += `- **${c}:** ${note}\n`;
        }
      }
      if (margs.length > 0) {
        md += `**Marginal:** ${margs.map(c => `${c} (${codes[c]?.name ?? c})`).join(', ')}\n\n`;
        for (const c of margs) {
          const note = ev.notes?.[c];
          if (note) md += `- **${c}:** ${note}\n`;
        }
      }
    } else {
      md += `**All applicable heuristics passed.**\n\n`;
    }

    const agentTurns = (run?.transcript ?? []).filter(m => m.role === 'agent');
    if (agentTurns.length > 0) {
      const lastTurn = agentTurns[agentTurns.length - 1]?.content?.slice(0, 300) ?? '';
      md += `\n*Last agent message:* "${lastTurn}${lastTurn.length >= 300 ? '…' : ''}"\n`;
    }

    md += `\n`;
  }

  return md;
}

// ── Write all outputs ─────────────────────────────────────────────────────────

/**
 * Write report-NNN.md, latest.json, NEXT_FIX.md, fixes.json, and transcripts-NNN.json.
 *
 * @param {object}   opts
 * @param {number}   opts.iteration
 * @param {object[]} opts.runResults
 * @param {object[]} opts.evaluations
 * @param {object}   opts.heuristics     - { document, codes, domainKnowledge? }
 * @param {object}   opts.thresholds     - { minOverallScore }
 * @param {string}   opts.resultsDir
 * @param {object}   [opts.llm]          - { apiKey, evaluatorModel? } — required for AI fix guidance
 * @returns {Promise<{ score, thresholdMet, reportFile, stats, fixes }>}
 */
export async function writeReports({ iteration, runResults, evaluations, heuristics, thresholds, resultsDir, llm }) {
  mkdirSync(resultsDir, { recursive: true });

  const { codes } = heuristics;
  const threshold = thresholds?.minOverallScore ?? 0.80;
  const stats     = aggregateByCode(evaluations, codes);
  const score     = computeOverallScore(evaluations);
  const thresholdMet = score >= threshold;

  // 1. AI-generated fix guidance
  let fixes = [{ title: 'No fixes required', body: 'All heuristics passed in this run.' }];
  if (!thresholdMet && llm?.apiKey) {
    process.stdout.write('  Generating AI fix guidance…\n');
    fixes = await generateAIFixGuidance(evaluations, runResults, heuristics, llm);
  } else if (!thresholdMet) {
    // Fallback if no LLM config
    const failing = Object.entries(codes).filter(([code]) => (stats[code]?.fail ?? 0) > 0);
    fixes = failing.map(([code, def]) => ({
      title: `Fix ${code} — ${def.name}`,
      body:  `${code} failed in ${stats[code].fail} of ${stats[code].pass + stats[code].marginal + stats[code].fail} scenarios. Review the evaluation notes and update the system prompt.`,
    }));
  }

  // 2. Human report
  const reportMd   = generateReport(iteration, runResults, evaluations, stats, codes, score, threshold);
  const reportFile = path.join(resultsDir, `report-${String(iteration).padStart(3, '0')}.md`);
  writeFileSync(reportFile, reportMd, 'utf8');

  // 3. Machine-readable JSON (includes violatedTurns per scenario)
  const latestJson = {
    iteration,
    timestamp:   new Date().toISOString(),
    overallScore: score,
    thresholdMet,
    heuristicStats: stats,
    scenarios:   evaluations.map(ev => ({
      scenarioId:    ev.scenarioId,
      scores:        ev.scores ?? {},
      notes:         ev.notes  ?? {},
      violatedTurns: ev.violatedTurns ?? {},
      aggregateScore: ev.aggregateScore ?? 0,
      evaluatorError: ev.evaluatorError ?? null,
    })),
  };
  writeFileSync(path.join(resultsDir, 'latest.json'), JSON.stringify(latestJson, null, 2), 'utf8');

  // 4. NEXT_FIX.md
  const nextFixMd = fixesToMarkdown(iteration, score, threshold, fixes, stats, codes);
  writeFileSync(path.join(resultsDir, 'NEXT_FIX.md'), nextFixMd, 'utf8');

  // 5. Structured fixes (for UI editable areas)
  writeFileSync(path.join(resultsDir, 'fixes.json'), JSON.stringify(fixes, null, 2), 'utf8');

  // 6. Transcripts — full conversation data for UI drill-down
  const transcripts = runResults.map(r => {
    const ev = evaluations.find(e => e.scenarioId === r.scenarioId);
    return {
      scenarioId:    r.scenarioId,
      transcript:    r.transcript ?? [],
      turnCount:     r.turnCount,
      exitReason:    r.exitReason,
      durationMs:    r.durationMs,
      error:         r.error ?? null,
      violatedTurns: ev?.violatedTurns ?? {},
    };
  });
  writeFileSync(
    path.join(resultsDir, `transcripts-${String(iteration).padStart(3, '0')}.json`),
    JSON.stringify(transcripts, null, 2),
    'utf8'
  );

  return {
    score,
    thresholdMet,
    reportFile,
    stats,
    fixes,
  };
}
