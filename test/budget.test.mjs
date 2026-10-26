import test from "node:test";
import assert from "node:assert/strict";
import { take, adjust, settledCost } from "../src/lib/budget.js";

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

test("adjust caps refunds but carries an overspend as debt", () => {
  assert.equal(adjust({ micro: 10, at: 0 }, 50, 0, CAP).micro, 60);
  assert.equal(adjust({ micro: 10, at: 0 }, -50, 0, CAP).micro, -40);
  assert.equal(adjust({ micro: CAP, at: 0 }, 50, 0, CAP).micro, CAP);
});

test("a debt keeps the next request out until the refill repays it", () => {
  const spent = adjust({ micro: 0, at: 0 }, 400 - 900, 0, CAP);
  assert.equal(spent.micro, -500);
  assert.equal(take(spent, 100, 0, CAP, RATE).ok, false);
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

test("a settled stream charges usage, the estimate when only content arrived, and nothing when it did not", () => {
  const est = 390;
  assert.equal(settledCost(est, { prompt_tokens: 100, completion_tokens: 200 }, true, 0.15, 0.6), 100 * 0.15 + 200 * 0.6);
  // Words arrived without a usage block: the model was paid, so the estimate stands.
  assert.equal(settledCost(est, null, true, 0.15, 0.6), est);
  // A stream that delivered nothing is refunded whole.
  assert.equal(settledCost(est, null, false, 0.15, 0.6), 0);
  assert.equal(settledCost(est, undefined, true, 0.15, 0.6), est);
});
