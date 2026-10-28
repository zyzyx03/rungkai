// Embed a corpus locally with the same bge-small weights the Worker uses for
// question embeddings. Cloudflare defaults to mean pooling; CLS is the
// model's native mode and the recommended one. The pooling must match the
// corpus: pass --cls after the Worker and corpus switch.
//   node ingest/embed-local.mjs .corpus/noble/pages [--force] [--cls]
import { pipeline } from "@huggingface/transformers";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chunksOf, MAX_CHUNKS } from "./chunks.mjs";

const dir = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? ".corpus/noble/pages";
const force = process.argv.includes("--force");
const POOLING = process.env.EMBED_POOLING === "cls" || process.argv.includes("--cls") ? "cls" : "mean";

console.log(`loading Xenova/bge-small-en-v1.5 (fp32, ${POOLING} pooling)...`);
const extractor = await pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", { dtype: "fp32" });

const files = readdirSync(dir).filter((file) => file.endsWith(".json") && !file.includes(".shard.") && !file.endsWith(".lite.json") && !file.startsWith("_"));
const vectors = new Map();
let done = 0;
let failed = 0;

// One text at a time: a batch pads shorter texts, and the mean pooling then
// dilutes their vectors.
async function embed(text) {
  const out = await extractor(text, { pooling: POOLING, normalize: true, truncation: true });
  return Array.from(out.data);
}

for (const file of files) {
  const path = join(dir, file);
  const page = JSON.parse(readFileSync(path, "utf8"));
  if (!force && page.chunkCap === MAX_CHUNKS && page.embedPooling === POOLING) {
    done += 1;
    continue;
  }
  const texts = chunksOf(page);
  if (!texts.length) {
    done += 1;
    continue;
  }
  try {
    for (const text of new Set(texts)) {
      if (!vectors.has(text)) vectors.set(text, await embed(text));
    }
    const chunks = texts.map((text) => ({ text, embedding: vectors.get(text) }));
    writeFileSync(path, JSON.stringify({ ...page, chunks, chunkCap: MAX_CHUNKS, embedPooling: POOLING }));
    done += 1;
    if (done % 100 === 0) console.log(`${done}/${files.length}`);
  } catch (error) {
    failed += 1;
    console.warn(`failed ${file}: ${error.message}`);
  }
}

console.log(`embedded ${done - failed}/${files.length} pages in ${dir}`);
console.log("bump CORPUS_VERSION in wrangler.jsonc so the explainer cache turns over");
if (failed) process.exitCode = 1;
