// ── agent-library-rag ────────────────────────────────────────────────────────
// Retrieval-augmented Q&A over the Agent Knowledge Library
// (agent-app/public/library, built from agent-app/library-src by
// scripts/agent-library/build.mjs). The build script emits ./chunks.json, which is
// bundled into this function; the OpenAI key never leaves AWS.
//
// Retrieval is hybrid: BM25 over chunk text (exact terms: "1099-R", "BFLTC",
// "031000503") fused by reciprocal rank with embedding similarity (paraphrase:
// "can my wife see my account" → authorized users). The top chunks go to the chat
// model, which answers only from them and cites [n].
//
// Embedding index: computed on first use by THIS function and cached in S3 under a
// key derived from the chunks' content hash + model + dimensions, so any library
// edit invalidates the cache automatically. A full embedding pass (~2k chunks) can
// outlast API Gateway's 29s cap, so on a cache miss the request returns 503
// {status:'indexing'} and the build runs as an async self-invocation.
//
// Routes:
//   POST /agent-library/ask     {question, topK?} → {answer, citations, retrieved, ...}
//   GET  /agent-library/status  → {hash, chunks, ready, building}
//   async event {mode:'build'}  → builds and stores the embedding index

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import library from './chunks.json';

interface Chunk {
  id: string;
  url: string;
  section: string;
  page: string;
  heading: string;
  part: number;
  text: string;
}

const CHUNKS: Chunk[] = (library as { hash: string; chunks: Chunk[] }).chunks;
const CONTENT_HASH: string = (library as { hash: string }).hash;

const EMBED_MODEL = process.env.OPENAI_MODEL_LIBRARY_EMBED ?? 'text-embedding-3-large';
const EMBED_DIMS = Number(process.env.LIBRARY_EMBED_DIMS ?? 1024);
const ANSWER_MODEL = process.env.OPENAI_MODEL_LIBRARY_RAG ?? 'gpt-4o';
const BUCKET = process.env.LIBRARY_INDEX_BUCKET ?? '';
const INDEX_KEY = `embeddings/${CONTENT_HASH}-${EMBED_MODEL}-${EMBED_DIMS}.f32`;
const LOCK_KEY = `${INDEX_KEY}.building`;
const LOCK_TTL_MS = 6 * 60 * 1000;

const s3 = new S3Client({});

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

// ── Text the embedder and BM25 see for a chunk ───────────────────────────────
// Page title + heading are prepended so a chunk deep inside "Form 1099-R" still
// matches a question that only names the form.
const chunkDoc = (c: Chunk): string =>
  `${c.page}${c.heading ? ` — ${c.heading}` : ''} (${c.section})\n${c.text}`;

// ── BM25 ─────────────────────────────────────────────────────────────────────
const STOP = new Set(('a an and are as at be but by can do does for from has have how i if in into is it its ' +
  'me my of on or our so than that the their them then there these they this to was we were what when where ' +
  'which who why will with you your')
  .split(' '));

function tokenize(s: string): string[] {
  return s.toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9$%.]+/)
    .map(t => t.replace(/^[.$]+|[.]+$/g, ''))
    .filter(t => t && !STOP.has(t))
    .map(t => (t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
}

interface Bm25 { tf: Map<string, number>[]; len: number[]; avg: number; df: Map<string, number> }
let bm25: Bm25 | null = null;

function bm25Index(): Bm25 {
  if (bm25) return bm25;
  const tf: Map<string, number>[] = [];
  const len: number[] = [];
  const df = new Map<string, number>();
  for (const c of CHUNKS) {
    const toks = tokenize(chunkDoc(c));
    const m = new Map<string, number>();
    for (const t of toks) m.set(t, (m.get(t) ?? 0) + 1);
    for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    tf.push(m);
    len.push(toks.length);
  }
  bm25 = { tf, len, df, avg: len.reduce((a, b) => a + b, 0) / Math.max(1, len.length) };
  return bm25;
}

function bm25Scores(query: string): Float64Array {
  const { tf, len, avg, df } = bm25Index();
  const N = CHUNKS.length;
  const k1 = 1.2, b = 0.75;
  const q = [...new Set(tokenize(query))];
  const out = new Float64Array(N);
  for (const t of q) {
    const n = df.get(t);
    if (!n) continue;
    const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
    for (let i = 0; i < N; i++) {
      const f = tf[i].get(t);
      if (!f) continue;
      out[i] += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * (len[i] / avg)));
    }
  }
  return out;
}

// ── OpenAI ───────────────────────────────────────────────────────────────────
async function embed(inputs: string[]): Promise<Float32Array[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs, dimensions: EMBED_DIMS }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json() as { data: { index: number; embedding: number[] }[] };
  const out: Float32Array[] = new Array(inputs.length);
  for (const d of data.data) out[d.index] = normalize(Float32Array.from(d.embedding));
  return out;
}

function normalize(v: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

// ── Embedding index (S3-cached) ──────────────────────────────────────────────
let vectors: Float32Array | null = null; // CHUNKS.length × EMBED_DIMS, row-major

async function loadIndex(): Promise<Float32Array | null> {
  if (vectors) return vectors;
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: INDEX_KEY }));
    const bytes = await obj.Body!.transformToByteArray();
    const v = new Float32Array(bytes.slice().buffer);
    if (v.length !== CHUNKS.length * EMBED_DIMS) {
      console.warn(`index size mismatch: ${v.length} vs ${CHUNKS.length * EMBED_DIMS}`);
      return null;
    }
    vectors = v;
    return v;
  } catch (e) {
    if ((e as { name?: string }).name === 'NoSuchKey') return null;
    throw e;
  }
}

async function buildLockActive(): Promise<boolean> {
  try {
    const h = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: LOCK_KEY }));
    return !!h.LastModified && Date.now() - h.LastModified.getTime() < LOCK_TTL_MS;
  } catch {
    return false;
  }
}

/** Kick off an async build unless one is already running. */
async function triggerBuild(): Promise<void> {
  if (await buildLockActive()) return;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: LOCK_KEY, Body: new Date().toISOString() }));
  await new LambdaClient({}).send(new InvokeCommand({
    FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    InvocationType: 'Event',
    Payload: Buffer.from(JSON.stringify({ mode: 'build' })),
  }));
}

/** Embed every chunk (batched, a few requests in flight) and store the matrix. */
async function buildIndex(): Promise<{ chunks: number; ms: number }> {
  const t0 = Date.now();
  const BATCH = 128, PARALLEL = 4;
  const docs = CHUNKS.map(chunkDoc);
  const out = new Float32Array(CHUNKS.length * EMBED_DIMS);
  const batches: number[] = [];
  for (let i = 0; i < docs.length; i += BATCH) batches.push(i);
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const start = batches[next++];
      let attempt = 0;
      for (;;) {
        try {
          const vecs = await embed(docs.slice(start, start + BATCH));
          vecs.forEach((v, k) => out.set(v, (start + k) * EMBED_DIMS));
          break;
        } catch (e) {
          if (++attempt >= 4) throw e;
          await new Promise(r => setTimeout(r, 1500 * attempt));
        }
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: INDEX_KEY, Body: Buffer.from(out.buffer), ContentType: 'application/octet-stream',
  }));
  vectors = out;
  return { chunks: CHUNKS.length, ms: Date.now() - t0 };
}

// ── Retrieval ────────────────────────────────────────────────────────────────
interface Hit { i: number; score: number; vec: number; lex: number; vecRank: number; lexRank: number }

function retrieve(question: string, qv: Float32Array, index: Float32Array, topK: number): Hit[] {
  const N = CHUNKS.length;
  const vec = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    const off = i * EMBED_DIMS;
    for (let d = 0; d < EMBED_DIMS; d++) s += qv[d] * index[off + d];
    vec[i] = s;
  }
  const lex = bm25Scores(question);

  const rankOf = (scores: Float64Array, depth: number) => {
    const order = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]).slice(0, depth);
    const r = new Map<number, number>();
    order.forEach((i, k) => { if (scores[i] > 0) r.set(i, k + 1); });
    return r;
  };
  const vr = rankOf(vec, 60);
  const lr = rankOf(lex, 60);

  // Reciprocal rank fusion. Embeddings carry the paraphrase signal so they get the
  // larger weight; BM25 rescues exact identifiers the embedder blurs.
  const K = 60;
  const fused = new Map<number, number>();
  for (const [i, r] of vr) fused.set(i, (fused.get(i) ?? 0) + 1.0 / (K + r));
  for (const [i, r] of lr) fused.set(i, (fused.get(i) ?? 0) + 0.7 / (K + r));

  const ranked = [...fused.entries()].sort((a, b) => b[1] - a[1]);
  const perPage = new Map<string, number>();
  const hits: Hit[] = [];
  for (const [i, score] of ranked) {
    const url = CHUNKS[i].url;
    const n = perPage.get(url) ?? 0;
    if (n >= 3) continue; // keep the context from collapsing onto one page
    perPage.set(url, n + 1);
    hits.push({ i, score, vec: vec[i], lex: lex[i], vecRank: vr.get(i) ?? 0, lexRank: lr.get(i) ?? 0 });
    if (hits.length >= topK) break;
  }
  return hits;
}

// ── Answering ────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the Agent Knowledge Library assistant for Bob's Mutual Funds. Your readers are the firm's own chat service agents (internal staff), who ask you questions while helping clients.

Answer ONLY from the numbered library excerpts provided. Rules:
- Lead with the direct answer in one or two sentences, then the key details (exact figures, deadlines, steps, who handles it). Keep it tight: usually under 180 words. Use short bullet lists for steps or several facts.
- Cite every factual statement with the excerpt number in square brackets, e.g. [2] or [1][4]. Only cite excerpts that support the statement.
- Quote numbers, dates, fees, limits, and tickers exactly as the excerpts give them. Never compute tax owed or invent figures.
- If the excerpts do not contain the answer, say so plainly ("The library doesn't cover this") and, if an excerpt points to a team or page that would know, say which. Never fill gaps from general knowledge.
- If the excerpts disagree, say so and cite both.
- Where relevant, remind the agent of a compliance boundary the excerpts state (for example, no investment or tax advice).
- Write plain text. You may use **bold** for the single most important fact and "- " bullets. No headings, no tables.`;

async function answer(question: string, hits: Hit[]): Promise<{ text: string; usage?: unknown }> {
  const context = hits.map((h, k) => {
    const c = CHUNKS[h.i];
    return `[${k + 1}] ${c.page}${c.heading ? ` › ${c.heading}` : ''} (section: ${c.section})\n${c.text}`;
  }).join('\n\n---\n\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: ANSWER_MODEL,
      temperature: 0.1,
      max_tokens: 700,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Library excerpts:\n\n${context}\n\n===\n\nAgent's question: ${question}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`chat ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json() as { choices: { message: { content: string } }[]; usage?: unknown };
  return { text: data.choices[0]?.message?.content?.trim() ?? '', usage: data.usage };
}

// ── Handler ──────────────────────────────────────────────────────────────────
type BuildEvent = { mode: 'build' };

export const handler = async (event: APIGatewayProxyEventV2 | BuildEvent): Promise<APIGatewayProxyResultV2 | object> => {
  if (!BUCKET) return json(500, { error: 'LIBRARY_INDEX_BUCKET not configured' });

  // Async self-invocation: build the index.
  if ((event as BuildEvent).mode === 'build') {
    try {
      if (await loadIndex()) return { status: 'already-built' };
      const r = await buildIndex();
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: LOCK_KEY })).catch(() => {});
      console.log(`built index ${INDEX_KEY}: ${r.chunks} chunks in ${r.ms} ms`);
      return { status: 'built', ...r };
    } catch (e) {
      console.error('index build failed', e);
      // Release the lock so the next request can retry.
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: LOCK_KEY })).catch(() => {});
      throw e;
    }
  }

  const http = event as APIGatewayProxyEventV2;
  const route = http.rawPath ?? '';
  const method = http.requestContext?.http?.method ?? 'GET';

  if (route.endsWith('/status')) {
    const ready = !!(await loadIndex());
    return json(200, {
      hash: CONTENT_HASH, chunks: CHUNKS.length, ready,
      building: ready ? false : await buildLockActive(),
      embedModel: EMBED_MODEL, dims: EMBED_DIMS, answerModel: ANSWER_MODEL,
    });
  }

  if (method !== 'POST') return json(405, { error: 'POST a JSON body: {"question": "..."}' });

  let body: { question?: unknown; topK?: unknown };
  try {
    body = JSON.parse(http.isBase64Encoded ? Buffer.from(http.body ?? '', 'base64').toString() : (http.body ?? '{}'));
  } catch {
    return json(400, { error: 'Body must be JSON' });
  }
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) return json(400, { error: 'question is required' });
  if (question.length > 1000) return json(400, { error: 'question must be 1,000 characters or fewer' });
  const topK = Math.min(12, Math.max(3, Number(body.topK) || 8));

  const t0 = Date.now();
  const index = await loadIndex();
  if (!index) {
    await triggerBuild();
    return json(503, {
      status: 'indexing',
      message: 'The library index is being built (first use after a content update). This takes about a minute; try again shortly.',
      retryAfterSeconds: 20,
    });
  }

  try {
    const [qv] = await embed([question]);
    const tRetrieve = Date.now();
    const hits = retrieve(question, qv, index, topK);
    const tAnswer = Date.now();
    const { text, usage } = await answer(question, hits);

    const cited = new Set<number>();
    for (const m of text.matchAll(/\[(\d+)\]/g)) cited.add(Number(m[1]));
    const retrieved = hits.map((h, k) => {
      const c = CHUNKS[h.i];
      return {
        n: k + 1, id: c.id, page: c.page, section: c.section, heading: c.heading, url: c.url,
        cited: cited.has(k + 1),
        score: Number(h.score.toFixed(5)), similarity: Number(h.vec.toFixed(4)), bm25: Number(h.lex.toFixed(3)),
        vecRank: h.vecRank, lexRank: h.lexRank,
        text: c.text,
      };
    });
    return json(200, {
      question,
      answer: text,
      citations: retrieved.filter(r => r.cited).map(({ n, page, section, heading, url }) => ({ n, page, section, heading, url })),
      retrieved,
      timings: { embedAndLoadMs: tRetrieve - t0, retrieveMs: tAnswer - tRetrieve, answerMs: Date.now() - tAnswer, totalMs: Date.now() - t0 },
      index: { hash: CONTENT_HASH, chunks: CHUNKS.length, embedModel: EMBED_MODEL, dims: EMBED_DIMS, answerModel: ANSWER_MODEL },
      usage,
    });
  } catch (e) {
    console.error('ask failed', e);
    return json(502, { error: 'The library assistant had a problem answering. Try again.', detail: String((e as Error).message ?? e).slice(0, 300) });
  }
};
