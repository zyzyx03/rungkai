// Remove pages no command can reach and pages that say nothing.
//   node ingest/prune.mjs .corpus/noble/pages --dry
import { readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? ".corpus/noble/pages";
const dry = process.argv.includes("--dry");
// A tool token cannot contain whitespace or an invisible character; every
// other name is reachable as a command, however odd it looks.
const UNREACHABLE = /\s|[\p{Cc}\p{Cf}]/u;
const dropped = [];

for (const file of readdirSync(dir)) {
  if (!file.endsWith(".json") || file.startsWith("_")) continue;
  const page = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const cmd = page.cmd ?? file.replace(/\.json$/, "");
  const unreachable = UNREACHABLE.test(cmd);
  const empty =
    !page.synopsis && !page.description && !(page.options?.length) && !(page.operands?.length) && !(page.chunks?.length);
  if (!unreachable && !empty) continue;
  dropped.push({ cmd, why: unreachable ? "unreachable" : "empty" });
  if (!dry) unlinkSync(join(dir, file));
}

console.log(`${dry ? "would drop" : "dropped"} ${dropped.length} pages in ${dir}`);
for (const { cmd, why } of dropped.slice(0, 20)) console.log(`  ${why.padEnd(11)} ${cmd}`);
