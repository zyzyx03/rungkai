// Candidate-restricted retrieval: cosine over only the current one-liner's pages.
export async function retrieve(env, envIds, tools, question, k = 6) {
  // A caller's k is a request, not a promise: a page holds a handful of
  // chunks and no answer needs more than this.
  const limit = Number.isInteger(k) && k > 0 ? Math.min(k, 12) : 6;
  const names = [...new Set(tools)];

  // One page failing to read is one page without excerpts, not a dead
  // request: the chat and the recommender are still worth answering.
  const pages = await Promise.all(
    envIds.flatMap((envId) =>
      names.map(async (tool) => {
        try {
          const obj = await env.CORPUS.get(`${envId}/${tool}.json`);
          if (!obj) return [];
          const page = await obj.json();
          return (page.chunks ?? [])
            .filter((chunk) => chunk.text)
            .map((chunk) => ({ tool, env: envId, text: chunk.text, embedding: chunk.embedding }));
        } catch (error) {
          console.error(`corpus page ${envId}/${tool}.json could not be read for retrieval:`, error);
          return [];
        }
      }),
    ),
  );
  const chunks = pages.flat();
  if (!chunks.length) return [];

  // Local dev has no AI binding. Score text chunks by word overlap instead of
  // giving up: the local corpus can still ground a question, and the Promptfoo
  // fixture uses this path to put an injected excerpt in front of the model.
  if (!env.AI) {
    const asked = words(question);
    const scored = chunks.map(({ embedding, ...chunk }) => ({ ...chunk, score: overlap(asked, chunk.text) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  // A chunk without an embedding cannot be scored and must not trigger a
  // billed question embedding when there is nothing to rank.
  const candidates = chunks.filter((chunk) => chunk.embedding);
  if (!candidates.length) return [];

  let q;
  try {
    const vec = await env.AI.run("@cf/baai/bge-small-en-v1.5", { text: [question] });
    q = vec?.data?.[0];
  } catch (error) {
    console.error("the question could not be embedded:", error);
    return [];
  }
  if (!q) return [];

  // A vector of another width cannot be compared: a stale or foreign
  // embedding would otherwise rank on the first few numbers only.
  const scored = candidates
    .filter(({ embedding }) => embedding.length === q.length)
    .map(({ embedding, ...chunk }) => ({ ...chunk, score: cosine(q, embedding) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
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
