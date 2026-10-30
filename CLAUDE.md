# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node.js 22.23.4 or newer.

```sh
npm ci
npm test                 # node --test test/*.test.mjs
npm run build            # Astro static build into dist/; no lint script exists
npm run dev:local        # build + wrangler dev with local R2/DO on :8787
npm run dev              # wrangler dev --remote; uses real Cloudflare resources
npm run deploy           # build + wrangler deploy
```

Single test file, and a single named test:

```sh
node --test test/explain.test.mjs
node --test --test-name-pattern="synopsis" test/explain.test.mjs
```

Other suites:

```sh
npm run test:browser     # build + Chrome motion tests (google-chrome or CHROME_BIN)
npm run test:promptfoo   # paid model calls; needs promptfoo + DEEPSEEK_API_KEY
npm run test:redteam     # generated prompt-extraction probes
npm run test:all         # Node + both promptfoo suites; excludes browser
npm run eval:retrieval   # retrieval hits@4 against local corpus files
```

The Node suite runs from committed fixtures; corpus-dependent checks are skipped when `.corpus/` is absent. `seed/tar.json` is a deliberately incomplete demo fixture, not real ingestion.

Secrets split: `.env` is for evaluation/ingestion scripts (`DEEPSEEK_API_KEY`, `OLLAMA_API_KEY`, `CF_WORKERS_AI_TOKEN`, R2 keys); `.dev.vars` supplies local Worker secrets (`DEEPSEEK_API_KEY`, optional `CHAT_TOKEN`). Neither is committed.

`wrangler.local.jsonc` intentionally differs from production: no `AI` binding, no observability, and its own `CORPUS_VERSION`. Local retrieval falls back to word overlap when `AI` is absent. Keep the binding names `CORPUS`, `AI`, `BUDGET`, `RATE_LIMIT`; the bucket name is also hardcoded in `ingest/upload.mjs` and `ingest/export.mjs`.

## Architecture

One Cloudflare Worker serves a static Astro site plus the API; there is no Cloudflare Pages project. `run_worker_first: ["/api/*"]` sends only API paths to Hono; everything else is served from `dist/` assets. Bindings: `CORPUS` (R2), `BUDGET` and `RATE_LIMIT` (SQLite Durable Objects), `AI`.

**Deterministic explainer.** `POST /api/explain` -> `parseOneLiner` (`tree-sitter-bash` WASM) -> `resolveCommands` (wrappers such as `sudo`, nested `find -exec`) -> `loadPage` from R2 -> `explain()` -> JSON segments, sources and gaps. Responses are cached in `caches.default` for 24h, keyed by command hash + environment + `CORPUS_VERSION`. This path needs no model.

**Corpus.** `R2` stores `<env>/<tool>.json`; subcommand pages (`git-status`, `docker-run`) win by the longest matching path, with fallback to shorter paths. `lite` pages omit vectors/chunks, option-heavy pages are sharded, and full pages remain for retrieval. Uploads rebuild `_index.json` (synopsis index) and `_meta.json` (build manifest). The runtime corpus is R2; the local `.corpus/` tree is gitignored staging (it can be much larger than the bucket).

**Model features.** `/api/suggest` (JSON), `/api/tldr` (SSE) and `/api/chat` (bearer-token internal endpoint) retrieve candidate pages, rank chunks by cosine over page embeddings inside the Worker (no Vectorize), then call DeepSeek. Every model request passes the `RateLimit` and `Budget` Durable Objects. Defaults: 5 model requests/minute and 120 uncached explanations/minute per IP, with cached answers bypassing the counters. The `Budget` DO is a daily application spend guard, not a Cloudflare account limit.

**Client.** `src/pages/index.astro` + `src/client/app.js` (plain JS, no framework) render tokens, entry cards and SVG connectors from token/entry geometry; they also own URL state, modes and SSE parsing. The command and environment live in the URL (permalinks), toolbar status in `sessionStorage`, theme choice in `localStorage`. `src/pages/404.astro` and `src/components/ThemeControls.astro` are the other page/shell pieces; there is no shared layout component.

**Ingestion.** `.corpus/<env>/pages` -> `ingest/prune.mjs` -> `ingest/lite.mjs` -> an embedding script -> `ingest/upload.mjs`. Document and query embeddings must match on model, dimensions, pooling and instruction contract. Production is Qwen3 `@cf/qwen/qwen3-embedding-0.6b`; BGE paths require `EMBED_MODEL=@cf/baai/bge-small-en-v1.5` and `EMBED_POOLING=mean`. Add a target environment in `src/lib/envs.js` and upload pages under its prefix.

## Invariants

- **Documentation or a visible gap.** The base explanation is deterministic; the model never supplies it. Undocumented tokens are gaps, never model prose. AI prose is labelled separately.
- **Never forward a raw model stream.** `/api/tldr` and `/api/chat` pass upstream through `deltaStream` (`src/lib/sse.js`), re-emitting only `choices[0].delta.content` and `[DONE]`. Upstream events carry the model name, fingerprint and usage; the browser must not see them. The cached-summary path uses `sseText`.
- **Bump `CORPUS_VERSION`** in the relevant Wrangler config after corpus or explanation-output changes, then redeploy/restart; locally also clear `.wrangler/state/v3/cache`.
- **No command history.** Server state is the R2 corpus, the two Durable Objects and the 24h answer cache. Audit logs record only flagged inputs (500-character excerpt, HMAC-hashed IP, user-agent excerpt, route, timestamp).
- **Design is settled.** `DESIGN.md` is binding: Tokyo Night palette, Orbitron/Ubuntu Sans, no rules or underlined links, red reserved for gaps/unresolved tokens. Extend the language; do not redesign.
- **Theme work.** `data-theme` on `<html>` is set by an inline head script; it follows `prefers-color-scheme` until the reader chooses, then persists in `localStorage`. Palette tokens live in `src/styles/global.css`; UnoCSS consumes the `-rgb` channel variables; the client role colours in `src/client/app.js` are `var(--green)` etc. A new page needs the head bootstrap and `ThemeControls`.

## Sources of truth

`README.md` and the code are current. `PRODUCT.md`, `GLOSSARY.md` and `docs/adr/` record intent and history and contain stale specifics (for example Ubuntu-only v1, `bge-small`, older budget figures). Check `src/lib/envs.js`, `wrangler.jsonc` and the worker before repeating them. `DESIGN.md` remains the visual authority.
