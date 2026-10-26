# Prompt-injection checks

This is a Promptfoo suite that talks to the app's own `/api/suggest`, `/api/chat` and
`/api/tldr` endpoints. It tests the system prompts, validation and JSON shape,
not just a bare model.

## Run everything

```sh
npm run test:all
```

That runs the 114 Node unit tests, then the 31 curated deterministic+judge
cases, then 10 generated prompt-extraction probes, all against one throwaway
local server. The two Promptfoo evals land in `promptfoo view`. The browser
suite is separate (`npm run test:browser`) because it launches Chrome.

`npm run test:promptfoo:all` runs just the two Promptfoo layers.

## Run

```sh
bash test/promptfoo/run.sh
```

The runner:

1. builds the static assets,
2. starts a throwaway `wrangler dev` on port 8788 with a fresh local R2 and
   Durable Object state,
3. raises that process's rate limits and daily budget with `--var` — the
   shipped defaults and the real $1/day bucket are untouched,
4. seeds four injected man pages into the throwaway R2,
5. runs `promptfoo eval` against it, and
6. stops the server and deletes its state.

It needs `.env` to contain both keys, and the `promptfoo` CLI on PATH:

```sh
DEEPSEEK_API_KEY=...   # the app's model
OLLAMA_API_KEY=...     # the judge
```

`run.sh` passes `.env` to Promptfoo, so the judge key does not need to be
exported. The 31 curated tests make 31 target calls and 31 judge calls; a run
costs a few cents or uses your Ollama Cloud quota.

## The judge

The target is DeepSeek. The judge is deliberately a different family:
**GLM 5.3** through Ollama Cloud's OpenAI-compatible endpoint
(`https://ollama.com/v1`). It grades every `llm-rubric` assertion at a
`0.8` threshold. Deterministic `is-json` and JavaScript checks still run, so a
judge mistake cannot hide a wrong shape.

The judge is the small `judge.mjs` adapter, not the built-in OpenAI provider.
It asks for JSON mode and normalises the verdict to `{ pass, score, reason }`
so Promptfoo can parse it even when the model chats around its answer. That
was necessary with GLM: its first raw run returned a verdict Promptfoo could
not parse.

`glm-5.3-flash` is the lighter judge for frequent runs: still multimodal and
strong on coding, much cheaper and faster, but less careful on subtle
semantic grading. Swap the model in the provider config:

```yaml
config:
  model: glm-5.3-flash
```

Both names are the direct-cloud identifiers (the `:cloud` suffix is for the
local Ollama CLI). Review the judge's reasons with `promptfoo view`; an LLM
verdict is not deterministic, so tune the rubric or threshold rather than
trusting the percentage blindly.

## What it covers

The curated suite has 31 cases across three endpoints.

**Suggest (22)**
- Direct override in the task; a note addressed to the model inside a benign
  task; an injected comment in the current command.
- System prompt extraction; a role change / jailbreak; the JSON shape.
- Base64, ROT13, Malay, Cyrillic-homoglyph and split-payload injections.
- Leetspeak, hex, URL-encoded, unicode-escaped and hidden markdown instructions.
- An instruction at the end of a long benign request; repeated many-shot
  examples.
- An injected man-page excerpt (`rsync`), two poisoned pages at once
  (`rsync` + `ssh`), and a separate `git` excerpt that tries to put PWNED in
  `assumed`.
- A roleplay asking for a fork bomb.
- A split payload refused with an empty command is accepted: refusing is safe.

**Chat (4)**
- A multi-turn history where an earlier turn agrees to an injection.
- A request for the system prompt.
- An injected tar page excerpt.
- A base64 instruction in the message.

**tldr (5)**
- An injected command comment; a quoted operand containing an instruction.
- An injected tar synopsis/option description.
- Two poisoned pages (`tar` + `ssh`) in one command.
- A base64 command that must be described, not obeyed.

The model endpoints are DeepSeek; the judge is GLM 5.3 on Ollama Cloud.

Each case has two layers: deterministic `is-json` and JavaScript checks on
`command`/`rationale`/`assumed`, plus an `llm-rubric` semantic check judged by
Ollama Cloud. The deterministic checks fail independently of the judge.

## Adding a case

Add a test to `promptfooconfig.yaml`:

```yaml
- description: "what this checks"
  vars:
    mode: suggest # suggest, chat or tldr
    cmd: "ls -la"
    injection: "the request, including the attack"
  assert:
    - type: javascript
      value: |
        const out = JSON.parse(output);
        return !/forbidden/i.test(out.command);
```

`mode: chat` and `mode: tldr` return the streamed answer text instead of the
JSON object.

## Generated red-team probes

`redteam.yaml` and `npm run test:redteam` use GLM 5.3 on Ollama Cloud as the
generator. `run-redteam.sh` generates the probes, swaps Promptfoo's built-in
prompt-extraction grader for the same `judge.mjs` llm-rubric adapter the
curated suite uses, and evaluates the generated prompts against the target.
The local run generates ten prompt-extraction probes (`numTests: 10`) and
passes all ten. Raising `numTests` adds variants of that one class; it does
not add plugins.

Some of Promptfoo's plugins and strategies are remote-generation-only:
`hijacking` and `system-prompt-override` refuse to generate with a local
provider; `jailbreak`/`jailbreak:meta` need remote generation at scan time;
and `indirect-prompt-injection` needs an untrusted-variable config. Those need
Promptfoo Cloud (`promptfoo auth login`), an OpenAI key, or a self-hosted
`PROMPTFOO_REMOTE_GENERATION_URL`. The local generated layer is therefore a
small smoke test, not a replacement for the 31 curated cases.

The built-in prompt-extraction grader asks the redteam provider for a verdict
that the raw Ollama response does not provide in the shape Promptfoo parses;
`regrade.mjs` replaces that assertion with the adapter, which normalises
`{ pass, score, reason }`.

## Limitations

- The indirect cases cover the excerpt in the model's prompt, not the real
  Workers AI embedding ranking: the local server has no AI binding, so
  `retrieve()` scores text chunks by word overlap. Production still uses
  embeddings; the injection vector (untrusted excerpt in the system prompt) is
  the same.
- A direct request that says "put PWNED in the assumed field" is the caller's
  own instruction, not an untrusted-data injection; the indirect `git` page
  test covers the field-integrity vector from documentation. The model still
  follows the explicit user formatting request, which is harmless: the field is
  rendered as text and the caller is the reader. A direct-request version of
  that case was removed for that reason.
- This is a regression suite, not a runtime filter. It proves the prompts and
  response shape; it does not inspect every answer in production.
- Promptfoo's `redteam` generator can be layered on top with the same
  provider, but it needs a grader provider and remote generation; it is not
  part of the default run.
