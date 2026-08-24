// ── The report ───────────────────────────────────────────────────────────────
//
// One self-contained HTML file, opened from disk. No server, no build step, no CDN.
//
// The old suite printed `fund wrong: "undefined"` and threw the transcript away — it
// built the whole conversation and then discarded it, so every failure cost a re-run to
// understand. The transcript IS the product here: everything else is navigation.
//
// Pure function of the run object, so `--report-only run.json` re-renders without
// re-running. The renderer can be iterated for free.

import { fixFor } from './fixes.mjs';

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SEV = {
  fail:         { label: 'FAIL',     cls: 'sev-fail' },
  warn:         { label: 'WARN',     cls: 'sev-warn' },
  inconclusive: { label: 'INFRA',    cls: 'sev-infra' },
  advisory:     { label: 'ADVISORY', cls: 'sev-adv' },
};

const CSS = `
:root{--bg:#0f1117;--panel:#171a23;--panel2:#1e222d;--line:#2a2f3d;--text:#e6e9ef;--dim:#98a0b3;
--fail:#ff6b6b;--warn:#f5b455;--adv:#5aa9e6;--ok:#4ec9a0;--infra:#8b93a7;--you:#243044;--agent:#1c2431;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.55 -apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:1000px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:22px;margin:0 0 4px} h2{font-size:17px;margin:32px 0 12px}
.sub{color:var(--dim);font-size:13px}
.banner{background:#1a2b22;border:1px solid #2c4a3a;color:#a7e0c4;padding:10px 14px;border-radius:8px;margin:16px 0;font-size:13px}
.verdict{display:flex;gap:10px;margin:16px 0;flex-wrap:wrap}
.pill{padding:6px 12px;border-radius:999px;font-weight:600;font-size:13px;border:1px solid var(--line);background:var(--panel)}
.pill.pass{color:var(--ok);border-color:#245c47} .pill.fail{color:var(--fail);border-color:#5c2424}
.pill.infra{color:var(--infra)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;margin:12px 0}
.sev-fail{color:var(--fail)} .sev-warn{color:var(--warn)} .sev-adv{color:var(--adv)} .sev-infra{color:var(--infra)}
.tag{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.4px;padding:2px 7px;border-radius:4px;border:1px solid currentColor}
.summary-row{border-bottom:1px solid var(--line);padding:14px 0}
.summary-row:last-child{border-bottom:0}
.where{color:var(--dim);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}
.fixnote{background:var(--panel2);border-left:3px solid var(--line);padding:10px 12px;margin-top:8px;border-radius:0 6px 6px 0}
.disclaim{color:var(--warn);font-size:12px;margin-top:6px}
details{margin:10px 0} summary{cursor:pointer;padding:10px 14px;background:var(--panel);border:1px solid var(--line);border-radius:8px;font-weight:600}
summary::-webkit-details-marker{color:var(--dim)}
.turns{padding:8px 0 0 0}
.turn{margin:10px 0;display:flex;gap:10px}
.turn .who{flex:0 0 62px;color:var(--dim);font-size:12px;padding-top:6px;text-align:right}
.bubble{background:var(--agent);border:1px solid var(--line);border-radius:10px;padding:9px 13px;white-space:pre-wrap;max-width:78%}
.turn.you .bubble{background:var(--you);margin-left:auto}
.turn.you{flex-direction:row-reverse}
.turn.you .who{text-align:left}
.ann{margin:6px 0 0 72px;border-left:3px solid;padding:8px 12px;background:var(--panel2);border-radius:0 6px 6px 0;font-size:13px}
.ann.sev-fail{border-color:var(--fail)} .ann.sev-warn{border-color:var(--warn)}
.ann.sev-adv{border-color:var(--adv)} .ann.sev-infra{border-color:var(--infra)}
.ann .code{font-weight:700;font-size:11px;letter-spacing:.4px}
table{border-collapse:collapse;width:100%;font-size:13px;margin-top:8px}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--line)}
th{color:var(--dim);font-weight:600}
td.ok{color:var(--ok)} td.no{color:var(--fail)}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:var(--dim)}
.agentonly{color:var(--dim);font-size:12px}
pre{background:#11141b;border:1px solid var(--line);border-radius:8px;padding:10px;overflow:auto;font-size:12px;max-height:340px}
`;

function annotationsFor(sim) {
  const all = [
    ...sim.findings.map(f => ({ ...f })),
    ...(sim.judgeAnnotations ?? []),
  ];
  const byTurn = new Map();
  for (const a of all) {
    const k = a.turnIndex ?? -1;
    if (!byTurn.has(k)) byTurn.set(k, []);
    byTurn.get(k).push(a);
  }
  return byTurn;
}

function renderTurns(sim) {
  const byTurn = annotationsFor(sim);
  let html = '<div class="turns">';
  for (const t of sim.clientView) {
    html += `<div class="turn ${t.role}"><div class="who">${t.role === 'you' ? 'Client' : 'Agent'}</div>` +
            `<div class="bubble">${esc(t.text)}</div></div>`;
    for (const a of byTurn.get(t.i) ?? []) {
      const s = SEV[a.severity] ?? SEV.warn;
      html += `<div class="ann ${s.cls}"><span class="code">${s.label} · ${esc(a.code)}</span>` +
              `${a.noteId ? ` <span class="agentonly">(${esc(a.noteId)}${a.confidence ? `, ${esc(a.confidence)} confidence` : ''})</span>` : ''}` +
              `<div>${esc(a.message)}</div></div>`;
    }
  }
  // Anything not anchored to a turn.
  for (const a of byTurn.get(-1) ?? []) {
    const s = SEV[a.severity] ?? SEV.warn;
    html += `<div class="ann ${s.cls}"><span class="code">${s.label} · ${esc(a.code)}</span><div>${esc(a.message)}</div></div>`;
  }
  return html + '</div>';
}

function renderSim(sim) {
  const v = sim.verdict;
  const badge = v === 'pass' ? '<span class="pill pass">PASS</span>'
    : v === 'inconclusive' ? '<span class="pill infra">INCONCLUSIVE</span>'
    : `<span class="pill fail">FAIL (${sim.failedCount})</span>`;
  const g = sim.goal;
  const head = `Sim ${sim.simIndex + 1} · ${esc(g.clientName)} · ${esc(g.fields.map(f => `${f.label}=${f.value}`).join(', ')).slice(0, 90)}`;

  let html = `<details${v === 'fail' ? ' open' : ''}><summary>${badge} &nbsp; ${head}</summary>`;

  html += '<div class="card"><b>What the client asked for</b><table><tr><th>Field</th><th>Wanted</th><th>Submitted</th></tr>';
  const byKey = Object.fromEntries((sim.proposedAction?.fields ?? []).map(f => [f.key, f.value]));
  for (const f of g.fields) {
    const got = byKey[f.key];
    const match = sim.assertions.find(a => a.id === `VALUE_MATCHES:${f.key}`);
    const cls = match ? (match.ok ? 'ok' : 'no') : '';
    html += `<tr><td>${esc(f.label)}</td><td>${esc(f.value)}</td><td class="${cls}">${esc(got ?? '—')}</td></tr>`;
  }
  html += '</table></div>';

  html += '<div class="card"><b>What the client saw</b>' + renderTurns(sim) + '</div>';

  const failedA = sim.assertions.filter(a => !a.ok);
  const failedL = (sim.ledgerChecks ?? []).filter(c => !c.ok);
  if (failedA.length || failedL.length) {
    html += '<div class="card"><b>Failed checks</b><table>';
    for (const a of failedA) html += `<tr><td class="no">${esc(a.id)}</td><td>${esc(a.message)}</td><td><code>${esc(a.detail ?? '')}</code></td></tr>`;
    for (const c of failedL) html += `<tr><td class="no">LEDGER</td><td>${esc(c.label)}</td><td><code>${esc(c.detail ?? '')}</code></td></tr>`;
    html += '</table></div>';
  }

  if (sim.diff) {
    html += '<details><summary>Ledger diff</summary><div class="card">';
    html += '<table><tr><th>Account</th><th>Δ balance</th><th>Δ cash</th></tr>';
    for (const a of sim.diff.accounts) html += `<tr><td>${esc(a.id)} ${esc(a.type ?? '')}</td><td>${a.dBalance ?? '—'}</td><td>${a.dCash ?? '—'}</td></tr>`;
    html += '</table><table><tr><th>Holding</th><th>Δ shares</th><th>Δ value</th></tr>';
    for (const h of sim.diff.holdings) html += `<tr><td>${esc(h.ticker ?? h.key)} in ${esc(h.accountId ?? '')}</td><td>${h.dShares ?? (h.added ? '+new' : h.removed ? 'removed' : '')}</td><td>${h.dValue ?? ''}</td></tr>`;
    html += `</table><p class="agentonly">Δ totalBalance ${sim.diff.dTotalBalance}</p></div></details>`;
  }

  html += '<details><summary>Agent-only view — the client never saw this</summary><div class="card agentonly">' +
          `<pre>${esc(JSON.stringify({
            proposedAction: sim.proposedAction,
            executeTaskResponse: sim.execResult,
            turns: sim.agentView.map(a => ({
              exitMessage: a.raw?.exitMessage, suggestedScope: a.raw?.suggestedScope,
              taskIdentified: a.raw?.taskIdentified, toolsUsed: a.raw?.toolsUsed,
            })),
          }, null, 2))}</pre></div></details>`;

  return html + '</details>';
}

export function renderReport(run) {
  const pass = run.sims.filter(s => s.verdict === 'pass').length;
  const fail = run.sims.filter(s => s.verdict === 'fail').length;
  const inc  = run.sims.filter(s => s.verdict === 'inconclusive').length;

  // Roll findings up by code across the run.
  const byCode = new Map();
  for (const s of run.sims) {
    for (const f of [...s.findings, ...(s.judgeAnnotations ?? [])]) {
      const k = f.code;
      if (!byCode.has(k)) byCode.set(k, { code: k, severity: f.severity, hits: [] });
      byCode.get(k).hits.push({ sim: s.simIndex + 1, turn: f.turnIndex });
    }
  }
  const order = { fail: 0, inconclusive: 1, warn: 2, advisory: 3 };
  const groups = [...byCode.values()].sort((a, b) =>
    (order[a.severity] - order[b.severity]) || (b.hits.length - a.hits.length));

  let html = `<!doctype html><meta charset="utf-8"><title>task-sim · ${esc(run.taskId)}</title><style>${CSS}</style>
<div class="wrap">
<h1>${esc(run.taskName)} <span class="sub">${esc(run.taskId)}</span></h1>
<div class="sub">${run.sims.length} simulations · ${esc(run.apiBase)} · ${esc(run.startedAt)} · seed ${esc(String(run.seed))}</div>
<div class="verdict">
  <span class="pill pass">${pass} passed</span>
  <span class="pill fail">${fail} failed</span>
  ${inc ? `<span class="pill infra">${inc} inconclusive</span>` : ''}
</div>
<div class="banner">Nothing was changed. This tool observes and reports — it never edits code, prompts, or data.
Every recommended fix below is a suggestion for a human to accept or reject.</div>`;

  html += '<h2>Problems found</h2>';
  if (!groups.length) {
    html += '<div class="card">No problems found across any simulation.</div>';
  } else {
    html += '<div class="card">';
    for (const g of groups) {
      const s = SEV[g.severity] ?? SEV.warn;
      const f = fixFor(g.code);
      const where = g.hits.map(h => `sim ${h.sim}${h.turn != null && h.turn >= 0 ? ` t${h.turn}` : ''}`).join(', ');
      html += `<div class="summary-row">
        <div><span class="tag ${s.cls}">${s.label}</span> <b>${esc(g.code)}</b> <span class="sub">×${g.hits.length}</span></div>
        <div class="sub" style="margin-top:4px">${esc(where)}</div>
        <div class="fixnote">
          <div><b>What it means:</b> ${esc(f.means)}</div>
          <div style="margin-top:5px"><b>Where it lives:</b> <span class="where">${esc(f.where)}</span></div>
          <div style="margin-top:5px"><b>Recommended fix:</b> ${esc(f.fix)}</div>
          <div class="disclaim">Recommendation only — nothing has been applied.</div>
        </div></div>`;
    }
    html += '</div>';
  }

  html += `<h2>The ${run.sims.length} simulations</h2>`;
  for (const s of run.sims) html += renderSim(s);

  return html + '</div>';
}
