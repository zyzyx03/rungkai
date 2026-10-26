#!/usr/bin/env bash
# Run Promptfoo's generated red-team probes against a throwaway local server.
set -euo pipefail
cd "$(dirname "$0")/../.."

PORT=8788
PERSIST="$(mktemp -d)"
OUT="$(mktemp -p test/promptfoo rungkai-redteam-XXXXXX.yaml)"
# Promptfoo treats an existing output file as a previous run; start absent.
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
  > /tmp/rungkai-redteam.log 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null; then break; fi
  sleep 1
done
if ! curl -fsS -o /dev/null "http://127.0.0.1:$PORT/"; then
  echo "the test server did not start; see /tmp/rungkai-redteam.log" >&2
  tail -20 /tmp/rungkai-redteam.log >&2 || true
  exit 1
fi

PROMPTFOO_DISABLE_REDTEAM_REMOTE_GENERATION=true \
PROMPTFOO_DISABLE_REMOTE_GENERATION=true \
promptfoo --env-file .env redteam generate \
  -c test/promptfoo/redteam.yaml \
  -o "$OUT" \
  --no-cache

node test/promptfoo/regrade.mjs "$OUT"

promptfoo --env-file .env eval -c "$OUT" --no-cache
