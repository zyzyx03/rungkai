import test from "node:test";
import assert from "node:assert/strict";
import { rankTools, candidateTools } from "../src/lib/candidates.js";

const index = [
  { cmd: "pt-pg-summary", synopsis: "Collects information about a PostgreSQL cluster." },
  { cmd: "psql", synopsis: "PostgreSQL interactive terminal." },
  { cmd: "pt-mongodb-summary", synopsis: "Collects information about a MongoDB cluster." },
  { cmd: "pt-duplicate-key-checker", synopsis: "Find duplicate indexes and foreign keys on MySQL tables." },
  { cmd: "pt-query-digest", synopsis: "Analyze MySQL queries from logs, processlist, and tcpdump." },
  { cmd: "find", synopsis: "Search for files in a directory hierarchy." },
];

test("a postgres question lists the postgres tools, not the mongo ones", () => {
  const got = rankTools(index, "can percona toolkit detect db lock in postgres");
  assert.equal(got[0], "pt-pg-summary");
  assert.ok(got.includes("psql"));
  assert.equal(got.includes("pt-mongodb-summary"), false);
});

test("a duplicate-index question prefers the toolkit for that engine", () => {
  assert.equal(rankTools(index, "find duplicate indexes on a mysql table")[0], "pt-duplicate-key-checker");
});

test("an unrelated question still finds a page", () => {
  assert.ok(rankTools(index, "search files by name").includes("find"));
});

test("candidateTools merges the corpus indexes", async () => {
  const env = { CORPUS: { get: async (key) => (key.endsWith("_index.json") ? { json: async () => ({ pages: index }) } : null) } };
  assert.equal((await candidateTools(env, ["ubuntu/24.04", "el9"], "postgres locks"))[0], "pt-pg-summary");
});
