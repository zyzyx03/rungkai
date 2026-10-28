// One synopsis per page that can actually ground a suggestion.
//   node ingest/index.mjs .corpus/noble/pages
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function writeIndex(dir) {
  const pages = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json") || file.includes(".shard.") || file.startsWith("_") || file.endsWith(".lite.json")) continue;
    const page = JSON.parse(readFileSync(join(dir, file), "utf8"));
    // A page without chunks cannot ground an answer; leave it out of the
    // candidate list until it is embedded.
    if (!page.cmd || !page.synopsis || !page.chunks?.length) continue;
    pages.push({ cmd: page.cmd, synopsis: page.synopsis });
  }
  writeFileSync(join(dir, "_index.json"), JSON.stringify({ pages }));
  return pages.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2] ?? ".corpus/noble/pages";
  console.log(`indexed ${writeIndex(dir)} pages in ${dir}`);
}
