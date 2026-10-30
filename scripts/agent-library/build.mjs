#!/usr/bin/env node
// ── Agent Knowledge Library builder ──────────────────────────────────────────
// Source of truth: agent-app/library-src/*.txt (a small line-oriented markup, below)
// plus the fund catalog (customer-app/src/data/funds.ts) for the generated fund pages.
//
// Outputs:
//   agent-app/public/library/**.html        — the static library (deployed with the agent app)
//   lambda/agent-library-rag/chunks.json    — retrieval chunks the RAG Lambda bundles
//
// Run:  node scripts/agent-library/build.mjs        (Node 22.6+; imports funds.ts directly)
//
// Markup (one file may hold one section and many pages):
//   @section <slug> | <Title> | <one-line description>
//   @page <slug> | <Title>
//   @summary <one line>
//   ## Heading / ### Subheading
//   - bullet           1. numbered
//   | a | b |          table (first row is the header; |---| rows are ignored)
//   > callout text     (consecutive > lines form one callout)
//   **bold**, `code`, [[page-slug]] or [[page-slug|link text]] cross-links
//   Blank line = paragraph break.
// Page slugs are global, so [[slug]] links resolve across sections; the build fails
// on any link to a slug that doesn't exist.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fundSection } from './funds-section.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'agent-app/library-src');
const OUT = path.join(ROOT, 'agent-app/public/library');
const CHUNKS_OUT = path.join(ROOT, 'lambda/agent-library-rag/chunks.json');
const REVIEWED = 'September 2026';

// ── Parse ────────────────────────────────────────────────────────────────────
function parseFile(text, file) {
  const sections = [];
  let section = null;
  let page = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('@section ')) {
      const [slug, title, description = ''] = line.slice(9).split('|').map(s => s.trim());
      section = { slug, title, description, pages: [], file };
      sections.push(section);
      page = null;
    } else if (line.startsWith('@page ')) {
      if (!section) throw new Error(`${file}: @page before @section`);
      const [slug, title] = line.slice(6).split('|').map(s => s.trim());
      page = { slug, title, summary: '', body: [] };
      section.pages.push(page);
    } else if (line.startsWith('@summary ')) {
      if (!page) throw new Error(`${file}: @summary outside a page`);
      page.summary = line.slice(9).trim();
    } else if (page) {
      page.body.push(line);
    } else if (section && line.trim()) {
      section.description += ' ' + line.trim();
    }
  }
  return sections;
}

// ── Render markup → HTML blocks (also returns a plain-text block list for chunking)
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text, ctx) {
  let s = esc(text);
  s = s.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, slug, label) => {
    const target = ctx.pages.get(slug);
    if (!target) { ctx.broken.push(`${ctx.current} → ${slug}`); return label ?? slug; }
    return `<a href="${ctx.href(target)}">${label ?? esc(target.title)}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

// Plain text for retrieval: links become their label/title, markup stripped.
function plain(text, ctx) {
  return text
    .replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, slug, label) => label ?? ctx.pages.get(slug)?.title ?? slug)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

function renderBody(lines, ctx) {
  const html = [];
  // Retrieval units: { heading, text[] } — one per H2 (H3s stay inside their H2).
  const units = [{ heading: '', lines: [] }];
  const unit = () => units[units.length - 1];
  const headings = [];
  let i = 0;
  const isBlockStart = l => /^(#{2,3} |- |\d+\. |\||> )/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (line.startsWith('## ')) {
      const t = line.slice(3).trim();
      const id = t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      headings.push({ id, t });
      html.push(`<h2 id="${id}">${inline(t, ctx)}</h2>`);
      units.push({ heading: plain(t, ctx), lines: [] });
      i++; continue;
    }
    if (line.startsWith('### ')) {
      const t = line.slice(4).trim();
      html.push(`<h3>${inline(t, ctx)}</h3>`);
      unit().lines.push(plain(t, ctx) + ':');
      i++; continue;
    }
    if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) { items.push(lines[i].slice(2)); i++; }
      html.push('<ul>\n' + items.map(t => `  <li>${inline(t, ctx)}</li>`).join('\n') + '\n</ul>');
      items.forEach(t => unit().lines.push('- ' + plain(t, ctx)));
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, '')); i++; }
      html.push('<ol>\n' + items.map(t => `  <li>${inline(t, ctx)}</li>`).join('\n') + '\n</ol>');
      items.forEach((t, n) => unit().lines.push(`${n + 1}. ` + plain(t, ctx)));
      continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^\|[\s:|-]+\|?$/.test(lines[i])) {
          rows.push(lines[i].replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
        }
        i++;
      }
      const [head, ...body] = rows;
      html.push('<table>\n  <thead><tr>' + head.map(c => `<th>${inline(c, ctx)}</th>`).join('') + '</tr></thead>\n  <tbody>\n' +
        body.map(r => '    <tr>' + r.map(c => `<td>${inline(c, ctx)}</td>`).join('') + '</tr>').join('\n') + '\n  </tbody>\n</table>');
      // Tables become "Header: value; Header: value" sentences so each row stands alone in a chunk.
      body.forEach(r => unit().lines.push(r.map((c, n) => `${plain(head[n] ?? '', ctx)}: ${plain(c, ctx)}`).join('; ')));
      continue;
    }
    if (line.startsWith('> ')) {
      const parts = [];
      while (i < lines.length && lines[i].startsWith('> ')) { parts.push(lines[i].slice(2)); i++; }
      const t = parts.join(' ');
      html.push(`<blockquote>${inline(t, ctx)}</blockquote>`);
      unit().lines.push(plain(t, ctx));
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) { para.push(lines[i].trim()); i++; }
    const t = para.join(' ');
    html.push(`<p>${inline(t, ctx)}</p>`);
    unit().lines.push(plain(t, ctx));
  }
  return { html: html.join('\n'), units, headings };
}

// ── Page shell ──────────────────────────────────────────────────────────────
function shell({ title, description, depth, crumbs, body }) {
  const up = depth ? '../' : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | Agent Knowledge Library</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="${up}library.css">
</head>
<body>
<header>
<p class="banner">Bob's Mutual Funds &middot; Agent Knowledge Library &middot; Internal use only</p>
<nav class="crumbs">${crumbs}</nav>
<nav class="tools"><a href="${up}index.html">Library home</a> &middot; <a href="${up}a-z.html">A&ndash;Z index</a> &middot; <a href="${up}ask.html">Ask the library</a></nav>
</header>
<main>
${body}
</main>
<footer>
<p>Internal reference for Bob's Mutual Funds service agents. Do not send this page or its URL to clients; share the client-facing help page instead. Last reviewed ${REVIEWED}.</p>
</footer>
</body>
</html>
`;
}

// ── Chunking for RAG ─────────────────────────────────────────────────────────
const words = s => s.split(/\s+/).filter(Boolean).length;
const TARGET = 220, MAX = 320;

function chunkPage(page, section, units) {
  const chunks = [];
  const url = `${section.slug}/${page.slug}.html`;
  for (const u of units) {
    if (!u.lines.length) continue;
    // Greedy pack lines into ~TARGET-word pieces; a single oversized line is split by sentence.
    const pieces = [];
    let cur = [];
    let n = 0;
    const flush = () => { if (cur.length) pieces.push(cur.join('\n')); cur = []; n = 0; };
    for (const line of u.lines) {
      const w = words(line);
      if (w > MAX) {
        flush();
        let acc = [];
        for (const s of line.split(/(?<=[.!?])\s+/)) {
          acc.push(s);
          if (words(acc.join(' ')) >= TARGET) { pieces.push(acc.join(' ')); acc = []; }
        }
        if (acc.length) pieces.push(acc.join(' '));
        continue;
      }
      if (n + w > MAX && n >= TARGET / 2) flush();
      cur.push(line); n += w;
      if (n >= TARGET) flush();
    }
    flush();
    // A too-small trailing piece is merged back into its predecessor.
    if (pieces.length > 1 && words(pieces[pieces.length - 1]) < 60) {
      const last = pieces.pop();
      pieces[pieces.length - 1] += '\n' + last;
    }
    pieces.forEach((text, k) => {
      chunks.push({
        id: `${page.slug}#${chunks.length}`,
        url,
        section: section.title,
        page: page.title,
        heading: u.heading,
        part: pieces.length > 1 ? k + 1 : 0,
        text,
      });
    });
  }
  return chunks;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.txt')).sort();
const sections = [];
for (const f of files) sections.push(...parseFile(fs.readFileSync(path.join(SRC, f), 'utf8'), f));

// Generated fund section is inserted where the source declares `@section funds`
// (its hand-written overview pages come first, the 36 fund profiles follow).
const fundsMod = await import(pathToFileURL(path.join(ROOT, 'customer-app/src/data/funds.ts')).href);
const fundsIdx = sections.findIndex(s => s.slug === 'funds');
if (fundsIdx < 0) throw new Error('missing @section funds');
sections[fundsIdx].pages.push(...fundSection(fundsMod.FUNDS));

const pages = new Map();
for (const s of sections) {
  for (const p of s.pages) {
    if (pages.has(p.slug)) throw new Error(`duplicate page slug: ${p.slug}`);
    p.section = s;
    pages.set(p.slug, p);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'library.css'), path.join(OUT, 'library.css'));
fs.copyFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'ask.html'), path.join(OUT, 'ask.html'));

const broken = [];
const allChunks = [];
let totalWords = 0;
const thin = [];

for (const s of sections) {
  fs.mkdirSync(path.join(OUT, s.slug), { recursive: true });
  s.pages.forEach((p, idx) => {
    const ctx = {
      pages, broken, current: p.slug,
      href: t => (t.section.slug === s.slug ? '' : `../${t.section.slug}/`) + `${t.slug}.html`,
    };
    const { html, units, headings } = renderBody(p.body, ctx);
    const prev = s.pages[idx - 1], next = s.pages[idx + 1];
    const toc = headings.length >= 3
      ? `<nav class="toc"><p>On this page</p><ul>${headings.map(h => `<li><a href="#${h.id}">${esc(h.t)}</a></li>`).join('')}</ul></nav>\n`
      : '';
    const pager = `<nav class="pager">${prev ? `<a href="${prev.slug}.html">&larr; ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="${next.slug}.html">${esc(next.title)} &rarr;</a>` : ''}</nav>`;
    const body = `<h1>${esc(p.title)}</h1>
<p class="meta">Section: <a href="index.html">${esc(s.title)}</a> &middot; Page ID: <code>${p.slug}</code></p>
${p.summary ? `<p class="summary">${inline(p.summary, ctx)}</p>\n` : ''}${toc}${html}
${pager}`;
    fs.writeFileSync(path.join(OUT, s.slug, `${p.slug}.html`), shell({
      title: p.title, description: p.summary, depth: 1,
      crumbs: `<a href="../index.html">Library</a> &rsaquo; <a href="index.html">${esc(s.title)}</a> &rsaquo; ${esc(p.title)}`,
      body,
    }));
    const wc = units.reduce((n, u) => n + words(u.lines.join(' ')), 0);
    totalWords += wc;
    if (wc < 250) thin.push(`${p.slug} (${wc})`);
    // Page summary rides along on the first unit so "what is this page about" is retrievable.
    if (p.summary) units[0].lines.unshift(plain(p.summary, ctx));
    allChunks.push(...chunkPage(p, s, units));
  });

  // Section index
  const list = s.pages.map(p => `<li><a href="${p.slug}.html">${esc(p.title)}</a>${p.summary ? ` &mdash; ${inline(p.summary, { pages, broken, current: s.slug, href: t => (t.section.slug === s.slug ? '' : `../${t.section.slug}/`) + `${t.slug}.html` })}` : ''}</li>`).join('\n');
  fs.writeFileSync(path.join(OUT, s.slug, 'index.html'), shell({
    title: s.title, description: s.description.trim(), depth: 1,
    crumbs: `<a href="../index.html">Library</a> &rsaquo; ${esc(s.title)}`,
    body: `<h1>${esc(s.title)}</h1>\n<p class="summary">${esc(s.description.trim())}</p>\n<p>${s.pages.length} pages in this section.</p>\n<ol class="pagelist">\n${list}\n</ol>`,
  }));
}

// Library home
const home = sections.map((s, n) => `<li><a href="${s.slug}/index.html">${esc(s.title)}</a> <span class="count">(${s.pages.length})</span><br>${esc(s.description.trim())}</li>`).join('\n');
fs.writeFileSync(path.join(OUT, 'index.html'), shell({
  title: 'Library home', description: 'Internal knowledge library for Bob\'s Mutual Funds chat agents.', depth: 0,
  crumbs: 'Library',
  body: `<h1>Agent Knowledge Library</h1>
<p class="summary">The definitive internal reference for Bob's Mutual Funds chat agents. When a client asks something you don't know, look it up here. Start with <a href="start/library-guide.html">How to use this library</a> and the <a href="start/quick-reference.html">Quick reference card</a>, or <a href="ask.html">ask the library a question</a> in plain English.</p>
<p>${pages.size} pages in ${sections.length} sections. Last reviewed ${REVIEWED}.</p>
<h2>Sections</h2>
<ol class="sections">
${home}
</ol>`,
}));

// A–Z index
const az = [...pages.values()].sort((a, b) => a.title.localeCompare(b.title));
let letter = '';
const azHtml = az.map(p => {
  const L = p.title[0].toUpperCase();
  const head = L !== letter ? `</ul>\n<h2>${(letter = L)}</h2>\n<ul>` : '';
  return `${head}\n<li><a href="${p.section.slug}/${p.slug}.html">${esc(p.title)}</a> <span class="count">(${esc(p.section.title)})</span></li>`;
}).join('').replace(/^<\/ul>\n/, '');
fs.writeFileSync(path.join(OUT, 'a-z.html'), shell({
  title: 'A–Z index', description: 'Every page in the Agent Knowledge Library, alphabetically.', depth: 0,
  crumbs: '<a href="index.html">Library</a> &rsaquo; A&ndash;Z index',
  body: `<h1>A&ndash;Z index</h1>\n<p>All ${pages.size} pages, alphabetically.</p>\n${azHtml}</ul>`,
}));

if (broken.length) {
  console.error(`\n${broken.length} broken cross-link(s):\n  ` + broken.join('\n  '));
  process.exitCode = 1;
}

// Chunks file: the hash keys the Lambda's embedding cache, so any content edit
// invalidates cached vectors automatically.
const hash = crypto.createHash('sha256').update(JSON.stringify(allChunks)).digest('hex').slice(0, 16);
fs.mkdirSync(path.dirname(CHUNKS_OUT), { recursive: true });
fs.writeFileSync(CHUNKS_OUT, JSON.stringify({ hash, builtFrom: `${pages.size} pages`, chunks: allChunks }));

console.log(`sections ${sections.length} | pages ${pages.size} | words ${totalWords.toLocaleString()} | chunks ${allChunks.length} | hash ${hash}`);
if (thin.length) console.log(`thin pages (<250 words): ${thin.join(', ')}`);
