/* ── Config ──────────────────────────────────────────────────────────────── */
const API_BASE = 'https://0y3s5vq2v5.execute-api.us-east-1.amazonaws.com';

/* ── DOM refs ────────────────────────────────────────────────────────────── */
const viewList     = document.getElementById('view-list');
const viewDetail   = document.getElementById('view-detail');
const listBody     = document.getElementById('list-body');
const listCount    = document.getElementById('list-count');
const searchInput  = document.getElementById('search-input');
const wrapupFilter = document.getElementById('wrapup-filter');
const refreshBtn   = document.getElementById('refresh-btn');
const backBtn      = document.getElementById('back-btn');

const detailClient   = document.getElementById('detail-client');
const detailIntent   = document.getElementById('detail-intent');
const detailId       = document.getElementById('detail-id');
const detailDate     = document.getElementById('detail-date');
const detailDuration = document.getElementById('detail-duration');
const detailAgent    = document.getElementById('detail-agent');
const detailWrapUp   = document.getElementById('detail-wrap-up');
const transcriptBody = document.getElementById('transcript-body');
const transcriptAcw  = document.getElementById('transcript-acw');
const acwWrapUp      = document.getElementById('acw-wrap-up');
const acwSummary     = document.getElementById('acw-summary');

const copyIdBtn    = document.getElementById('copy-id-btn');
const toggleSystem = document.getElementById('toggle-system');

/* ── State ───────────────────────────────────────────────────────────────── */
let allTranscripts = [];
let currentId = null;
let currentDetail = null;
let sortKey = 'startTime';
let sortDir = -1; // -1 = descending

/* ── Boot ────────────────────────────────────────────────────────────────── */
loadList();
// Deep link: /transcripts/?id=<conversationId> opens that conversation directly
// (used by hyperlinks in the transcript-review-notes spreadsheet).
const initialId = new URLSearchParams(location.search).get('id');
if (initialId) openDetail(initialId, false);
refreshBtn.addEventListener('click', () => { searchInput.value = ''; wrapupFilter.value = ''; loadList(); });

/* ── List loading ────────────────────────────────────────────────────────── */
async function loadList() {
  listBody.innerHTML = `<tr class="list-row list-row--loading"><td colspan="6">Loading…</td></tr>`;
  listCount.textContent = '';
  try {
    const res  = await fetch(`${API_BASE}/get-transcripts`);
    const data = await res.json();
    allTranscripts = Array.isArray(data) ? data : (data.transcripts ?? data.items ?? []);
    populateWrapupFilter();
    applyFilters();
  } catch (err) {
    listBody.innerHTML = `<tr class="list-row list-row--empty"><td colspan="6">Failed to load transcripts.</td></tr>`;
    console.error(err);
  }
}

function populateWrapupFilter() {
  const prev  = wrapupFilter.value;
  const codes = [...new Set(allTranscripts.map(t => t.wrapUpCode).filter(Boolean))].sort();
  wrapupFilter.innerHTML = '<option value="">All wrap-ups</option>' +
    codes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if (codes.includes(prev)) wrapupFilter.value = prev;
}

/* ── Filtering + sorting pipeline ────────────────────────────────────────── */
function applyFilters() {
  const q    = searchInput.value.trim().toLowerCase();
  const wrap = wrapupFilter.value;

  let items = allTranscripts.filter(t => {
    if (wrap && (t.wrapUpCode ?? '') !== wrap) return false;
    if (!q) return true;
    return [t.clientName, t.intentSummary, t.agentName, t.wrapUpCode, t.summary, t.acwSummary, t.transcriptId]
      .some(v => String(v ?? '').toLowerCase().includes(q));
  });

  items = [...items].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;            // missing values sink to the bottom
    if (bv == null) return -1;
    const cmp = typeof av === 'string'
      ? av.localeCompare(bv, undefined, { sensitivity: 'base' })
      : av - bv;
    return cmp * sortDir;
  });

  renderList(items);
  listCount.textContent = items.length === allTranscripts.length
    ? `${items.length} conversation${items.length === 1 ? '' : 's'}`
    : `${items.length} of ${allTranscripts.length} conversations`;
}

function renderList(items) {
  if (!items.length) {
    listBody.innerHTML = `<tr class="list-row list-row--empty"><td colspan="6">No transcripts found.</td></tr>`;
    return;
  }
  listBody.innerHTML = items.map(t => {
    const date     = fmtDateSmart(t.startTime ?? t.savedAt);
    const duration = fmtDurationMs(t.durationMs ?? durationFrom(t.startTime, t.endTime));
    const msgCount = t.messageCount ?? '—';
    const wrapUp   = t.wrapUpCode
      ? `<span class="list-wrap-up">${esc(t.wrapUpCode)}</span>`
      : `<span class="list-no-wrap-up">—</span>`;
    const intent   = mdLite(t.intentSummary ?? '—');
    const client   = esc(t.clientName ?? t.clientId ?? '—');
    const hover    = esc(t.summary ?? t.acwSummary ?? '');
    return `<tr class="list-row" data-id="${esc(t.transcriptId)}" tabindex="0">
      <td class="col-date"><span class="list-date">${date}</span></td>
      <td class="col-client"><span class="list-client">${client}</span></td>
      <td class="col-intent"${hover ? ` title="${hover}"` : ''}>${intent}</td>
      <td class="col-wrap-up">${wrapUp}</td>
      <td class="col-duration">${duration}</td>
      <td class="col-msgs">${msgCount}</td>
    </tr>`;
  }).join('');

  listBody.querySelectorAll('.list-row[data-id]').forEach(row => {
    row.addEventListener('click', () => openDetail(row.dataset.id));
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter') openDetail(row.dataset.id);
    });
  });
}

/* ── Search + filters ────────────────────────────────────────────────────── */
searchInput.addEventListener('input', applyFilters);
wrapupFilter.addEventListener('change', applyFilters);

/* ── Sortable column headers ─────────────────────────────────────────────── */
document.querySelectorAll('.th-sort').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (key === sortKey) {
      sortDir = -sortDir;
    } else {
      sortKey = key;
      sortDir = key === 'clientName' ? 1 : -1; // names A→Z; numbers/dates biggest/newest first
    }
    document.querySelectorAll('.th-sort').forEach(h => h.removeAttribute('data-dir'));
    th.setAttribute('data-dir', sortDir === 1 ? 'asc' : 'desc');
    applyFilters();
  });
});
document.querySelector(`.th-sort[data-sort="${sortKey}"]`)?.setAttribute('data-dir', 'desc');

/* ── Detail view ─────────────────────────────────────────────────────────── */
async function openDetail(transcriptId, pushUrl = true) {
  currentId = transcriptId;
  if (pushUrl) history.pushState({ id: transcriptId }, '', `?id=${encodeURIComponent(transcriptId)}`);
  showView('detail');
  transcriptBody.innerHTML = '<div class="convo-note">Loading…</div>';
  transcriptAcw.hidden = true;

  try {
    const res  = await fetch(`${API_BASE}/get-transcripts?transcriptId=${encodeURIComponent(transcriptId)}`);
    const data = await res.json();
    const t    = data.transcript ?? data;
    currentDetail = t;

    detailClient.textContent   = t.clientName ?? t.clientId ?? '—';
    detailIntent.innerHTML     = mdLite(t.intentSummary ?? '—');
    detailId.textContent       = t.transcriptId;
    detailDate.textContent     = fmtDateFull(t.startTime ?? t.savedAt);
    detailDuration.textContent = fmtDurationMs(t.durationMs ?? durationFrom(t.startTime, t.endTime));
    detailAgent.textContent    = t.agentName ?? '—';
    detailWrapUp.textContent   = t.wrapUpCode ?? '—';

    renderEvents(t.messages ?? []);

    if (t.acwSummary || t.wrapUpCode) {
      acwWrapUp.textContent  = t.wrapUpCode ?? '';
      acwWrapUp.hidden       = !t.wrapUpCode;
      acwSummary.textContent = t.acwSummary ?? '';
      transcriptAcw.hidden   = false;
    }
  } catch (err) {
    transcriptBody.innerHTML = `<div class="convo-note convo-note--error">Failed to load transcript.</div>`;
    console.error(err);
  }
}

/* ── Event rendering ─────────────────────────────────────────────────────── */
const TIME_GAP_MS = 3 * 60 * 1000; // show a divider for silences ≥ 3 minutes

function renderEvents(messages) {
  let html = '';
  let prevTs = null;
  for (const m of messages) {
    if (prevTs != null && m.ts && m.ts - prevTs >= TIME_GAP_MS) {
      html += `<div class="time-gap"><span>${fmtGap(m.ts - prevTs)} later</span></div>`;
    }
    if (m.ts) prevTs = m.ts;

    const role = (m.role ?? '').toUpperCase();
    if (role === 'CUSTOMER' || role === 'AGENT' || role === 'BOT') {
      const side = role === 'CUSTOMER' ? 'left' : 'right';
      html += `<div class="msg msg--${role.toLowerCase()} msg--${side}">
        <div class="msg__meta">
          <span class="msg__speaker">${esc(speakerLabel(m))}</span>
          <span class="msg__time">${fmtTime(m.ts)}</span>
        </div>
        <div class="msg__bubble">${mdLite(m.content ?? '')}</div>
      </div>`;
    } else {
      const cls = systemSubclass(m.content ?? '');
      html += `<div class="sysline ${cls}" data-system>
        <span class="sysline__time">${fmtTime(m.ts)}</span>
        <span class="sysline__content">${mdLite(m.content ?? '')}</span>
      </div>`;
    }
  }
  transcriptBody.innerHTML = html || '<div class="convo-note">No messages in this transcript.</div>';
  applySystemToggle();
}

function systemSubclass(content) {
  const c = content.toLowerCase();
  if (c.includes('task identified') || c.includes('task:'))          return 'sysline--task-identified';
  if (c.includes('callback scheduled') || c.includes('callback:'))   return 'sysline--callback-scheduled';
  if (c.includes('error') || c.includes('failed') || c.includes('exception')) return 'sysline--error';
  if (c.includes('proposed action') || c.includes('recommended action') || c.includes('action submitted')) return 'sysline--proposed-action';
  return '';
}

function speakerLabel(m) {
  const role = (m.role ?? '').toUpperCase();
  if (role === 'CUSTOMER') return currentDetail?.clientName ?? 'Customer';
  if (role === 'AGENT')    return currentDetail?.agentName ?? 'Agent';
  if (role === 'BOT')      return 'Virtual Assistant';
  return 'System';
}

/* ── System-event visibility toggle ──────────────────────────────────────── */
toggleSystem.addEventListener('change', applySystemToggle);
function applySystemToggle() {
  transcriptBody.classList.toggle('hide-system', !toggleSystem.checked);
}

/* ── Copy conversation ID ────────────────────────────────────────────────── */
copyIdBtn.addEventListener('click', async () => {
  if (!currentId) return;
  try {
    await navigator.clipboard.writeText(currentId);
    copyIdBtn.classList.add('copy-id-btn--copied');
    copyIdBtn.title = 'Copied!';
    setTimeout(() => {
      copyIdBtn.classList.remove('copy-id-btn--copied');
      copyIdBtn.title = 'Copy conversation ID';
    }, 1200);
  } catch (err) {
    console.error('clipboard write failed', err);
  }
});

/* ── Navigation ──────────────────────────────────────────────────────────── */
backBtn.addEventListener('click', () => {
  history.pushState({}, '', location.pathname);
  showView('list');
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !viewDetail.hidden) backBtn.click();
});

// Browser back/forward moves between the list and a deep-linked conversation.
window.addEventListener('popstate', () => {
  const id = new URLSearchParams(location.search).get('id');
  if (id) openDetail(id, false);
  else showView('list');
});

function showView(which) {
  viewList.hidden   = which !== 'list';
  viewDetail.hidden = which !== 'detail';
  if (which === 'list') window.scrollTo(0, 0);
}

/* ── Formatting helpers ──────────────────────────────────────────────────── */
function fmtDateSmart(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const startOfDay = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Yesterday, ${time}`;
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return `${d.toLocaleDateString(undefined, opts)}, ${time}`;
}

function fmtDateFull(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function durationFrom(start, end) {
  return (start && end) ? end - start : null;
}

function fmtDurationMs(ms) {
  if (ms == null) return '—';
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

function fmtGap(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), rm = mins % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Renders the two markdown-ish constructs that appear in stored content:
// **bold** (intent summaries) and [label](path) links (bot messages).
// Links are shown as styled text with the target in a tooltip — the paths are
// customer-app routes that wouldn't resolve from this page.
function mdLite(str) {
  let s = esc(str ?? '');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<span class="msg-link" title="$2">$1</span>');
  return s;
}
