// A chunk below this cosine similarity is noise: the question and the excerpt
// share a space, not a subject. Better no excerpts than six wrong ones.
const MIN_SCORE = 0.35;

// Candidate-restricted retrieval: cosine over only the current one-liner's pages.
export async function retrieve(env, envIds, tools, question, k = 4) {
  // A caller's k is a request, not a promise: a page holds many chunks and no
  // answer needs more than this.
  const limit = Number.isInteger(k) && k > 0 ? Math.min(k, 12) : 4;
  const names = [...new Set(tools)];
  const flags = askedFlags(question);

  // One page failing to read is one page without excerpts, not a dead
  // request: the chat and the recommender are still worth answering.
  const pages = (
    await Promise.all(
      envIds.flatMap((envId) =>
        names.map(async (tool) => {
          try {
            const obj = await env.CORPUS.get(`${envId}/${tool}.json`);
            if (!obj) return null;
            return { tool, env: envId, page: await obj.json() };
          } catch (error) {
            console.error(`corpus page ${envId}/${tool}.json could not be read for retrieval:`, error);
            return null;
          }
        }),
      ),
    )
  ).filter(Boolean);

  // The same page is copied into several corpora (Docker, Percona); scoring it
  // three times would fill the answer with three copies of one excerpt.
  const chunks = [];
  const seenChunk = new Set();
  for (const { tool, env: envId, page } of pages) {
    for (const chunk of page.chunks ?? []) {
      // The key is tool + text: the same tool copied into several corpora is
      // one excerpt, but two tools may share a line without being the same.
      const key = `${tool}\0${chunk.text}`;
      if (!chunk.text || seenChunk.has(key)) continue;
      seenChunk.add(key);
      chunks.push({ tool, env: envId, text: chunk.text, embedding: chunk.embedding });
    }
  }

  // A flag the reader names is a direct hit, even when its chunk did not make
  // the page's embedding budget. The page's own entry is better than a guess.
  const exact = [];
  const seenFlag = new Set();
  for (const { tool, env: envId, page } of pages) {
    for (const option of page.options ?? []) {
      if (!option.desc || !option.names?.length) continue;
      const name = option.names.find((candidate) => flags.has(candidate));
      if (!name || seenFlag.has(name)) continue;
      seenFlag.add(name);
      exact.push({ tool, env: envId, text: `${option.names.join(", ")}: ${option.desc}`, score: 1 });
    }
  }

  if (!chunks.length) return top(exact, [], limit);

  // Local dev has no AI binding. Score text chunks by word overlap instead of
  // giving up: the local corpus can still ground a question, and the Promptfoo
  // fixture uses this path to put an injected excerpt in front of the model.
  if (!env.AI) {
    const asked = words(question);
    const scored = chunks.map(({ embedding, ...chunk }) => ({ ...chunk, score: overlap(asked, chunk.text) }));
    return top(exact, scored, limit);
  }

  // A chunk without an embedding cannot be scored and must not trigger a
  // billed question embedding when there is nothing to rank.
  const candidates = chunks.filter((chunk) => chunk.embedding);
  if (!candidates.length) return top(exact, [], limit);

  // Qwen3 embeds a query with its instruction; bge v1.5 needs the same
  // pooling as the corpus. EMBED_MODEL selects which contract to follow.
  const model = env.EMBED_MODEL ?? "@cf/baai/bge-small-en-v1.5";
  const qwen = model.includes("qwen3");
  const pooling = env.EMBED_POOLING === "cls" ? "cls" : "mean";
  const query = qwen
    ? `Instruct: Given a query about Linux commands, retrieve the relevant man page documentation.\nQuery: ${question}`
    : question;
  let q;
  try {
    const vec = await env.AI.run(model, qwen ? { queries: [query] } : { text: [question], pooling });
    q = vec?.data?.[0];
  } catch (error) {
    console.error("the question could not be embedded:", error);
    return top(exact, [], limit);
  }
  if (!q) return top(exact, [], limit);

  // A vector of another width cannot be compared: a stale or foreign
  // embedding would otherwise rank on the first few numbers only.
  const scored = candidates
    .filter(({ embedding }) => embedding.length === q.length)
    .map(({ embedding, ...chunk }) => ({ ...chunk, score: cosine(q, embedding) }))
    .filter(({ score }) => score >= MIN_SCORE);
  return top(exact, scored, limit);
}

// The exact flags first, then the scored chunks, one excerpt per text.
function top(exact, scored, limit) {
  const merged = new Map();
  for (const doc of [...exact, ...scored]) {
    const key = `${doc.tool}\0${doc.text}`;
    const known = merged.get(key);
    if (!known || doc.score > known.score) merged.set(key, doc);
  }
  return [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ embedding, ...doc }) => doc);
}

// The flags a question writes, in every spelling the pages use.
function askedFlags(text) {
  const found = String(text ?? "").matchAll(/(?:^|[^A-Za-z0-9_-])(--?[A-Za-z0-9][\w.-]*)/g);
  return new Set([...found].map((m) => m[1].replace(/[.,;:]+$/, "").split("=")[0]));
}

function words(text) {
  return new Set(String(text ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

function overlap(asked, text) {
  const have = words(text);
  let n = 0;
  for (const word of asked) if (have.has(word)) n += 1;
  return n;
}

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
