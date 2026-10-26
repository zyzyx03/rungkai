// The Promptfoo target is the app itself, so a test exercises the system
// prompt, validation, rate limit and response shape the reader sees.
import { completeLines } from "../../src/lib/sse.js";

const DEFAULT_BASE = process.env.RUNGKAI_PROMPTFOO_URL ?? "http://127.0.0.1:8788";

async function readSse(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let buffer = "";
  const consume = (line) => {
    if (!line.startsWith("data: ")) return;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") return;
    try {
      text += JSON.parse(payload).choices?.[0]?.delta?.content ?? "";
    } catch {}
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const next = completeLines(buffer, decoder.decode(value, { stream: true }));
    buffer = next.buffer;
    for (const line of next.lines) consume(line);
  }
  buffer += decoder.decode();
  if (buffer) consume(buffer);
  return text;
}

export default class RungkaiProvider {
  constructor(options = {}) {
    this.config = options.config ?? {};
  }

  id() {
    return "rungkai";
  }

  async callApi(prompt, context = {}) {
    const vars = context.vars ?? {};
    const base = vars.baseUrl ?? this.config.baseUrl ?? DEFAULT_BASE;
    const mode = vars.mode ?? this.config.mode ?? "suggest";
    const cmd = vars.cmd ?? "";
    const env = vars.env ?? "all";

    if (mode === "suggest") {
      const res = await fetch(`${base}/api/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request: prompt, cmd, env }),
      });
      const text = await res.text();
      if (!res.ok) return { error: `suggest ${res.status}: ${text.slice(0, 300)}` };
      return { output: text };
    }

    if (mode === "chat") {
      const messages = Array.isArray(vars.messages) && vars.messages.length
        ? vars.messages
        : [{ role: "user", content: prompt }];
      const token = process.env.RUNGKAI_CHAT_TOKEN ?? process.env.CHAT_TOKEN;
      const res = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ cmd: cmd || "ls", env, messages }),
      });
      if (!res.ok) {
        const text = await res.text();
        return { error: `chat ${res.status}: ${text.slice(0, 300)}` };
      }
      return { output: await readSse(res) };
    }

    if (mode === "tldr") {
      const res = await fetch(`${base}/api/tldr`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cmd: cmd || prompt, env }),
      });
      if (!res.ok) {
        const text = await res.text();
        return { error: `tldr ${res.status}: ${text.slice(0, 300)}` };
      }
      return { output: await readSse(res) };
    }

    return { error: `unknown mode: ${mode}` };
  }
}
