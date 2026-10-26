import test from "node:test";
import assert from "node:assert/strict";
import { commandHash } from "../src/lib/cache.js";

test("the same command always gets the same name", async () => {
  assert.equal(await commandHash("ls -la"), await commandHash("ls -la"));
});

test("two commands never get the same name", async () => {
  const a = await commandHash("ls -la");
  const b = await commandHash("ls -lb");
  assert.notEqual(a, b);
});

test("the name is short enough to be a key", async () => {
  const hash = await commandHash("x".repeat(1024));
  assert.equal(hash.length, 32);
  assert.match(hash, /^[0-9a-f]{32}$/);
});

test("the name does not carry the command", async () => {
  const hash = await commandHash("mysql -uroot -pS3cret db");
  assert.ok(!hash.includes("S3cret"));
  assert.ok(!hash.includes("mysql"));
});
