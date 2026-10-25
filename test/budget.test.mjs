import test from "node:test";
import assert from "node:assert/strict";
import { take, adjust } from "../src/lib/budget.js";

const CAP = 1_000_000;
const RATE = CAP / 86400; // one day's budget per day

test("spends when the bucket has money", () => {
  const r = take({ micro: 1000, at: 0 }, 400, 0, CAP, RATE);
  assert.equal(r.ok, true);
  assert.equal(r.bucket.micro, 600);
});

test("refuses when empty and does not go negative", () => {
  const r = take({ micro: 100, at: 0 }, 400, 0, CAP, RATE);
  assert.equal(r.ok, false);
  assert.equal(r.bucket.micro, 100);
});

test("refills over time but never above capacity", () => {
  const day = 86_400_000;
  const r = take({ micro: 0, at: 0 }, 5, day, CAP, RATE);
  assert.equal(r.ok, true);
  assert.equal(r.bucket.micro, CAP - 5);
});

test("adjust clamps to [0, capacity]", () => {
  assert.equal(adjust({ micro: 10, at: 0 }, 50, 0, CAP).micro, 60);
  assert.equal(adjust({ micro: 10, at: 0 }, -50, 0, CAP).micro, 0);
  assert.equal(adjust({ micro: CAP, at: 0 }, 50, 0, CAP).micro, CAP);
});

test("take then adjust charges actual usage or refunds the estimate", () => {
  const est = 390;
  for (const balance of [CAP, 5000]) {
    const taken = take({ micro: balance, at: 0 }, est, 0, CAP, RATE);
    assert.equal(taken.ok, true);
    for (const actual of [0, 300, 500]) {
      assert.equal(adjust(taken.bucket, est - actual, 0, CAP).micro, balance - actual);
    }
    assert.equal(adjust(taken.bucket, est, 0, CAP).micro, balance);
  }
});
