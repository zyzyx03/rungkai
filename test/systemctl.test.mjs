import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { parse } from "./parser.mjs";
import { explain } from "../src/lib/explain.js";
import { resolveCommands } from "../src/lib/wrap.js";
import { loadPage } from "../src/lib/pages.js";
import { loadPages } from "../ingest/audit.mjs";

const DIR = ".corpus/noble/pages";
const pages = new Map();
if (existsSync(DIR)) for (const [key, page] of loadPages(DIR)) pages.set(key, page);

test("every systemctl subcommand page explains without an empty card", {
  skip: pages.size ? false : "no corpus",
}, async () => {
  const names = readdirSync(DIR)
    .filter((file) => file.startsWith("systemctl-") && file.endsWith(".json") && !file.endsWith(".lite.json"))
    .map((file) => file.slice("systemctl-".length, -".json".length));
  assert.ok(names.length >= 70, `expected every command, found ${names.length}`);
  const bad = [];
  for (const name of names) {
    const cmd = `systemctl ${name}`;
    const parsed = parse(cmd);
    const map = {};
    const commands = await resolveCommands(parsed, loadPage(pages), map);
    const result = explain(cmd, { ...parsed, commands }, map, "ubuntu/24.04");
    const found = [
      ...result.segments.filter((s) => s.kind === "unknown").map((s) => `unknown ${s.text}`),
      ...result.segments.filter((s) => s.anchor && !s.anchor.desc && s.kind !== "unknown").map((s) => `empty ${s.text}`),
      ...result.gaps.map((g) => `gap ${g}`),
    ];
    if (found.length) bad.push(`${cmd} → ${found.join(", ")}`);
  }
  assert.deepEqual(bad, []);
});
