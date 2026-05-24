/**
 * Heqya — Generic Reporter
 *
 * Takes run results + evaluations, produces:
 *   1. results/report-NNN.md      — human-readable quality report
 *   2. results/latest.json        — machine-readable scores
 *   3. results/NEXT_FIX.md        — actionable instructions for the next fix
 *   4. results/transcripts-NNN.json — full conversation transcripts (for UI drill-down)
 *
 * Entirely driven by the heuristics + thresholds config — no hardwired codes.
 *
 * THRESHOLDS CONFIG:
 *   thresholds.minOverallScore         — e.g. 0.80
 *   thresholds.zeroCriticalCodes       — e.g. ['H1', 'H2'] — must have 0 Fail
 *   thresholds.highSeverityPassRate    — optional { codes, minRate }
 *
 * PER-HEURISTIC THRESHOLDS:
 *   codes[code].threshold — 0-1 pass rate; null = no check
 */

import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

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

function computeOverallScore(evaluations) {
  const valid = evaluations.filter(e => !e.evaluatorError || e.aggregateScore > 0);
  if (!valid.length) return 0;
  const sum = valid.reduce((acc, e) => acc + (e.aggregateScore ?? 0), 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

// ── Threshold checks ─────────────────────────────────────────────────────────

function findCriticalFailures(evaluations, thresholds) {
  const zeroCodes = new Set(thresholds.zeroCriticalCodes ?? []);
  const out = [];
  for (const ev of evaluations) {
    for (const [code, grade] of Object.entries(ev.scores ?? {})) {
      if (zeroCodes.has(code) && grade === 'Fail') {
        out.push({ scenarioId: ev.scenarioId, code });
      }
    }
  }
  return out;
}

function checkHighSeverityPassRates(stats, thresholds) {
  const hsPct = thresholds.highSeverityPassRate;
  if (!hsPct) return [];
  const failures = [];
  for (const code of (hsPct.codes ?? [])) {
    const s = stats[code] ?? { pass: 0, marginal: 0, fail: 0 };
    const applicable = s.pass + s.marginal + s.fail;
    if (applicable === 0) continue;
    const rate = s.pass / applicable;
    if (rate < hsPct.minRate) {
      failures.push({ code, rate });
    }
  }
  return failures;
}

/**
 * Check per-heuristic pass rate thresholds (stored in codes[code].threshold).
 * Returns array of { code, name, rate, threshold } for any that fall below.
 */
export function checkPerHeuristicThresholds(stats, codes) {
  const failures = [];
  for (const [code, def] of Object.entries(codes)) {
    const threshold = def.threshold;
    if (threshold === null || threshold === undefined) continue;
    const s = stats[code] ?? { pass: 0, marginal: 0, fail: 0 };
    const applicable = s.pass + s.marginal + s.fail;
    if (applicable === 0) continue;
    const rate = s.pass / applicable;
    if (rate < threshold) {
      failures.push({
        code,
        name:      def.name ?? code,
        rate:      Math.round(rate * 100) / 100,
        threshold,
      });
    }
  }
  return failures;
}

// ── Identify top fix ──────────────────────────────────────────────────────────

function worstScenariosFor(code, evaluations, runResults, limit = 2) {
  return evaluations
    .filter(ev => ev.scores?.[code] === 'Fail')
    .map(ev => {
      const run  = runResults.find(r => r.scenarioId === ev.scenarioId);
      const note = ev.notes?.[code] ?? '';
      const agentTurns = (run?.transcript ?? [])
        .filter(m => m.role === 'agent')
        .map(m => m.content);
      return { scenarioId: ev.scenarioId, note, agentTurns };
    })
    .slice(0, limit);
}

function identifyTopFix(stats, codes, evaluations, runResults, exclude = null) {
  const sorted = Object.entries(codes)
    .sort(([, a], [, b]) => (b.weight ?? 1) - (a.weight ?? 1))
    .map(([code]) => code);

  for (const code of sorted) {
    if (code === exclude) continue;
    const s = stats[code];
    if (!s) continue;
    const applicable = s.pass + s.marginal + s.fail;
    if (applicable === 0 || s.fail === 0) continue;
    return {
      code,
      name:            codes[code].name,
      severity:        codes[code].severity ?? 'Medium',
      weight:          codes[code].weight ?? 1,
      fixGuidance:     codes[code].fixGuidance ?? null,
      failCount:       s.fail,
      applicableCount: applicable,
      worstScenarios:  worstScenariosFor(code, evaluations, runResults),
    };
  }
  return null;
}

// ── NEXT_FIX.md ───────────────────────────────────────────────────────────────

function generateNextFix(iteration, score, thresholds, topFix, secondaryFix, criticalFailures, perHeuristicFailures) {
  const below = score < thresholds.minOverallScore;

  let md = `# NEXT_FIX — Iteration ${iteration}\n\n`;
  md += `## Status\n`;
  md += `- **Overall score:** ${(score * 100).toFixed(1)}% (threshold: ${(thresholds.minOverallScore * 100).toFixed(0)}%)\n`;
  md += `- **Result:** ${below ? '✗ BELOW THRESHOLD' : '✓ THRESHOLD MET'}\n`;

  if (criticalFailures.length > 0) {
    md += `- **Critical failures:** ${criticalFailures.map(c => `${c.code} in ${c.scenarioId}`).join('; ')}\n`;
  }
  if (perHeuristicFailures.length > 0) {
    md += `- **Below per-heuristic threshold:** ${perHeuristicFailures.map(f => `${f.code} (${Math.round(f.rate * 100)}% < ${Math.round(f.threshold * 100)}%)`).join('; ')}\n`;
  }

  md += `\n---\n\n`;

  if (!topFix) {
    md += `## No fixes required — all heuristics passing.\n`;
    return md;
  }

  md += `## Primary Fix: ${topFix.code} — ${topFix.name}\n\n`;
  md += `**Severity:** ${topFix.severity}  \n`;
  md += `**Failing in:** ${topFix.failCount} of ${topFix.applicableCount} applicable scenarios\n\n`;

  if (topFix.fixGuidance) {
    md += `### Fix Guidance\n${topFix.fixGuidance}\n\n`;
  }

  if (topFix.worstScenarios.length > 0) {
    md += `### Evidence\n`;
    for (const ws of topFix.worstScenarios) {
      md += `**Scenario:** \`${ws.scenarioId}\`\n`;
      md += `**Evaluator note:** ${ws.note}\n`;
      if (ws.agentTurns.length > 0) {
        const sample = ws.agentTurns[ws.agentTurns.length - 1]?.slice(0, 300) ?? '';
        md += `**Last agent turn:**\n> ${sample.replace(/\n/g, '\n> ')}\n\n`;
      }
    }
  }

  if (!topFix.fixGuidance) {
    md += `### How to Fix\n`;
    md += `Review the evidence above and the evaluator's notes. `;
    md += `Identify the root cause in the system prompt or application logic. `;
    md += `Make a minimal, targeted change — do not refactor unrelated behavior.\n\n`;
  }

  md += `---\n\n`;

  if (secondaryFix) {
    md += `## Secondary Fix (address AFTER primary fix is confirmed)\n\n`;
    md += `**${secondaryFix.code} — ${secondaryFix.name}** (${secondaryFix.severity})\n`;
    md += `Failing in ${secondaryFix.failCount} of ${secondaryFix.applicableCount} applicable scenarios.\n\n`;
    if (secondaryFix.worstScenarios.length > 0) {
      md += `**Evaluator note:** ${secondaryFix.worstScenarios[0]?.note ?? ''}\n\n`;
    }
    if (secondaryFix.fixGuidance) {
      md += `**Fix guidance:** ${secondaryFix.fixGuidance.slice(0, 400)}\n\n`;
    }
  }

  return md;
}

// ── Human report ──────────────────────────────────────────────────────────────

function generateReport(iteration, runResults, evaluations, stats, codes, score, thresholds, criticalFailures, perHeuristicFailures) {
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const scoreStr  = `${(score * 100).toFixed(1)}%`;
  const threshold = `${(thresholds.minOverallScore * 100).toFixed(0)}%`;
  const hasCritFails = criticalFailures.length > 0;
  const hasPerFails  = perHeuristicFailures.length > 0;
  const status = score >= thresholds.minOverallScore && !hasCritFails && !hasPerFails
    ? '✓ THRESHOLD MET' : '✗ BELOW THRESHOLD';

  let md = `# Heqya Quality Report — Iteration ${iteration} — ${timestamp}\n\n`;
  md += `## Overall Score: ${scoreStr} / 100%  —  ${status} (threshold: ${threshold})\n\n`;

  if (hasCritFails) {
    md += `⚠️  **Critical failures detected:** ${criticalFailures.map(c => `${c.code} in \`${c.scenarioId}\``).join(', ')}\n\n`;
  }
  if (hasPerFails) {
    md += `⚠️  **Below per-heuristic threshold:** ${perHeuristicFailures.map(f => `${f.code} ${f.name} (${Math.round(f.rate * 100)}% of scenarios pass, needs ${Math.round(f.threshold * 100)}%)`).join('; ')}\n\n`;
  }

  // Heuristic summary table
  md += `## Heuristic Summary\n\n`;
  md += `| Code | Name | Severity | Weight | Threshold | Pass | Marginal | Fail | N/A |\n`;
  md += `|------|------|----------|--------|-----------|------|----------|------|-----|\n`;

  for (const [code, def] of Object.entries(codes)) {
    const s        = stats[code] ?? { pass: 0, marginal: 0, fail: 0, na: 0 };
    const failMark = s.fail > 0 ? `**${s.fail}**` : s.fail;
    const thr      = def.threshold != null ? `${Math.round(def.threshold * 100)}%` : '—';
    md += `| ${code} | ${def.name} | ${def.severity ?? ''} | ×${def.weight ?? 1} | ${thr} | ${s.pass} | ${s.marginal} | ${failMark} | ${s.na} |\n`;
  }

  // Per-scenario results
  md += `\n## Scenario Results\n\n`;

  for (const ev of evaluations) {
    const run   = runResults.find(r => r.scenarioId === ev.scenarioId);
    const pct   = (ev.aggregateScore * 100).toFixed(0);
    const fails = Object.entries(ev.scores ?? {}).filter(([, g]) => g === 'Fail').map(([c]) => c);

    md += `### \`${ev.scenarioId}\`\n`;
    md += `**Score:** ${pct}%  |  **Turns:** ${run?.turnCount ?? '?'}  |  **Exit:** ${run?.exitReason ?? '?'}\n\n`;

    if (ev.evaluatorError) {
      md += `**Evaluator error:** ${ev.evaluatorError}\n\n`;
    } else if (fails.length > 0) {
      md += `**Failed heuristics:** ${fails.map(c => `${c} (${codes[c]?.name ?? c})`).join(', ')}\n\n`;
      for (const c of fails) {
        const note = ev.notes?.[c];
        if (note) md += `- **${c}:** ${note}\n`;
      }
    } else {
      md += `**All applicable heuristics passed.**\n\n`;
    }

    const agentTurns = (run?.transcript ?? []).filter(m => m.role === 'agent');
    if (agentTurns.length > 0) {
      const lastTurn = agentTurns[agentTurns.length - 1]?.content?.slice(0, 200) ?? '';
      md += `\n*Last agent message excerpt:* "${lastTurn}…"\n`;
    }

    md += `\n`;
  }

  return md;
}

// ── Write all outputs ─────────────────────────────────────────────────────────

/**
 * Write report-NNN.md, latest.json, NEXT_FIX.md, and transcripts-NNN.json.
 *
 * @param {object}   opts
 * @param {number}   opts.iteration
 * @param {object[]} opts.runResults
 * @param {object[]} opts.evaluations
 * @param {object}   opts.heuristics     - { document, codes, domainKnowledge? }
 * @param {object}   opts.thresholds
 * @param {string}   opts.resultsDir
 * @returns {{ score, criticalFailures, perHeuristicFailures, thresholdMet, topFix, reportFile, stats }}
 */
export function writeReports({ iteration, runResults, evaluations, heuristics, thresholds, resultsDir }) {
  mkdirSync(resultsDir, { recursive: true });

  const { codes } = heuristics;
  const stats              = aggregateByCode(evaluations, codes);
  const score              = computeOverallScore(evaluations);
  const critFails          = findCriticalFailures(evaluations, thresholds);
  const highSevFails       = checkHighSeverityPassRates(stats, thresholds);
  const perHeuristicFails  = checkPerHeuristicThresholds(stats, codes);

  const topFix = identifyTopFix(stats, codes, evaluations, runResults);
  const secFix = topFix ? identifyTopFix(stats, codes, evaluations, runResults, topFix.code) : null;

  const allThresholdsMet =
    score              >= thresholds.minOverallScore &&
    critFails.length   === 0 &&
    highSevFails.length === 0 &&
    perHeuristicFails.length === 0;

  // 1. Human report
  const reportMd   = generateReport(iteration, runResults, evaluations, stats, codes, score, thresholds, critFails, perHeuristicFails);
  const reportFile = path.join(resultsDir, `report-${String(iteration).padStart(3, '0')}.md`);
  writeFileSync(reportFile, reportMd, 'utf8');

  // 2. Machine-readable JSON
  const latestJson = {
    iteration,
    timestamp:            new Date().toISOString(),
    overallScore:         score,
    thresholdMet:         allThresholdsMet,
    criticalFailures:     critFails,
    highSeverityFailures: highSevFails,
    perHeuristicFailures: perHeuristicFails,
    heuristicStats:       stats,
    scenarios:            evaluations,
  };
  writeFileSync(path.join(resultsDir, 'latest.json'), JSON.stringify(latestJson, null, 2), 'utf8');

  // 3. NEXT_FIX.md
  const nextFixMd = generateNextFix(iteration, score, thresholds, topFix, secFix, critFails, perHeuristicFails);
  writeFileSync(path.join(resultsDir, 'NEXT_FIX.md'), nextFixMd, 'utf8');

  // 4. Transcripts — full conversation data for UI drill-down
  const transcripts = runResults.map(r => ({
    scenarioId: r.scenarioId,
    transcript: r.transcript ?? [],
    turnCount:  r.turnCount,
    exitReason: r.exitReason,
    durationMs: r.durationMs,
    error:      r.error ?? null,
  }));
  writeFileSync(
    path.join(resultsDir, `transcripts-${String(iteration).padStart(3, '0')}.json`),
    JSON.stringify(transcripts, null, 2),
    'utf8'
  );

  return {
    score,
    criticalFailures:    critFails,
    highSeverityFailures: highSevFails,
    perHeuristicFailures: perHeuristicFails,
    thresholdMet:        allThresholdsMet,
    topFix,
    reportFile,
    stats,
  };
}

// Re-export for convenience
export { checkHighSeverityPassRates };
