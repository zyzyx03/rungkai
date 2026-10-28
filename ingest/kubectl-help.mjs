// Build one page per kubectl command from `kubectl <path> --help`.
//   node ingest/kubectl-help.mjs [outDir]
// The client version is the one on PATH; the page records it so a corpus can
// be traced to the help text it came from. Only the help is read: no cluster.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? ".corpus/kubectl/pages";
const KUBECTL = process.env.KUBECTL ?? "kubectl";
// pagePath() accepts a tool plus two subcommand words.
const MAX_DEPTH = 3;
const KNOWN = new Set(["Aliases", "Examples", "Available Commands", "Options", "Global Flags", "Usage"]);

function run(args) {
  try {
    return execFileSync(KUBECTL, args, { encoding: "utf8", timeout: 30_000, maxBuffer: 4 << 20 }).replace(/\r/g, "");
  } catch (error) {
    return null;
  }
}

const version = (() => {
  try {
    return JSON.parse(run(["version", "--client", "--output=json"]) ?? "{}").clientVersion?.gitVersion ?? "";
  } catch {
    return "";
  }
})();

function sections(help) {
  const out = [];
  let current = { name: "", lines: [] };
  for (const line of help.split("\n")) {
    const name = line.trim().replace(/:$/, "");
    if (line.endsWith(":") && KNOWN.has(name)) {
      out.push(current);
      current = { name, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  out.push(current);
  return out;
}

const section = (parts, name) => parts.find((part) => part.name === name)?.lines ?? [];

function commands(lines) {
  const out = [];
  for (const line of lines) {
    const match = /^\s{2}([a-z][a-z0-9-]*)\s{2,}(\S.*)$/.exec(line);
    if (match) out.push({ name: match[1], desc: match[2].trim() });
  }
  return out;
}

function options(lines) {
  const out = [];
  let current = null;
  for (const line of lines) {
    const start = /^ {4}(\S.*?):\s*(.*)$/.exec(line);
    if (start) {
      const names = start[1]
        .split(/,\s*/)
        .map((name) => name.replace(/=.*$/, "").trim())
        .filter(Boolean);
      current = { names, desc: start[2].trim() };
      out.push(current);
    } else if (current && (/^\t/.test(line) || /^ {4,}\S/.test(line))) {
      current.desc = `${current.desc} ${line.trim()}`.trim();
    }
  }
  return out.filter((option) => option.names.length);
}

const globalOptions = options((run(["options"]) ?? "").split("\n"));

function pageFor(path, help) {
  const parts = sections(help);
  const body = section(parts, "").join("\n").trim();
  const examples = section(parts, "Examples").join("\n").trim();
  const aliases = section(parts, "Aliases").join("\n").trim();
  const subs = commands(section(parts, "Available Commands"));
  const rootSubs = path.length ? [] : commands(section(parts, ""));
  const children = subs.length ? subs : rootSubs;

  // The opening prose names what the command does; examples and subcommands
  // add the nouns a Malay or natural-language query is likely to use.
  const summary = body.replace(/\s+/g, " ").trim().slice(0, 300);
  const exampleCommands = examples
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^kubectl\s/.test(line))
    .slice(0, 6);
  const extra = [
    children.length ? `Commands: ${children.map((child) => child.name).join(", ")}` : "",
    exampleCommands.length ? `Examples: ${exampleCommands.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  let synopsis = [`Kubernetes: ${summary}`, extra].filter(Boolean).join(" ");
  if (synopsis.length > 700) synopsis = `${synopsis.slice(0, 697)}…`;

  const cmd = ["kubectl", ...path].join("-");
  const description = [body, aliases ? `Aliases: ${aliases}` : "", examples, children.length ? `Available commands:\n${children.map((child) => `${child.name} — ${child.desc}`).join("\n")}` : ""]
    .filter(Boolean)
    .join("\n\n");
  return {
    cmd,
    synopsis: synopsis || cmd,
    description,
    options: options(section(parts, "Options")).concat(options(section(parts, "Global Flags")), path.length ? [] : globalOptions),
    values: {},
    operands: [],
    source: path.length
      ? `https://kubernetes.io/docs/reference/kubectl/generated/kubectl_${path.join("_")}/`
      : "https://kubernetes.io/docs/reference/kubectl/",
    clientVersion: version,
    _children: children.map((child) => child.name),
  };
}

const rootHelp = run(["--help"]);
if (!rootHelp) {
  console.error(`${KUBECTL} --help produced nothing`);
  process.exit(1);
}
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const seen = new Set();
const skipped = [];
const queue = [{ path: [], help: rootHelp }];
let count = 0;
while (queue.length) {
  const { path, help } = queue.shift();
  const page = pageFor(path, help);
  const { _children, ...record } = page;
  if (seen.has(record.cmd)) continue;
  seen.add(record.cmd);
  writeFileSync(join(OUT, `${record.cmd}.json`), JSON.stringify(record));
  count += 1;
  for (const child of _children) {
    const next = [...path, child];
    if (next.length > MAX_DEPTH) {
      skipped.push(next.join(" "));
      continue;
    }
    const childHelp = run([...next, "--help"]);
    if (childHelp) queue.push({ path: next, help: childHelp });
    else skipped.push(next.join(" "));
  }
}

console.log(`wrote ${count} pages to ${OUT} from kubectl ${version || "(unknown version)"}`);
if (skipped.length) console.log(`skipped ${skipped.length} command paths deeper than ${MAX_DEPTH} words: ${skipped.join(", ")}`);
