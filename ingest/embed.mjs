// Add the embeddings retrieval scores, one vector per chunk. Run after
// ingest and before upload:
//   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node ingest/embed.mjs .corpus/noble/pages
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chunksOf, MAX_CHUNKS } from "./chunks.mjs";

const dir = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? ".corpus/noble/pages";
const force = process.argv.includes("--force");
// The same model the worker embeds a question with, so the vectors compare.
const MODEL = "@cf/baai/bge-small-en-v1.5";
const BATCH = 50;

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) {
  console.error("set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (needs Workers AI: Read)");
  process.exit(1);
}

async function embed(texts) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${MODEL}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ text: texts }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) throw new Error(`${res.status} ${JSON.stringify(data?.errors ?? data ?? {})}`);
  const vectors = data.result?.data;
  if (!Array.isArray(vectors) || vectors.length !== texts.length) {
    throw new Error(`the model returned ${vectors?.length ?? 0} vectors for ${texts.length} chunks`);
  }
  return vectors;
}

const files = readdirSync(dir).filter((file) => file.endsWith(".json"));
let done = 0;
let failed = 0;
// Alias pages hold the same words as the page they point at, so each chunk is
// embedded once and shared.
const vectors = new Map();

async function embeddingsFor(texts) {
  const missing = [...new Set(texts.filter((text) => !vectors.has(text)))];
  for (let at = 0; at < missing.length; at += BATCH) {
    const batch = missing.slice(at, at + BATCH);
    const embedded = await embed(batch);
    batch.forEach((text, i) => vectors.set(text, embedded[i]));
  }
  return texts.map((text) => vectors.get(text));
}

for (const file of files) {
  const path = join(dir, file);
  const page = JSON.parse(readFileSync(path, "utf8"));
  // A page already embedded at the current chunk cap is left alone: a
  // resumable run must not pay twice for pages it already finished.
  if (!force && page.chunkCap === MAX_CHUNKS) {
    for (const chunk of page.chunks) if (chunk.embedding) vectors.set(chunk.text, chunk.embedding);
    done += 1;
    continue;
  }
  const texts = chunksOf(page);
  if (!texts.length) {
    done += 1;
    continue;
  }
  try {
    const chunks = [];
    const embedded = await embeddingsFor(texts);
    texts.forEach((text, i) => chunks.push({ text, embedding: embedded[i] }));
    writeFileSync(path, JSON.stringify({ ...page, chunks, chunkCap: MAX_CHUNKS }));
    done += 1;
  } catch (error) {
    failed += 1;
    console.warn(`failed ${file}: ${error.message}`);
  }
  if (done % 100 === 0) console.log(`${done}/${files.length}`);
}

console.log(`embedded ${done - failed}/${files.length} pages in ${dir}`);
console.log("re-upload the corpus and bump CORPUS_VERSION in wrangler.jsonc");
if (failed) process.exitCode = 1;
