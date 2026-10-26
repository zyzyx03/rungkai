import test from "node:test";
import assert from "node:assert/strict";
import { hit } from "../src/lib/ratelimit.js";
import { RateLimit } from "../src/worker/ratelimit.js";

test("a token bucket starts full, spends one token, and refills at the average rate", () => {
  // Two tokens, one per second.
  const first = hit(null, 2, 2, 0);
  assert.equal(first.allowed, true);
  assert.equal(first.bucket.tokens, 1);

  const second = hit(first.bucket, 2, 2, 0);
  assert.equal(second.allowed, true);
  assert.equal(second.bucket.tokens, 0);

  const third = hit(second.bucket, 2, 2, 0);
  assert.equal(third.allowed, false);
  assert.equal(third.retryAfterMs, 1000);

  // A second later there is one token again.
  const fourth = hit(third.bucket, 2, 2, 1000);
  assert.equal(fourth.allowed, true);
  assert.equal(fourth.bucket.tokens, 0);

  // A long idle refills only to the capacity.
  const fifth = hit(fourth.bucket, 2, 2, 1_000_000);
  assert.equal(fifth.allowed, true);
  assert.equal(fifth.bucket.tokens, 1);
});

function mockState() {
  const store = new Map();
  return {
    store,
    storage: {
      async get(key) { return store.get(key); },
      async put(key, value) { store.set(key, value); },
      async setAlarm(time) { store.set("alarm", time); },
      async deleteAll() { store.clear(); },
    },
  };
}

const call = (limiter, limit = 2, period = 2) =>
  limiter.fetch(new Request("https://rate-limit/", {
    method: "POST",
    body: JSON.stringify({ limit, period }),
  })).then((res) => res.json());

test("the object keeps the bucket in storage and schedules its cleanup", async () => {
  const state = mockState();
  const limiter = new RateLimit(state, {});
  assert.equal((await call(limiter)).allowed, true);
  assert.equal((await call(limiter)).allowed, true);
  const refused = await call(limiter);
  assert.equal(refused.allowed, false);
  assert.equal(refused.retryAfter, 1);
  const bucket = state.store.get("bucket");
  assert.ok(bucket.tokens < 1, "the refused request leaves less than one token");
  assert.equal(state.store.get("alarm"), bucket.fullAt);
});

test("the alarm clears a full bucket and waits for one that is still filling", async () => {
  const state = mockState();
  const limiter = new RateLimit(state, {});
  await call(limiter, 2, 2);
  await limiter.alarm();
  assert.ok(state.store.has("bucket"), "a bucket that is still filling survives a stale alarm");

  const bucket = state.store.get("bucket");
  bucket.fullAt = Date.now() - 1;
  state.store.set("bucket", bucket);
  await limiter.alarm();
  assert.equal(state.store.size, 0);
});
