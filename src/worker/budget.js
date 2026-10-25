import { take, adjust } from "../lib/budget.js";

// One Durable Object for the whole site: only money lives here.
export class Budget {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.bucket = null;
  }

  async load() {
    if (!this.bucket) {
      this.bucket = (await this.state.storage.get("bucket")) ?? {
        micro: Number(this.env.DAILY_BUDGET_MICRO),
        at: Date.now(),
      };
    }
    return this.bucket;
  }

  async fetch(request) {
    const { op, micro } = await request.json();
    const capacity = Number(this.env.DAILY_BUDGET_MICRO);
    const perSecond = capacity / 86400;
    const bucket = await this.load();

    if (op === "take") {
      const result = take(bucket, micro, Date.now(), capacity, perSecond);
      this.bucket = result.bucket;
      await this.state.storage.put("bucket", result.bucket);
      return Response.json({ ok: result.ok });
    }

    if (op === "adjust") {
      this.bucket = adjust(bucket, micro, Date.now(), capacity);
      await this.state.storage.put("bucket", this.bucket);
      return Response.json({ ok: true });
    }

    return new Response("bad op", { status: 400 });
  }
}
