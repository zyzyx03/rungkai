// Candidate-restricted retrieval: cosine over only the current one-liner's pages.
export async function retrieve(env, envIds, tools, question, k = 6) {
  if (!env.AI) return []; // local dev has no AI binding; chat runs without context
  const candidates = [];

  for (const envId of envIds) {
    for (const tool of new Set(tools)) {
      const obj = await env.CORPUS.get(`${envId}/${tool}.json`);
      if (!obj) continue;
      const page = await obj.json();
      for (const chunk of page.chunks ?? []) {
        // Older corpora may carry chunks without embeddings; those cannot
        // be scored and must not trigger a billed question embedding.
        if (!chunk.embedding) continue;
        candidates.push({ tool, env: envId, text: chunk.text, embedding: chunk.embedding });
      }
    }
  }

  if (!candidates.length) return [];
  const vec = await env.AI.run("@cf/baai/bge-small-en-v1.5", { text: [question] });
  const q = vec.data[0];
  const scored = candidates.map(({ embedding, ...chunk }) => ({ ...chunk, score: cosine(q, embedding) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
