import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { parse } from "./parser.mjs";
import { explain } from "../src/lib/explain.js";
import { resolveCommands } from "../src/lib/wrap.js";
import { loadPage } from "../src/lib/pages.js";
import { loadPages } from "../ingest/audit.mjs";

const DIR = ".corpus/noble/pages";
const pages = new Map();
if (existsSync(DIR)) for (const [key, page] of loadPages(DIR)) pages.set(key, page);

test("every practical go command is explained from go help", {
  skip: pages.size ? false : "no corpus",
}, async () => {
  const cases = ["go", "go build -o app ./cmd", "go test -v ./...", "go run -race main.go", "go env -w GOPROXY=direct", "go mod tidy"];
  const bad = [];
  for (const cmd of cases) {
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
