import test from "node:test";
import assert from "node:assert/strict";
import { shardPage, flagCandidates, SHARD_SIZE } from "../src/lib/shards.js";

test("a large page is split into option shards", () => {
  const options = Array.from({ length: SHARD_SIZE * 2 + 5 }, (_, i) => ({ names: [`--flag${i}`, `-f${i}`], desc: `flag ${i}` }));
  const page = { synopsis: "large", description: "many flags", options, values: { "--flag0": "x" }, operands: [] };
  const { main, shards } = shardPage(page, 200 * 1024);
  assert.equal(main.options.length, 0);
  assert.equal(main.shards["--flag0"], 0);
  assert.equal(shards.length, 3);
  assert.equal(shards[0].options.length, SHARD_SIZE);
  assert.equal(shards[0].values["--flag0"], "x");
});

test("only shard names the command can use are fetched", () => {
  const shards = { "-O": 0, "-O2": 0, "--march": 1, "-I": 2, "-o": 2 };
  assert.deepEqual(
    [...flagCandidates([{ text: "-O2" }, { text: "--march=native" }, { text: "-I/usr/include" }, { text: "-o" }], shards)].sort(),
    ["--march", "-I", "-O", "-O2", "-o"],
  );
});
