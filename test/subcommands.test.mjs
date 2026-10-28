import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { parse } from "./parser.mjs";
import { explain } from "../src/lib/explain.js";
import { resolveCommands } from "../src/lib/wrap.js";
import { loadPage } from "../src/lib/pages.js";
import { loadPages } from "../ingest/audit.mjs";

const CASES = [
  ["noble", ".corpus/noble/pages", "debugfs", 70],
  ["noble", ".corpus/noble/pages", "parted", 18],
  ["noble", ".corpus/noble/pages", "pip", 8],
  ["noble", ".corpus/noble/pages", "go", 14],
  ["el9", ".corpus/el9/pages", "gpg-card", 30],
];

test("the generated command pages explain without an empty card", {
  skip: CASES.some(([, dir]) => existsSync(dir)) ? false : "no corpus",
}, async () => {
  const bad = [];
  for (const [env, dir, tool, min] of CASES) {
    if (!existsSync(dir)) continue;
    const pages = new Map();
    for (const [key, page] of loadPages(dir)) pages.set(key, page);
    const names = readdirSync(dir)
      .filter((f) => f.startsWith(`${tool}-`) && f.endsWith(".json") && !f.endsWith(".lite.json"))
      .map((f) => f.slice(tool.length + 1, -".json".length));
    assert.ok(names.length >= min, `${tool}: expected >= ${min}, found ${names.length}`);
    for (const name of names) {
      const cmd = `${tool} ${name}`;
      const parsed = parse(cmd);
      const map = {};
      const commands = await resolveCommands(parsed, loadPage(pages), map);
      const result = explain(cmd, { ...parsed, commands }, map, env);
      const found = [
        ...result.segments.filter((s) => s.kind === "unknown").map((s) => `unknown ${s.text}`),
        ...result.segments.filter((s) => s.anchor && !s.anchor.desc && s.kind !== "unknown").map((s) => `empty ${s.text}`),
        ...result.gaps.map((g) => `gap ${g}`),
      ];
      if (found.length) bad.push(`${cmd} → ${found.join(", ")}`);
    }
  }
  assert.deepEqual(bad, []);
});
