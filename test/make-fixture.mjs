// Refresh the corpus sample the one-liner test runs against.
//
// The corpus itself is not in the repository: it is a build of a
// distribution's man pages, and it changes with every release. The test
// needs pages to run against, so the pages the one-liners actually use are
// copied here — the option names, the values and the operands, which are
// the facts the matcher works on, and not the pages' own prose.
//
//   node test/make-fixture.mjs [corpus dir]
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parse } from "./parser.mjs";
import { resolveCommands } from "../src/lib/wrap.js";

const corpus = process.argv[2] ?? ".corpus/noble/pages";
const out = "test/fixtures/corpus";
const cmds = JSON.parse(readFileSync("test/fixtures/one-liners.json", "utf8"));

if (!existsSync(corpus)) {
  console.error(`no corpus at ${corpus}: build one with node ingest/ingest.mjs noble`);
  process.exit(1);
}

const pages = new Map();
for (const file of readdirSync(corpus)) {
  if (file.endsWith(".json")) pages.set(file.replace(/\.json$/, ""), JSON.parse(readFileSync(join(corpus, file), "utf8")));
}

// The corpus may hold a page for a command path, not just the binary:
// "docker run" is docker-run(1).
const loadPage = (tool, args = []) => {
  const path = [tool];
  for (const arg of args) {
    if (arg.text.startsWith("-") || path.length >= 3) break;
    path.push(arg.text);
  }
  for (let n = path.length; n >= 1; n--) {
    const page = pages.get(path.slice(0, n).join("-"));
    if (page) return { ...page, subArgs: n - 1 };
  }
  return null;
};

const used = new Set();
for (const cmd of cmds) {
  const parsed = parse(cmd);
  await resolveCommands(parsed, (name, args) => {
    const page = loadPage(name, args);
    if (page) used.add(page.cmd);
    return page;
  }, {});
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const name of used) {
  const page = pages.get(name);
  const sample = {
    cmd: page.cmd,
    section: page.section ?? 1,
    source: page.source,
    options: page.options.map((o) => ({ names: o.names })),
    values: page.values,
    operands: page.operands.map((o) => ({ name: o.name })),
    ...(page.cluster ? { cluster: true } : {}),
    ...(page.builtin ? { builtin: true } : {}),
    // The shell's syntax, as bash(1) states it.
    ...(page.syntax ? { syntax: page.syntax } : {}),
  };
  writeFileSync(join(out, `${name}.json`), JSON.stringify(sample));
}

console.log(`wrote ${used.size} pages to ${out}`);
