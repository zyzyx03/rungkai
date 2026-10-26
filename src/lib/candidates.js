// Which pages a suggestion reads when it starts with no command.
//
// Retrieval is candidate-restricted to the tools a command names. A fresh
// suggestion names none, so it scores a small index of page synopses instead.
// A database question gives the toolkit covering that engine a head start;
// the pages themselves still decide whether a tool fits.

const STOP = new Set(
  "a an and are as at be by can could do does for from how i in into is it of on or should that the this to was what when where which with would you your".split(" "),
);
const ENGINE = {
  postgres: "postgres",
  postgresql: "postgres",
  psql: "postgres",
  pg: "postgres",
  mysql: "mysql",
  mariadb: "mysql",
  innodb: "mysql",
  mongo: "mongo",
  mongodb: "mongo",
  galera: "galera",
};
const ENGINES = new Set(["postgres", "mysql", "mongo", "galera"]);

const words = (text) =>
  [...new Set(String(text ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [])]
    .filter((word) => !STOP.has(word))
    .map((word) => ENGINE[word] ?? word);

export function rankTools(entries, question, limit = 10) {
  const asked = new Set(words(question));
  const engines = [...asked].filter((word) => ENGINES.has(word));
  const seen = new Set();
  return entries
    .map((entry) => {
      const cmd = String(entry.cmd ?? "");
      const have = new Set(words(`${cmd} ${entry.synopsis ?? ""}`));
      let score = 0;
      for (const word of asked) if (have.has(word)) score += 1;
      if (asked.has(cmd.toLowerCase())) score += 3;
      // The toolkit for the engine the reader named comes before raw SQL.
      if (cmd.startsWith("pt-") && engines.some((engine) => have.has(engine))) score += 2;
      return { cmd, score };
    })
    .filter((entry) => entry.cmd && entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter((entry) => !seen.has(entry.cmd) && seen.add(entry.cmd))
    .slice(0, limit)
    .map((entry) => entry.cmd);
}

export async function candidateTools(env, envIds, question, limit = 10) {
  const entries = [];
  for (const id of envIds) {
    try {
      const obj = await env.CORPUS.get(`${id}/_index.json`);
      if (!obj) continue;
      const index = await obj.json();
      entries.push(...(Array.isArray(index) ? index : index.pages ?? []));
    } catch (error) {
      console.error(`the corpus index ${id} could not be read:`, error);
    }
  }
  return rankTools(entries, question, limit);
}
