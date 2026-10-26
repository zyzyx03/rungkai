#!/usr/bin/env bash
# Run the prompt-injection suite against a throwaway local server.
# The limits and budget are raised for this process only; the shipped
# defaults and the real budget are untouched.
set -euo pipefail
cd "$(dirname "$0")/../.."

TOKEN="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
export RUNGKAI_CHAT_TOKEN="$TOKEN"

PORT=8788
PERSIST="$(mktemp -d)"
SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$PERSIST"
}
trap cleanup EXIT INT TERM

npm run build >/dev/null
timeout 600 npx wrangler dev \
  --config wrangler.local.jsonc \
  --port "$PORT" \
  --persist-to "$PERSIST" \
  --var CHAT_PER_MINUTE:1000 \
  --var EXPLAIN_PER_MINUTE:1000 \
  --var "CHAT_TOKEN:$TOKEN" \
  --var DAILY_BUDGET_MICRO:100000000 \
  > /tmp/rungkai-promptfoo.log 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null; then break; fi
  sleep 1
done
if ! curl -fsS -o /dev/null "http://127.0.0.1:$PORT/"; then
  echo "the test server did not start; see /tmp/rungkai-promptfoo.log" >&2
  tail -20 /tmp/rungkai-promptfoo.log >&2 || true
  exit 1
fi

# Put one injected man page into this throwaway R2 only. The local server has
# no AI binding, so retrieve() scores the page's text chunks by word overlap;
# the model still sees the excerpt in its system prompt, which is the point.
for page in rsync ssh tar git; do
  curl -fsS -o /dev/null -X PUT \
    "http://127.0.0.1:$PORT/cdn-cgi/local/explorer/api/r2/buckets/rungkai-corpus/objects/ubuntu%2F24.04%2F${page}.json" \
    -H 'content-type: application/json' \
    --data-binary @test/promptfoo/fixtures/${page}-injected.json
done

promptfoo --env-file .env eval -c test/promptfoo/promptfooconfig.yaml --no-cache
