# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Astro static output served by one Hono Worker on Cloudflare Workers, styled with UnoCSS. `tree-sitter-bash` parses one-liners; man pages live in R2; DeepSeek (operator key) recommends and adapts commands; Workers AI `bge-small` embeds; SQLite Durable Objects hold the daily budget and the per-IP rate windows.

## Users
Ops engineers and sysadmins reading a command line they did not write — pasted from a runbook, a ticket, or a colleague — who need to know what each tool and flag does before running it, sometimes adapted to their own OS.

## Product Purpose
Rungkai explains a shell one-liner token by token against real man pages, then lets the reader ask about it or change it. Success means the reader can justify every part of the command and knows which claims came from documentation.

## Positioning
Anchored explanation: every claim about a token is tied to a page in the selected environment's corpus, and anything undocumented is shown as a gap. A chatbot alone cannot truthfully promise that.

## Operating Context
A browser, often during an incident or while reading a runbook. Commands are pasted from terminals, tickets and chat. The reader may not know the source OS, so the target environment is chosen explicitly. No accounts; nothing pasted is retained.

## Capabilities and Constraints
- One-liners with pipelines, redirections, substitutions, quoting and simple loops.
- Per-environment corpora; v1 ships Ubuntu 24.04 only. `all` answers from the best matching corpus and labels the source.
- Shell syntax anchors to `bash(1)`.
- The deterministic explainer is cached and works with zero model budget.
- A plain-language recommender (`/api/suggest`) returns one command, fresh or adapted from the current one, with a rationale and its assumptions. It is a single suggestion, not a conversation. `/api/change` remains a compatibility alias requiring a string `cmd`; `/api/chat` remains available.
- Operator-funded DeepSeek key behind a $1/day budget in a Durable Object; per-IP token buckets in another Durable Object limit chat to 5 requests/minute and uncached explanations to 120/minute.
- No accounts, no server-side history, no stored commands. Permalinks carry command and environment in the URL.
- Tools without a page are shown as gaps, never filled with model prose.

## Brand Commitments
The name is Rungkai. No other identity constraints were made binding.

## Evidence on Hand
No customers, benchmarks, testimonials or corpus data ship with this project. `seed/tar.json` is a fixture and must not be presented as real ingestion.

## Product Principles
1. Documentation or a visible gap — never model prose wearing a citation.
2. The explainer works without the model.
3. Nothing the reader pastes is retained.
4. One environment at a time, labelled.
5. The free tier is a design constraint, not an afterthought.

## Accessibility & Inclusion
Keyboard-first: the command input is reachable with Ctrl/Cmd+K, focus is always visible, and text contrast targets 4.5:1 or better.
