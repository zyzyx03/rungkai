import { take, adjust } from "../lib/budget.js";

// One Durable Object for the whole site: only money lives here.
export class Budget {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  // The bucket is read from storage on every op. The object serves one request
  // at a time, so the read-modify-write below is atomic; a copy kept in memory
  // would be a value that a second op has already replaced.
  async fetch(request) {
    const { op, micro } = await request.json();
    const capacity = Number(this.env.DAILY_BUDGET_MICRO);
    const perSecond = capacity / 86400;
    const bucket = (await this.state.storage.get("bucket")) ?? { micro: capacity, at: Date.now() };

    if (op === "take") {
      const result = take(bucket, micro, Date.now(), capacity, perSecond);
      await this.state.storage.put("bucket", result.bucket);
      return Response.json({ ok: result.ok });
    }

    if (op === "adjust") {
      await this.state.storage.put("bucket", adjust(bucket, micro, Date.now(), capacity));
      return Response.json({ ok: true });
    }

    return new Response("bad op", { status: 400 });
  }
}
