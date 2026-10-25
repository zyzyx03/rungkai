import test from "node:test";
import assert from "node:assert/strict";
import { resolveEnv } from "../src/lib/envs.js";

test("all lists each corpus once, deduping aliases", () => {
  const all = resolveEnv("all");
  assert.deepEqual(all, ["ubuntu/24.04", "el9", "alpine/3.22"]);
});

test("a corpus id resolves to itself", () => {
  assert.deepEqual(resolveEnv("el9"), ["el9"]);
});
