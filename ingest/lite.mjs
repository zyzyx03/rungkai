// Write the metadata-only page used by explain and tldr. Retrieval keeps the
// full page with its chunks and vectors; these lite pages strip them.
//   node ingest/lite.mjs .corpus/bake/qwen3/noble/pages
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { shardPage } from "../src/lib/shards.js";

const dir = process.argv[2] ?? ".corpus/noble/pages";
let count = 0;
for (const file of readdirSync(dir)) {
  if (!file.endsWith(".json") || file.startsWith("_") || file.endsWith(".lite.json") || file.includes(".shard.")) continue;
  const page = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const { chunks, chunkCap, embedModel, embedPrompt, embedPooling, ...lite } = page;
  const sharded = shardPage(lite, Buffer.byteLength(JSON.stringify(lite)));
  writeFileSync(join(dir, file.replace(/\.json$/, ".lite.json")), JSON.stringify(sharded.main));
  for (let n = 0; n < sharded.shards.length; n++) {
    writeFileSync(join(dir, file.replace(/\.json$/, `.shard.${n}.json`)), JSON.stringify(sharded.shards[n]));
  }
  count += 1;
}
console.log(`wrote ${count} lite pages in ${dir}`);
