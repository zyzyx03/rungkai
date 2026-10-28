// Push one Corpus to R2. node ingest/upload.mjs ubuntu/24.04 .corpus/noble/pages [--local] [--delete]
// --delete mirrors the directory into that environment prefix (S3 path only).
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeIndex } from "./index.mjs";

const envId = process.argv[2] ?? "ubuntu/24.04";
const dir = process.argv[3] ?? ".corpus/noble/pages";
const local = process.argv.includes("--local");
const del = process.argv.includes("--delete");
const wrangler = "node_modules/.bin/wrangler";

// The index and the manifest describe what is about to be uploaded, so they
// are rebuilt here and cannot drift from the corpus.
const pageCount = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_")).length;
const indexed = writeIndex(dir);
writeFileSync(
  join(dir, "_meta.json"),
  JSON.stringify({ built: new Date().toISOString(), pages: pageCount, indexed, embedding: process.env.EMBED_MODEL ?? "@cf/baai/bge-small-en-v1.5" }),
);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
if (local && del) console.warn("--delete applies to the S3 path only");

const BUCKET = "rungkai-corpus";

// The dev server serves its local R2 over this API. One request per page
// instead of one wrangler process per page: the CLI takes a couple of
// seconds a file, which is about half an hour for a full Ubuntu corpus, and
// this is seconds.
const DEV_API = process.env.RUNGKAI_DEV_URL ?? "http://localhost:8787";

const devApiAvailable = async () => {
  try {
    const res = await fetch(`${DEV_API}/cdn-cgi/local/explorer/api/r2/buckets`);
    return res.ok;
  } catch {
    return false;
  }
};

const putDev = async (key, body) => {
  const url = `${DEV_API}/cdn-cgi/local/explorer/api/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: "PUT", headers: { "content-type": "application/json" }, body });
  if (!res.ok) throw new Error(`${res.status} ${key}`);
};

// Only the local store has the dev server's API; a remote bucket goes
// through the wrangler CLI, which talks to R2 over the network.
const useDevApi = local && (await devApiAvailable());
if (local && !useDevApi) {
  console.log(`no dev server on ${DEV_API}, falling back to the wrangler CLI (slow)`);
}

// R2s S3 API moves the directory from one process. The wrangler CLI starts a
// Node process per object and takes seconds a file, so a full corpus is a
// minute here rather than an hour.
const s3Env = {
  ...process.env,
  AWS_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  AWS_DEFAULT_REGION: "auto",
  AWS_REQUEST_CHECKSUM_CALCULATION: "when_required",
  AWS_RESPONSE_CHECKSUM_VALIDATION: "when_required",
};
const useS3 =
  !local && s3Env.AWS_ACCESS_KEY_ID && s3Env.AWS_SECRET_ACCESS_KEY && process.env.CLOUDFLARE_ACCOUNT_ID;
if (useS3) {
  execFileSync(
    "aws",
    [
      "s3",
      "sync",
      `${dir}/`,
      `s3://${BUCKET}/${envId}/`,
      "--only-show-errors",
      ...(del ? ["--delete"] : []),
      "--endpoint-url",
      `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    ],
    { stdio: "inherit", env: s3Env },
  );
  console.log(`synced ${files.length} files to ${BUCKET}/${envId} over the S3 API`);
  console.log("bump CORPUS_VERSION in wrangler.jsonc so the explainer cache turns over");
  process.exit(0);
}

// The corpus is a few thousand files and each wrangler call takes a moment,
// so they go in parallel. The local R2 store is one sqlite file: keep the
// pool small enough that two writers do not collide.
const POOL = 8;
let done = 0;
let failed = 0;
let next = 0;

async function worker() {
  while (next < files.length) {
    const file = files[next++];
    const key = `${envId}/${file}`;
    const args = ["r2", "object", "put", `${BUCKET}/${key}`, "--file", join(dir, file), ...(local ? ["--local"] : ["--remote"])];
    // The local store is one sqlite file: two writers can collide, so a
    // failure is tried once more on its own.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (useDevApi) await putDev(key, readFileSync(join(dir, file)));
        else execFileSync(wrangler, args, { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" });
        break;
      } catch (error) {
        if (attempt) {
          failed += 1;
          // wrangler says why on stderr; that is the only place the reason is.
          const why = String(error.stderr ?? error.message).trim().split("\n").slice(-3).join(" | ");
          console.warn(`failed ${file}: ${why}`);
        }
      }
    }
    done += 1;
    if (done % 100 === 0) console.log(`${done}/${files.length}`);
  }
}

await Promise.all(Array.from({ length: POOL }, worker));
console.log(`uploaded ${done - failed}/${files.length} to ${BUCKET}/${envId}${local ? " (local)" : ""}`);
console.log("bump CORPUS_VERSION in wrangler.jsonc so the explainer cache turns over");
if (local) console.log("clear .wrangler/state/v3/cache and restart wrangler dev so the cache turns over too");
// A partial upload is a failure: the corpus on the edge is now missing pages.
if (failed) process.exitCode = 1;


