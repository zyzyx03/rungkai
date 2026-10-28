import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { SAMPLE_GROUPS } from "../src/lib/examples.js";
import { parse } from "./parser.mjs";
import { explain } from "../src/lib/explain.js";
import { resolveCommands } from "../src/lib/wrap.js";
import { loadPage } from "../src/lib/pages.js";
import { loadPages } from "../ingest/audit.mjs";

// The home page's examples are the product's promise in miniature: every
// token explained, nothing red. They name the corpus they run against.
const CORPUS = {
  "ubuntu/24.04": ".corpus/noble/pages",
  el9: ".corpus/el9/pages",
  "alpine/3.22": ".corpus/alpine/3.22/pages",
};
const present = Object.values(CORPUS).filter((dir) => existsSync(dir));

function pagesFor(env) {
  const dirs = env === "all" ? present : [CORPUS[env]].filter((dir) => dir && existsSync(dir));
  const pages = new Map();
  for (const dir of dirs) for (const [key, page] of loadPages(dir)) pages.set(key, page);
  return pages;
}

async function problems(cmd, pages, env) {
  const parsed = parse(cmd);
  const map = {};
  const commands = await resolveCommands(parsed, loadPage(pages), map);
  const result = explain(cmd, { ...parsed, commands }, map, env);
  return [
    ...result.segments.filter((s) => s.kind === "unknown").map((s) => `undocumented ${s.text}`),
    ...result.segments.filter((s) => s.anchor && !s.anchor.desc && s.kind !== "unknown").map((s) => `undocumented ${s.kind} ${s.text}`),
    ...result.gaps.map((name) => `no page for ${name}`),
  ];
}

test("every promoted example is explained by the corpus it names", {
  skip: present.length ? false : "no corpus: build one with node ingest/ingest.mjs noble",
}, async (t) => {
  const bad = [];
  for (const group of SAMPLE_GROUPS) {
    const env = group.env ?? "all";
    const pages = pagesFor(env);
    // A corpus that was never built is a data gap, not an example bug. The
    // shipped Ubuntu corpus is enforced; the others say what they are missing.
    if (group.env && group.env !== "ubuntu/24.04") {
      const missing = new Set();
      for (const item of group.commands) {
        for (const command of parse(item.cmd).commands) {
          if (!loadPage(pages)(command.name, command.args)) missing.add(command.name);
        }
      }
      if (missing.size) {
        t.diagnostic(`skip ${group.tab}: its corpus has no page for ${[...missing].join(", ")}`);
        continue;
      }
    }
    for (const item of group.commands) {
      const found = await problems(item.cmd, pages, env);
      if (found.length) bad.push(`${group.tab}: ${item.cmd} → ${found.join(", ")}`);
    }
  }
  assert.deepEqual(bad, []);
});
