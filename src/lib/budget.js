// Money is counted in micro-USD so token prices stay integers.
export function take(bucket, cost, now, capacity, perSecond) {
  const elapsed = Math.max(0, (now - bucket.at) / 1000);
  const micro = Math.min(capacity, bucket.micro + elapsed * perSecond);
  if (micro < cost) return { ok: false, bucket: { micro, at: now } };
  return { ok: true, bucket: { micro: micro - cost, at: now } };
}

export function adjust(bucket, delta, now, capacity) {
  return { micro: Math.min(capacity, Math.max(0, bucket.micro + delta)), at: now };
}
