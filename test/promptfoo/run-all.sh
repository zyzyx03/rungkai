#!/usr/bin/env bash
# Run the curated deterministic+judge suite and the generated redteam probes
# against one throwaway local server.
set -uo pipefail
cd "$(dirname "$0")/../.."

PORT=8788
PERSIST="$(mktemp -d)"
OUT="$(mktemp -p test/promptfoo rungkai-redteam-XXXXXX.yaml)"
rm -f "$OUT"
SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$PERSIST"
  rm -f "$OUT"
}
trap cleanup EXIT INT TERM

npm run build >/dev/null
timeout 900 npx wrangler dev \
  --config wrangler.local.jsonc \
  --port "$PORT" \
  --persist-to "$PERSIST" \
  --var CHAT_PER_MINUTE:1000 \
  --var EXPLAIN_PER_MINUTE:1000 \
  --var DAILY_BUDGET_MICRO:100000000 \
  > /tmp/rungkai-all.log 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null; then break; fi
  sleep 1
done
if ! curl -fsS -o /dev/null "http://127.0.0.1:$PORT/"; then
  echo "the test server did not start; see /tmp/rungkai-all.log" >&2
  tail -20 /tmp/rungkai-all.log >&2 || true
  exit 1
fi

for page in rsync ssh tar git; do
  curl -fsS -o /dev/null -X PUT \
    "http://127.0.0.1:$PORT/cdn-cgi/local/explorer/api/r2/buckets/rungkai-corpus/objects/ubuntu%2F24.04%2F${page}.json" \
    -H 'content-type: application/json' \
    --data-binary @test/promptfoo/fixtures/${page}-injected.json
done

status=0
echo "=== curated suite: deterministic assertions + GLM judge ==="
promptfoo --env-file .env eval -c test/promptfoo/promptfooconfig.yaml --no-cache || status=1

echo "=== generated redteam: prompt-extraction probes ==="
PROMPTFOO_DISABLE_REDTEAM_REMOTE_GENERATION=true \
PROMPTFOO_DISABLE_REMOTE_GENERATION=true \
promptfoo --env-file .env redteam generate \
  -c test/promptfoo/redteam.yaml \
  -o "$OUT" \
  --no-cache || status=1
if [ -f "$OUT" ]; then
  node test/promptfoo/regrade.mjs "$OUT" || status=1
  promptfoo --env-file .env eval -c "$OUT" --no-cache || status=1
else
  echo "no redteam probes were generated" >&2
  status=1
fi
exit "$status"
