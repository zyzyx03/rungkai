// Retrieval eval: does the question reach the page that documents it?
//   npm run eval:retrieval
// Reads the local corpora, embeds each question with the same model the
// worker uses, and reports hits@4. This is deliberately not part of npm test:
// it needs a Workers AI token and the built corpora.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { retrieve } from "../../src/lib/retrieve.js";
import { resolveEnv } from "../../src/lib/envs.js";
import { candidateTools } from "../../src/lib/candidates.js";

const root = new URL("../../", import.meta.url).pathname;
const arg = (name, fallback) => { const at = process.argv.indexOf(name); return at === -1 ? fallback : process.argv[at + 1]; };
const BASE = arg("--corpus-base", ".corpus");
const CORPORA = {
  "ubuntu/24.04": join(root, BASE, "noble/pages"),
  el9: join(root, BASE, "el9/pages"),
  "alpine/3.22": join(root, BASE, "alpine/pages"),
};

for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const useLocal = process.argv.includes("--local");
const useHttp = process.argv.includes("--http");
const MODEL = arg("--model", "BAAI/bge-small-en-v1.5");
const INSTRUCT = arg("--instruct", "");
const PROMPT = arg("--prompt-name", "");
const EMBED_URL = (process.env.EMBED_URL ?? "https://corpa.zyzyx.cc").replace(/\/$/, "");
const poolingAt = process.argv.indexOf("--pooling");
const POOLING = poolingAt !== -1 ? process.argv[poolingAt + 1] : "mean";
const CF_FIELD = arg("--cf-field", "");
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CF_WORKERS_AI_TOKEN;
if (!useLocal && !useHttp && (!account || !token)) {
  console.error("set CLOUDFLARE_ACCOUNT_ID and CF_WORKERS_AI_TOKEN in .env, or pass --local/--http");
  process.exit(1);
}

let extractor = null;
if (useLocal) {
  const { pipeline } = await import("@huggingface/transformers");
  extractor = await pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", { dtype: "fp32" });
}

const vectors = new Map();
async function embed(text) {
  if (!vectors.has(text)) {
    if (useHttp) {
      const res = await fetch(`${EMBED_URL}/v1/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: [INSTRUCT + text], model: MODEL, ...(PROMPT ? { prompt_name: PROMPT } : {}) }),
        signal: AbortSignal.timeout(600_000),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data?.data) || !Array.isArray(data.data[0]?.embedding)) {
        throw new Error(`${res.status} ${JSON.stringify(data?.errors ?? data).slice(0, 300)}`);
      }
      vectors.set(text, data.data[0].embedding);
    } else if (useLocal) {
      const out = await extractor(text, { pooling: POOLING, normalize: true, truncation: true });
      vectors.set(text, Array.from(out.data));
    } else {
      const field = CF_FIELD || (MODEL.includes("qwen3") ? "queries" : "text");
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${MODEL}`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(field === "text" ? { text: [INSTRUCT + text], pooling: POOLING } : { [field]: [INSTRUCT + text] }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(`${res.status} ${JSON.stringify(data?.errors ?? {})}`);
      vectors.set(text, data.result.data[0]);
    }
  }
  return vectors.get(text);
}

const env = {
  AI: { run: async (_model, { text }) => ({ data: [await embed(text[0])] }) },
  CORPUS: {
    get: async (key) => {
      const id = Object.keys(CORPORA).find((candidate) => key.startsWith(`${candidate}/`));
      if (!id) return null;
      const path = join(CORPORA[id], key.slice(id.length + 1));
      if (!existsSync(path)) return null;
      return { json: async () => JSON.parse(readFileSync(path, "utf8")) };
    },
  },
};

const questions = JSON.parse(readFileSync(join(root, "test/retrieval/questions.json"), "utf8"));
let hits = 0;
let exactHits = 0;
let exactTotal = 0;
let malayHits = 0;
let malayTotal = 0;
let first = 0;
for (const q of questions) {
  const envIds = resolveEnv(q.env);
  const tools = q.tools ?? (q.fresh ? await candidateTools(env, envIds, q.q) : []);
  const docs = await retrieve(env, envIds, tools, q.q, 4);
  const pages = new Set(docs.map((doc) => doc.tool));
  const pageHit = q.pages.some((page) => pages.has(page));
  const textHit = !q.text || docs.some((doc) => q.text.some((word) => doc.text.toLowerCase().includes(word.toLowerCase())));
  const hit = pageHit && textHit;
  if (hit) hits++;
  if (q.exact) {
    exactTotal++;
    if (hit) exactHits++;
  }
  if (q.malay) {
    malayTotal++;
    if (hit) malayHits++;
  }
  if (docs[0] && q.pages.includes(docs[0].tool)) first++;
  console.log(
    `${hit ? "OK  " : "MISS"} ${q.q}` +
      `\n     tools=${tools.join(",") || "(none)"} got=${[...pages].join(",") || "(none)"}` +
      ` scores=${docs.map((doc) => doc.score.toFixed(2)).join(",") || "-"}` +
      (q.text ? ` want=${q.text.join("|")} textHit=${textHit}` : ""),
  );
}
console.log(`\nhits@4 ${hits}/${questions.length}  exact-flag ${exactHits}/${exactTotal}  malay ${malayHits}/${malayTotal}  top1-page ${first}/${questions.length}`);
