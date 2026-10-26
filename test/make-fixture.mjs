// Refresh the corpus sample the one-liner test runs against.
//
// The corpus itself is not in the repository: it is a build of a
// distribution's man pages, and it changes with every release. The test
// needs pages to run against, so the pages the one-liners actually use are
// copied here with their descriptions, so losing the page's words fails tests.
//
//   node test/make-fixture.mjs [corpus dir]
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parse } from "./parser.mjs";
import { resolveCommands } from "../src/lib/wrap.js";
import { loadPage } from "../src/lib/pages.js";

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

const used = new Set();
const pageFor = loadPage(pages);
for (const cmd of cmds) {
  const parsed = parse(cmd);
  await resolveCommands(parsed, (name, args) => {
    const page = pageFor(name, args);
    if (page) used.add(page.cmd);
    return page;
  }, {});
}

// A rebuild must not silently turn previously documented entries into gaps.
for (const name of used) {
  const file = join(out, `${name}.json`);
  if (!existsSync(file)) continue;
  const previous = JSON.parse(readFileSync(file, "utf8"));
  const page = pages.get(name);
  for (const kind of ["options", "operands"]) {
    for (const entry of previous[kind] ?? []) {
      if (!entry.desc) continue;
      const matches = (page[kind] ?? []).filter((candidate) => kind === "operands"
        ? candidate.name === entry.name
        : candidate.names.length === entry.names.length && candidate.names.every((n) => entry.names.includes(n)));
      if (!matches.some((candidate) => candidate.desc?.trim())) {
        throw new Error(`${name}: lost ${kind} description for ${entry.name ?? entry.names.join(", ")}`);
      }
    }
  }
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const name of used) {
  const page = pages.get(name);
  const sample = {
    cmd: page.cmd,
    env: page.env,
    section: page.section ?? 1,
    source: page.source,
    synopsis: page.synopsis,
    description: page.description,
    options: page.options,
    values: page.values,
    operands: page.operands,
    ...(page.cluster ? { cluster: true } : {}),
    ...(page.builtin ? { builtin: true } : {}),
    // The shell's syntax, as bash(1) states it.
    ...(page.syntax ? { syntax: page.syntax } : {}),
  };
  writeFileSync(join(out, `${name}.json`), JSON.stringify(sample));
}

console.log(`wrote ${used.size} pages to ${out}`);
