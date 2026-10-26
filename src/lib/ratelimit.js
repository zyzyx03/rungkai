// A token bucket: it starts full, every request spends one token, and tokens
// refill at limit/period per second. A burst up to the limit passes; a steady
// client is held to the average. The state is one small record per client.
export function hit(bucket, limit, period, now) {
  const perSecond = limit / period;
  const tokens = Math.min(
    limit,
    (bucket?.tokens ?? limit) + (Math.max(0, now - (bucket?.at ?? now)) / 1000) * perSecond,
  );
  const allowed = tokens >= 1;
  const left = allowed ? tokens - 1 : tokens;
  // Once the bucket is full again the object has nothing to remember, so the
  // alarm can delete it. Until then, keep the time it will be full.
  const fullInMs = perSecond > 0 ? Math.ceil(((limit - left) / perSecond) * 1000) : 0;
  // How long until this client can make one request again.
  const retryAfterMs = allowed ? 0 : perSecond > 0 ? Math.ceil(((1 - tokens) / perSecond) * 1000) : period * 1000;
  return { allowed, retryAfterMs, bucket: { tokens: left, at: now, fullAt: now + fullInMs } };
}
