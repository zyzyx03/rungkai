// Candidate-restricted retrieval: cosine over only the current one-liner's pages.
export async function retrieve(env, envIds, tools, question, k = 6) {
  if (!env.AI) return []; // local dev has no AI binding; chat runs without context
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
            // Older corpora may carry chunks without embeddings; those cannot
            // be scored and must not trigger a billed question embedding.
            .filter((chunk) => chunk.embedding)
            .map((chunk) => ({ tool, env: envId, text: chunk.text, embedding: chunk.embedding }));
        } catch (error) {
          console.error(`corpus page ${envId}/${tool}.json could not be read for retrieval:`, error);
          return [];
        }
      }),
    ),
  );
  const candidates = pages.flat();
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

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
