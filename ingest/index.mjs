// One synopsis per page, for a suggestion that starts with no command.
//   node ingest/index.mjs .corpus/noble/pages
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? ".corpus/noble/pages";
const pages = [];
for (const file of readdirSync(dir)) {
  if (!file.endsWith(".json") || file.startsWith("_")) continue;
  const page = JSON.parse(readFileSync(join(dir, file), "utf8"));
  if (page.cmd && page.synopsis) pages.push({ cmd: page.cmd, synopsis: page.synopsis });
}
writeFileSync(join(dir, "_index.json"), JSON.stringify({ pages }));
console.log(`indexed ${pages.length} pages in ${dir}`);
