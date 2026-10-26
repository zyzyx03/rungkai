// Money is counted in micro-USD so token prices stay integers.
export function take(bucket, cost, now, capacity, perSecond) {
  const elapsed = Math.max(0, (now - bucket.at) / 1000);
  const micro = Math.min(capacity, bucket.micro + elapsed * perSecond);
  if (micro < cost) return { ok: false, bucket: { micro, at: now } };
  return { ok: true, bucket: { micro: micro - cost, at: now } };
}

// A real cost above the reservation leaves a negative bucket. Keep the debt:
// the refill pays it back before a new request is allowed, so one long answer
// cannot outrun the daily budget.
export function adjust(bucket, delta, now, capacity) {
  return { micro: Math.min(capacity, bucket.micro + delta), at: now };
}

// What a streamed completion costs once it has ended. Usage is the bill;
// without it, an answer that started means the model was paid, so the
// estimate stands, and a stream that never started is refunded whole.
export function settledCost(est, usage, answered, inRate, outRate) {
  if (usage) return usage.prompt_tokens * inRate + usage.completion_tokens * outRate;
  return answered ? est : 0;
}
