// Split a page's COMMANDS entries into one generic page per command, so
// `systemctl start nginx` loads systemctl-start instead of the whole manual.
//   node ingest/subcommands.mjs .corpus/noble/pages systemctl
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? ".corpus/noble/pages";
const root = process.argv[3] ?? "systemctl";
const rootPath = join(dir, `${root}.json`);
if (!existsSync(rootPath)) {
  console.log(`no ${root} page in ${dir}`);
  process.exit(0);
}
const page = JSON.parse(readFileSync(rootPath, "utf8"));
const commands = (page.operands ?? []).filter((operand) => operand.command);
const baseOperands = (page.operands ?? []).filter((operand) => !operand.command && operand.name !== "COMMAND");
let count = 0;
for (const command of commands) {
  const cmd = `${root}-${command.name}`;
  const first = String(command.desc ?? "").split(/(?<=[.!?])\s+/)[0] ?? "";
  const sub = {
    cmd,
    env: page.env,
    section: page.section,
    source: page.source,
    licence: page.licence,
    synopsis: first.slice(0, 300) || command.name,
    description: command.desc,
    options: page.options,
    values: page.values,
    operands: baseOperands,
  };
  writeFileSync(join(dir, `${cmd}.json`), JSON.stringify(sub));
  count += 1;
}
console.log(`wrote ${count} ${root}-* pages in ${dir}`);
