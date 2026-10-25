import test from "node:test";
import assert from "node:assert/strict";
import { retrieve } from "../src/lib/retrieve.js";

// Older corpora have text-only chunks; rebuilt pages omit them. Neither case
// can be scored, so neither may spend an AI call on the question.
const page = (chunks) => ({ json: async () => ({ chunks }) });

test("a page whose chunks have no embedding is skipped, not fatal", async () => {
  const env = {
    AI: { run: async () => { assert.fail("no embedding should be requested without candidates"); } },
    CORPUS: { get: async () => page([{ text: "no embedding here" }]) },
  };
  assert.deepEqual(await retrieve(env, ["ubuntu/24.04"], ["tar"], "q"), []);
  env.CORPUS.get = async () => page(undefined);
  assert.deepEqual(await retrieve(env, ["ubuntu/24.04"], ["tar"], "q"), []);
  env.CORPUS.get = async () => null;
  assert.deepEqual(await retrieve(env, ["ubuntu/24.04"], ["tar"], "q"), []);
});

test("only the pages of the one-liner's own tools are considered", async () => {
  const asked = [];
  let calls = 0;
  const env = {
    AI: { run: async () => { calls++; return { data: [new Float32Array([1, 0])] }; } },
    CORPUS: {
      get: async (key) => {
        asked.push(key);
        return page([{ text: "x", embedding: [1, 0] }]);
      },
    },
  };
  const docs = await retrieve(env, ["ubuntu/24.04"], ["tar", "ssh"], "q");
  assert.deepEqual(asked, ["ubuntu/24.04/tar.json", "ubuntu/24.04/ssh.json"]);
  assert.equal(docs.length, 2);
  assert.equal(docs[0].tool, "tar");
  assert.equal(calls, 1);
  assert.equal(docs[0].score, 1);
  assert.equal("embedding" in docs[0], false);
});

test("no AI binding means no context, and no error", async () => {
  const env = { CORPUS: { get: async () => page([{ text: "x" }]) } };
  assert.deepEqual(await retrieve(env, ["ubuntu/24.04"], ["tar"], "q"), []);
});
