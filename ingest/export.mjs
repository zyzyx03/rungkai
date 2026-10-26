// Pull a Corpus out of R2 as JSON files. The mirror of upload.mjs.
//   node ingest/export.mjs ubuntu/24.04 .corpus/noble/pages --local
//   node ingest/export.mjs ubuntu/24.04 ./pages --remote
//
// --local reads the dev server's R2 store over its HTTP API, which is one
// request per page instead of one wrangler process per page. --remote uses
// the S3 API, so it needs an R2 API token in the environment.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const envId = process.argv[2] ?? "ubuntu/24.04";
const dir = process.argv[3] ?? "./pages";
const remote = process.argv.includes("--remote");
const local = !remote;

mkdirSync(dir, { recursive: true });

const BUCKET = "rungkai-corpus";
const PREFIX = `${envId}/`;

// The dev server serves its local R2 over this API. It is not the S3 API,
// so it cannot be used for a remote bucket.
const DEV_API = process.env.RUNGKAI_DEV_URL ?? "http://localhost:8787";

const listLocal = async () => {
  const keys = [];
  let cursor;
  do {
    const url = new URL(`${DEV_API}/cdn-cgi/local/explorer/api/r2/buckets/${BUCKET}/objects`);
    url.searchParams.set("prefix", PREFIX);
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const body = await res.json();
    keys.push(...body.result.map((o) => o.key));
    cursor = body.result_info.is_truncated === "true" ? body.result_info.cursor : null;
  } while (cursor);
  return keys;
};

const getLocal = async (key) => {
  const url = `${DEV_API}/cdn-cgi/local/explorer/api/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${key}`);
  return Buffer.from(await res.arrayBuffer());
};

// Remote: the S3 API of the bucket, with the credentials R2 gives you.
const s3 = () => {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const key = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  if (!account || !key || !secret) {
    throw new Error("remote export needs CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY");
  }
  return { account, key, secret };
};

const listRemote = () => {
  const { account, key, secret } = s3();
  const out = execFileSync("aws", [
    "s3api", "list-objects-v2",
    "--endpoint-url", `https://${account}.r2.cloudflarestorage.com`,
    "--bucket", BUCKET,
    "--prefix", PREFIX,
    "--output", "json",
  ], { env: { ...process.env, AWS_ACCESS_KEY_ID: key, AWS_SECRET_ACCESS_KEY: secret }, maxBuffer: 64 << 20 });
  const body = JSON.parse(out);
  const keys = (body.Contents ?? []).map((o) => o.Key);
  // list-objects-v2 is paginated at 1000; a corpus is larger than that.
  let token = body.NextContinuationToken;
  while (token) {
    const more = execFileSync("aws", [
      "s3api", "list-objects-v2",
      "--endpoint-url", `https://${account}.r2.cloudflarestorage.com`,
      "--bucket", BUCKET,
      "--prefix", PREFIX,
      "--continuation-token", token,
      "--output", "json",
    ], { env: { ...process.env, AWS_ACCESS_KEY_ID: key, AWS_SECRET_ACCESS_KEY: secret }, maxBuffer: 64 << 20 });
    const page = JSON.parse(more);
    keys.push(...(page.Contents ?? []).map((o) => o.Key));
    token = page.NextContinuationToken;
  }
  return keys;
};

const getRemote = (key, dest) => {
  const { account, key: id, secret } = s3();
  // get-object takes the destination file as a positional argument; without
  // it the CLI refuses the call instead of writing the body to stdout.
  execFileSync("aws", [
    "s3api", "get-object",
    "--endpoint-url", `https://${account}.r2.cloudflarestorage.com`,
    "--bucket", BUCKET,
    "--key", key,
    dest,
  ], { env: { ...process.env, AWS_ACCESS_KEY_ID: id, AWS_SECRET_ACCESS_KEY: secret }, maxBuffer: 64 << 20 });
};

// The page files are named after the tool, so a key of "env/tool.json"
// becomes "tool.json" in the output directory.
const nameFor = (key) => key.slice(PREFIX.length).replace(/\.json$/, "") + ".json";

const keys = local ? await listLocal() : listRemote();
if (keys.length === 0) {
  console.log(`no pages for ${envId} in ${BUCKET}`);
  process.exit(0);
}

let done = 0;
for (const key of keys) {
  const dest = join(dir, nameFor(key));
  if (local) writeFileSync(dest, await getLocal(key));
  else getRemote(key, dest);
  done++;
  if (done % 100 === 0) console.log(`${done}/${keys.length}`);
}

console.log(`exported ${done} pages for ${envId} to ${dir}`);
