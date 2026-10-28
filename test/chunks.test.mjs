import test from "node:test";
import assert from "node:assert/strict";
import { chunksOf } from "../ingest/chunks.mjs";

test("a page's prose and each documented flag become retrievable chunks", () => {
  const page = {
    synopsis: "copy files",
    description: "Copies files. It can recurse.",
    options: [
      { names: ["-a", "--archive"], desc: "archive mode" },
      { names: ["-v"], desc: "verbose" },
    ],
    operands: [{ name: "src", desc: "what to copy" }],
  };
  const chunks = chunksOf(page);
  assert.ok(chunks.includes("copy files"));
  assert.ok(chunks.some((chunk) => chunk.startsWith("-a, --archive: archive mode")));
  assert.ok(chunks.some((chunk) => chunk.startsWith("src: what to copy")));
  assert.deepEqual(chunks, [...new Set(chunks)]);
  assert.ok(chunks.length <= 128);
});

test("a long description is cut into chunks, none of them huge", () => {
  const page = { synopsis: "x", description: "A sentence about the tool. ".repeat(200).trim() };
  const chunks = chunksOf(page);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(chunk.length <= 800);
});

test("a page with nothing to say offers no chunks", () => {
  assert.deepEqual(chunksOf({}), []);
});

test("every documented option gets its own chunk up to the cap", () => {
  const options = Array.from({ length: 20 }, (_, i) => ({ names: [`--flag-${i}`], desc: `does ${i}` }));
  const chunks = chunksOf({ synopsis: "x", options });
  assert.equal(chunks.filter((chunk) => chunk.startsWith("--flag-")).length, 20);
});
