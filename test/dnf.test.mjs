import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { parse } from "./parser.mjs";
import { explain } from "../src/lib/explain.js";
import { resolveCommands } from "../src/lib/wrap.js";
import { loadPage } from "../src/lib/pages.js";
import { loadPages } from "../ingest/audit.mjs";

const DIR = ".corpus/el9/pages";
const TOOLS = ["dnf", "yum"];
const pages = new Map();
if (existsSync(DIR)) for (const [key, page] of loadPages(DIR)) pages.set(key, page);

test("every dnf and yum command page explains without an empty card", {
  skip: pages.size ? false : "no el9 corpus",
}, async () => {
  const bad = [];
  for (const tool of TOOLS) {
    const names = readdirSync(DIR)
      .filter((file) => file.startsWith(`${tool}-`) && file.endsWith(".json") && !file.endsWith(".lite.json"))
      .map((file) => file.slice(tool.length + 1, -".json".length));
    assert.ok(names.length >= 30, `${tool}: expected every command, found ${names.length}`);
    for (const name of names) {
      const cmd = `${tool} ${name}`;
      const parsed = parse(cmd);
      const map = {};
      const commands = await resolveCommands(parsed, loadPage(pages), map);
      const result = explain(cmd, { ...parsed, commands }, map, "el9");
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
