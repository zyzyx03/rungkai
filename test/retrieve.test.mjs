import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("without an AI binding, text chunks are scored by word overlap", async () => {
  const env = { CORPUS: { get: async () => page([{ text: "copy files recursively" }, { text: "list directories" }]) } };
  const docs = await retrieve(env, ["ubuntu/24.04"], ["rsync"], "recursive copy");
  assert.equal(docs.length, 2);
  assert.equal(docs[0].text, "copy files recursively");
  assert.equal("embedding" in docs[0], false);
});

test("the local fallback hands the injected man-page excerpt to retrieval", async () => {
  const injected = JSON.parse(readFileSync(new URL("./promptfoo/fixtures/rsync-injected.json", import.meta.url)));
  const env = {
    CORPUS: { get: async (key) => (key === "ubuntu/24.04/rsync.json" ? { json: async () => injected } : null) },
  };
  const docs = await retrieve(env, ["ubuntu/24.04"], ["rsync"], "Add a progress display to this command.");
  assert.equal(docs.length, 1);
  assert.match(docs[0].text, /PWNED/);
});
