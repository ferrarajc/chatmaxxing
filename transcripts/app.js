/* ── Config ──────────────────────────────────────────────────────────────── */
const API_BASE = 'https://0y3s5vq2v5.execute-api.us-east-1.amazonaws.com';

/* ── DOM refs ────────────────────────────────────────────────────────────── */
const viewList    = document.getElementById('view-list');
const viewDetail  = document.getElementById('view-detail');
const listBody    = document.getElementById('list-body');
const searchInput = document.getElementById('search-input');
const backBtn     = document.getElementById('back-btn');

const detailClient   = document.getElementById('detail-client');
const detailIntent   = document.getElementById('detail-intent');
const detailId       = document.getElementById('detail-id');
const detailDate     = document.getElementById('detail-date');
const detailDuration = document.getElementById('detail-duration');
const detailWrapUp   = document.getElementById('detail-wrap-up');
const transcriptBody = document.getElementById('transcript-body');
const transcriptAcw  = document.getElementById('transcript-acw');
const acwWrapUp      = document.getElementById('acw-wrap-up');
const acwSummary     = document.getElementById('acw-summary');

/* ── State ───────────────────────────────────────────────────────────────── */
let allTranscripts = [];

/* ── Boot ────────────────────────────────────────────────────────────────── */
loadList();

/* ── List loading ────────────────────────────────────────────────────────── */
async function loadList() {
  try {
    const res  = await fetch(`${API_BASE}/get-transcripts`);
    const data = await res.json();
    allTranscripts = Array.isArray(data) ? data : (data.items ?? []);
    renderList(allTranscripts);
  } catch (err) {
    listBody.innerHTML = `<tr class="list-row list-row--empty"><td colspan="6">Failed to load transcripts.</td></tr>`;
    console.error(err);
  }
}

function renderList(items) {
  if (!items.length) {
    listBody.innerHTML = `<tr class="list-row list-row--empty"><td colspan="6">No transcripts found.</td></tr>`;
    return;
  }
  listBody.innerHTML = items.map(t => {
    const date     = fmtDate(t.startTime ?? t.savedAt);
    const duration = fmtDuration(t.startTime, t.endTime);
    const msgCount = t.messageCount ?? '—';
    const wrapUp   = t.wrapUpCode ?? '—';
    const intent   = t.intentSummary ?? '—';
    const client   = esc(t.clientName ?? t.clientId ?? '—');
    return `<tr class="list-row" data-id="${esc(t.transcriptId)}">
      <td class="col-date"><span class="list-date">${date}</span></td>
      <td class="col-client"><span class="list-client">${client}</span></td>
      <td class="col-intent">${esc(intent)}</td>
      <td class="col-wrap-up"><span class="list-wrap-up">${esc(wrapUp)}</span></td>
      <td class="col-duration">${duration}</td>
      <td class="col-msgs">${msgCount}</td>
    </tr>`;
  }).join('');

  listBody.querySelectorAll('.list-row[data-id]').forEach(row => {
    row.addEventListener('click', () => openDetail(row.dataset.id));
  });
}

/* ── Search ──────────────────────────────────────────────────────────────── */
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) { renderList(allTranscripts); return; }
  renderList(allTranscripts.filter(t =>
    (t.clientName ?? '').toLowerCase().includes(q) ||
    (t.intentSummary ?? '').toLowerCase().includes(q)
  ));
});

/* ── Detail view ─────────────────────────────────────────────────────────── */
async function openDetail(transcriptId) {
  showView('detail');
  transcriptBody.innerHTML = '<div style="color:#64748b;font-size:13px;padding:8px 0">Loading…</div>';
  transcriptAcw.hidden = true;

  try {
    const res  = await fetch(`${API_BASE}/get-transcripts?transcriptId=${encodeURIComponent(transcriptId)}`);
    const t    = await res.json();

    detailClient.textContent   = t.clientName ?? t.clientId ?? '—';
    detailIntent.textContent   = t.intentSummary ?? '—';
    detailId.textContent       = t.transcriptId;
    detailDate.textContent     = fmtDate(t.startTime ?? t.savedAt);
    detailDuration.textContent = fmtDuration(t.startTime, t.endTime);
    detailWrapUp.textContent   = t.wrapUpCode ?? '—';

    renderEvents(t.messages ?? []);

    if (t.acwSummary || t.wrapUpCode) {
      acwWrapUp.textContent  = t.wrapUpCode ?? '';
      acwSummary.textContent = t.acwSummary ?? '';
      transcriptAcw.hidden   = false;
    }
  } catch (err) {
    transcriptBody.innerHTML = `<div style="color:#ef4444;font-size:13px">Failed to load transcript.</div>`;
    console.error(err);
  }
}

/* ── Event rendering ─────────────────────────────────────────────────────── */
function renderEvents(messages) {
  transcriptBody.innerHTML = messages.map(m => {
    const cls   = eventClass(m);
    const time  = fmtTime(m.ts);
    const spkr  = speakerLabel(m);
    const body  = esc(m.content ?? '');
    return `<div class="event ${cls}">
      <div class="event__time">${time}</div>
      <div class="event__body">
        <div class="event__speaker">${spkr}</div>
        <div class="event__content">${body}</div>
      </div>
    </div>`;
  }).join('');
}

function eventClass(m) {
  const role = (m.role ?? '').toUpperCase();
  if (role === 'CUSTOMER') return 'event--customer';
  if (role === 'AGENT')    return 'event--agent';
  if (role === 'BOT')      return 'event--bot';
  if (role === 'SYSTEM')   return systemSubclass(m.content ?? '');
  return 'event--system';
}

function systemSubclass(content) {
  const c = content.toLowerCase();
  if (c.includes('task identified') || c.includes('task:'))          return 'event--task-identified';
  if (c.includes('callback scheduled') || c.includes('callback:'))   return 'event--callback-scheduled';
  if (c.includes('error') || c.includes('failed') || c.includes('exception')) return 'event--error';
  if (c.includes('proposed action') || c.includes('recommended action') || c.includes('action submitted')) return 'event--proposed-action';
  return 'event--system';
}

function speakerLabel(m) {
  const role = (m.role ?? '').toUpperCase();
  if (role === 'CUSTOMER') return 'Customer';
  if (role === 'AGENT')    return 'Agent';
  if (role === 'BOT')      return 'Bot';
  return 'System';
}

/* ── Navigation ──────────────────────────────────────────────────────────── */
backBtn.addEventListener('click', () => showView('list'));

function showView(which) {
  viewList.hidden   = which !== 'list';
  viewDetail.hidden = which !== 'detail';
}

/* ── Formatting helpers ──────────────────────────────────────────────────── */
function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtDuration(start, end) {
  if (!start || !end) return '—';
  const secs = Math.round((end - start) / 1000);
  if (secs < 60)  return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
