import test from "node:test";
import assert from "node:assert/strict";
import { completeLines } from "../src/lib/sse.js";

test("a line split across two network chunks is put back together", () => {
  const first = completeLines("", 'data: {"choices":[{"delta":{"content":"th');
  assert.deepEqual(first.lines, []);
  assert.equal(first.buffer, 'data: {"choices":[{"delta":{"content":"th');

  const second = completeLines(first.buffer, 'e"}}]}\n\ndata: [DONE]\n');
  assert.deepEqual(second.lines, ['data: {"choices":[{"delta":{"content":"the"}}]}', "", "data: [DONE]"]);
  assert.equal(second.buffer, "");
});

test("a whole line is handed back at once", () => {
  const { lines, buffer } = completeLines("", "data: one\n");
  assert.deepEqual(lines, ["data: one"]);
  assert.equal(buffer, "");
});
