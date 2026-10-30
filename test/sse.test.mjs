import test from "node:test";
import assert from "node:assert/strict";
import { completeLines, deltaStream } from "../src/lib/sse.js";

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

test("a forwarded stream carries the words and nothing about the backend", async () => {
  const upstream = [
    'data: {"id":"1","model":"deepseek-flash","system_fingerprint":"fp","choices":[{"delta":{"role":"assistant"}}]}\n\n',
    'data: {"id":"1","model":"deepseek-flash","system_fingerprint":"fp","choices":[{"delta":{"content":"Lis"}}]}\n\n',
    'data: {"id":"1","model":"deepseek-flash","system_fingerprint":"fp","choices":[{"delta":{"content":"ten"}}]}\n\n',
    'data: {"id":"1","model":"deepseek-flash","choices":[],"usage":{"prompt_tokens":7}}\n\n',
    "data: [DONE]\n\n",
  ].join("");
  // A chunk boundary inside an event must not leak a partial event either.
  const stream = new ReadableStream({
    start(controller) {
      const bytes = new TextEncoder().encode(upstream);
      controller.enqueue(bytes.slice(0, 17));
      controller.enqueue(bytes.slice(17, 180));
      controller.enqueue(bytes.slice(180));
      controller.close();
    },
  });
  const text = await new Response(deltaStream(stream)).text();
  assert.equal(
    text,
    'data: {"choices":[{"delta":{"content":"Lis"}}]}\n\ndata: {"choices":[{"delta":{"content":"ten"}}]}\n\ndata: [DONE]\n\n',
  );
  assert.ok(!text.includes("model"));
  assert.ok(!text.includes("system_fingerprint"));
  assert.ok(!text.includes("usage"));
});
