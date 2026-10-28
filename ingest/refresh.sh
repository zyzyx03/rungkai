#!/usr/bin/env bash
# Re-embed the corpora locally with the 128-chunk cap, publish them, and measure.
# Pages are marked with the cap they were embedded at, so a re-run resumes
# instead of paying for the pages that already finished.
# Scheduled one-off from the user's crontab; safe to run by hand, too.
#   ingest/refresh.sh --dry     check the prerequisites without spending anything
set -euo pipefail
cd "$(dirname "$0")/.."

export HOME="${HOME:-/home/zyzyx}"
export PATH="/home/zyzyx/.nvm/versions/node/v24.15.0/bin:/home/zyzyx/.local/bin:/usr/local/bin:/usr/bin:/bin"
set -a
. ./.env
set +a

LOG="/tmp/rungkai-refresh-$(date +%F-%H%M).log"
exec > >(tee -a "$LOG") 2>&1
say() { echo "[$(date -Is)] $*"; }
fail() { say "FAILED: $*"; exit 1; }

say "start; log: $LOG"
export EMBED_URL="${EMBED_URL:-https://corpa.zyzyx.cc}"
for key in CLOUDFLARE_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  [ -n "${!key:-}" ] || fail "$key is missing from .env"
done

declare -A DIR=(
  [noble]=".corpus/noble/pages"
  [el9]=".corpus/el9/pages"
  [alpine]=".corpus/alpine/3.22/pages"
)
declare -A MIN=( [noble]=2000 [el9]=1000 [alpine]=300 )
for env in noble el9 alpine; do
  dir="${DIR[$env]}"
  [ -d "$dir" ] || fail "$dir is missing"
  count=$(find "$dir" -maxdepth 1 -name '*.json' ! -name '_*' | wc -l)
  say "$env: $count pages"
  [ "$count" -ge "${MIN[$env]}" ] || fail "$env has only $count pages; refusing to mirror it into R2"
done

if [ "${1:-}" = "--dry" ]; then
  say "dry run: prerequisites look good"
  exit 0
fi

say "embedding noble"
node ingest/embed-http.mjs "${DIR[noble]}"
say "embedding el9"
node ingest/embed-http.mjs "${DIR[el9]}"
say "embedding alpine"
node ingest/embed-http.mjs "${DIR[alpine]}"

say "uploading"
node ingest/upload.mjs ubuntu/24.04 "${DIR[noble]}" --delete
node ingest/upload.mjs el9 "${DIR[el9]}" --delete
node ingest/upload.mjs alpine/3.22 "${DIR[alpine]}" --delete

cur=$(grep -o '"CORPUS_VERSION": "[0-9]*"' wrangler.jsonc | head -1 | grep -o '[0-9]*')
[ -n "$cur" ] || fail "CORPUS_VERSION is missing from wrangler.jsonc"
next=$((cur + 1))
say "CORPUS_VERSION $cur -> $next"
sed -i "s/\"CORPUS_VERSION\": \"$cur\"/\"CORPUS_VERSION\": \"$next\"/" wrangler.jsonc wrangler.local.jsonc

say "deploying"
npm run deploy

say "retrieval eval"
npm run eval:retrieval:local -- --pooling cls || say "eval failed; the deploy stands"

say "done"
