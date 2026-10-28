// Embed a corpus through the local bge-small HTTP server (CLS pooling).
//   EMBED_URL=https://corpa.zyzyx.cc node ingest/embed-http.mjs .corpus/cls/noble/pages
// The server must produce CLS vectors; this script records that in the pages.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chunksOf, MAX_CHUNKS } from "./chunks.mjs";

const dir = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? ".corpus/noble/pages";
const force = process.argv.includes("--force");
const base = (process.env.EMBED_URL ?? "https://corpa.zyzyx.cc").replace(/\/$/, "");
const url = `${base}/v1/embeddings`;
const MODEL = process.env.EMBED_MODEL ?? "BAAI/bge-small-en-v1.5";
const POOLING = process.env.EMBED_POOLING ?? "model";
const DOC_PROMPT = process.env.EMBED_PROMPT ?? "";
const BATCH = Number(process.env.EMBED_BATCH ?? 64);
const TIMEOUT = 1_800_000;

const files = readdirSync(dir).filter((file) => file.endsWith(".json") && !file.includes(".shard.") && !file.endsWith(".lite.json") && !file.startsWith("_"));
const pages = [];
for (const file of files) {
  const path = join(dir, file);
  const page = JSON.parse(readFileSync(path, "utf8"));
  if (!force && page.chunkCap === MAX_CHUNKS && page.embedModel === MODEL && page.embedPrompt === DOC_PROMPT) continue;
  const texts = chunksOf(page);
  if (!texts.length) continue;
  pages.push({ path, page, texts });
}

const unique = [...new Set(pages.flatMap((entry) => entry.texts))];
console.log(`${pages.length} pages, ${unique.length} unique chunks -> ${url}`);
const vectors = new Map();
let batches = 0;
let failed = 0;
let DIM = Number(process.env.EMBED_DIM ?? 0);

async function embed(batch) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: batch, model: MODEL, ...(DOC_PROMPT ? { prompt_name: DOC_PROMPT } : {}) }),
        signal: AbortSignal.timeout(TIMEOUT),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.data)) {
        throw new Error(`${res.status} ${JSON.stringify(body?.errors ?? body).slice(0, 200)}`);
      }
      const dim = Number(body.dim ?? 0);
      if (!dim) throw new Error("response did not name its dimension");
      if (DIM && dim !== DIM) throw new Error(`dimension changed from ${DIM} to ${dim}`);
      DIM = dim;
      const out = body.data.sort((a, b) => a.index - b.index).map((entry) => entry.embedding);
      if (out.length !== batch.length) throw new Error(`got ${out.length} vectors for ${batch.length} texts`);
      for (const vector of out) {
        if (vector.length !== dim) throw new Error(`dimension ${vector.length}, expected ${dim}`);
        const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
        if (norm < 0.98 || norm > 1.02) throw new Error(`vector norm ${norm.toFixed(3)}, expected 1`);
      }
      return out;
    } catch (error) {
      if (attempt) throw error;
    }
  }
}

for (let at = 0; at < unique.length; at += BATCH) {
  const batch = unique.slice(at, at + BATCH);
  try {
    const out = await embed(batch);
    batch.forEach((text, i) => vectors.set(text, out[i]));
    batches += 1;
    if (batches % 10 === 0) console.log(`${Math.min(at + BATCH, unique.length)}/${unique.length}`);
  } catch (error) {
    failed += 1;
    console.error(`batch at ${at} failed: ${error.message}`);
  }
}

let missing = unique.filter((text) => !vectors.has(text));
if (missing.length) {
  console.log(`${missing.length} chunks missing; retrying with the model warm`);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  for (let at = 0; at < missing.length; at += BATCH) {
    const batch = missing.slice(at, at + BATCH);
    try {
      const out = await embed(batch);
      batch.forEach((text, i) => vectors.set(text, out[i]));
      batches += 1;
    } catch (error) {
      console.error(`retry at ${at} failed: ${error.message}`);
    }
  }
  missing = unique.filter((text) => !vectors.has(text));
}
if (missing.length) {
  console.error(`${missing.length} chunks missing; no pages were rewritten`);
  process.exit(1);
}

for (const { path, page, texts } of pages) {
  const chunks = texts.map((text) => ({ text, embedding: vectors.get(text) }));
  writeFileSync(path, JSON.stringify({ ...page, chunks, chunkCap: MAX_CHUNKS, embedModel: MODEL, embedPrompt: DOC_PROMPT, embedPooling: POOLING }));
}
console.log(`embedded ${pages.length} pages, ${unique.length} chunks in ${batches} batches`);
console.log("upload from this directory after the Worker pooling flag is switched to cls");
