// Audit the corpus: for every page, build command lines from the page's own
// options and run them through the explainer.
//
// The point is the tools nobody put in the test list. A page that names an
// option the matcher cannot match, in any of the forms a person writes it,
// shows up here rather than in a bug report.
//
//   node ingest/audit.mjs [corpus dir]
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../test/parser.mjs";
import { explain } from "../src/lib/explain.js";
import { loadPage } from "../src/lib/pages.js";
import { resolveCommands } from "../src/lib/wrap.js";

// The forms a person writes an option in. Each is a command line of its own,
// so a form the matcher cannot read is a form that goes red.
function commandsFor(page) {
  const long = [];
  const short = [];
  const placeholder = [];
  for (const option of page.options ?? []) {
    for (const name of option.names) {
      if (name.startsWith("--")) long.push(name);
      else if (/^-[A-Za-z@]$/.test(name)) short.push(name);
      else if (name.startsWith("-<")) placeholder.push(name);
    }
  }
  const value = page.values ?? {};
  const hasValue = (name) => Boolean(value[name]);

  const lines = [];
  if (long.length) lines.push([page.cmd, ...long.slice(0, 3)].join(" "));
  if (short.length) lines.push([page.cmd, ...short.slice(0, 3)].join(" "));
  if (short.length >= 2) lines.push([page.cmd, short.slice(0, 3).join("")].join(" "));
  const withValue = short.find(hasValue) ?? long.find(hasValue);
  if (withValue) lines.push(`${page.cmd} ${withValue} value`);
  const attaches = short.find((n) => hasValue(n));
  if (attaches) lines.push(`${page.cmd} ${attaches}value`);
  for (const name of placeholder.slice(0, 1)) {
    lines.push(`${page.cmd} ${name.replace(/<[^>]+>/, "10")}`);
  }
  return lines.filter((line) => line !== page.cmd);
}

// The pages, and how they are found in the corpus: "docker run" is
// docker-run(1), so a command path is a page path.
export function loadPages(dir) {
  const pages = new Map();
  for (const file of readdirSync(dir)) {
    if (file.endsWith(".json") && !file.includes(".shard.") && !file.startsWith("_") && !file.endsWith(".lite.json")) pages.set(file.replace(/\.json$/, ""), JSON.parse(readFileSync(join(dir, file), "utf8")));
  }
  return pages;
}

// Every command line the corpus implies, and what the explainer makes of
// them: the flags it could not place, and the options it had no words for.
export async function audit(pages) {
  const unexplained = [];
  const silent = [];
  const documentationGaps = [];
  let checked = 0;
  for (const page of pages.values()) {
    for (const [kind, entries] of [["option", page.options ?? []], ["operand", page.operands ?? []]]) {
      for (const entry of entries) {
        const label = `${page.cmd}: ${kind} ${entry.names?.join(", ") ?? entry.name}`;
        if (!entry.desc?.trim()) {
          if (entry.gap === true) documentationGaps.push(label);
          else silent.push(label);
        } else if (entry.gap) silent.push(`${label}: has both text and a gap marker`);
      }
    }
    if (page.builtin) continue;
    for (const cmd of commandsFor(page)) {
      const parsed = parse(cmd);
      const map = {};
      const commands = await resolveCommands(parsed, loadPage(pages), map);
      const result = explain(cmd, { ...parsed, commands }, map, "audit");
      checked++;
      const unknown = result.segments.filter((s) => s.kind === "unknown").map((s) => s.text);
      const gaps = result.gaps;
      if (unknown.length || gaps.length) {
        unexplained.push(`${page.cmd}: ${cmd} → undocumented ${unknown.join(" ")}${gaps.length ? `, no page for ${gaps.join(" ")}` : ""}`);
      }
    }
  }
  return { checked, unexplained, silent, documentationGaps };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ?? ".corpus/noble/pages";
  const pages = loadPages(dir);
  const { checked, unexplained, silent, documentationGaps } = await audit(pages);
  console.log(`${pages.size} pages, ${checked} command lines checked`);
  console.log(`\n${unexplained.length} leave something unexplained:`);
  for (const line of unexplained.slice(0, 40)) console.log("  " + line);
  console.log(`\n${silent.length} missing descriptions without an explicit gap:`);
  for (const line of silent.slice(0, 40)) console.log("  " + line);
  console.log(`\n${documentationGaps.length} explicit documentation gaps`);
  if (silent.length || unexplained.length) process.exitCode = 1;
}
