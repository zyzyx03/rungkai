import { hit } from "../lib/ratelimit.js";

// One object per limiter and client IP, so two clients never contend. The
// bucket lives in storage; an alarm deletes it once it has refilled, so an
// idle client leaves nothing behind.
export class RateLimit {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const { limit, period } = await request.json();
    const result = hit(await this.state.storage.get("bucket"), limit, period, Date.now());
    await this.state.storage.put("bucket", result.bucket);
    await this.state.storage.setAlarm(result.bucket.fullAt);
    return Response.json({
      allowed: result.allowed,
      remaining: Math.floor(result.bucket.tokens),
      retryAfter: Math.ceil(result.retryAfterMs / 1000),
    });
  }

  // A stale alarm must not clear a bucket that a newer request has refilled;
  // wait until the stored time unless it has already passed.
  async alarm() {
    const bucket = await this.state.storage.get("bucket");
    if (!bucket) return void (await this.state.storage.deleteAll());
    if (!bucket.fullAt || bucket.fullAt <= Date.now()) {
      await this.state.storage.deleteAll();
      return;
    }
    await this.state.storage.setAlarm(bucket.fullAt);
  }
}
