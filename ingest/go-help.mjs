// Build go-<command> pages from the Go tool's own help text.
//   node ingest/go-help.mjs .corpus/noble/pages
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? ".corpus/noble/pages";
const GO = process.env.GO ?? "go";
const version = execFileSync(GO, ["version"], { encoding: "utf8" }).trim();
const help = (path = []) => execFileSync(GO, ["help", ...path], { encoding: "utf8", maxBuffer: 8 << 20 });

function commandsFrom(text) {
  const out = [];
  const start = text.indexOf("The commands are:");
  if (start < 0) return out;
  let started = false;
  for (const line of text.slice(start).split("\n").slice(1)) {
    if (!line.trim()) {
      if (started) break;
      continue;
    }
    const m = /^\t([a-z][a-z0-9-]*)\s{2,}(.+)$/.exec(line);
    if (m) {
      started = true;
      out.push({ name: m[1], desc: m[2].trim() });
    } else if (started) break;
  }
  return out;
}

function optionsFrom(text) {
  const options = [];
  const values = {};
  const add = (names, usage, desc) => {
    if (!names.length || options.some((o) => o.names.some((n) => names.includes(n)))) return;
    options.push({ names, usage, desc: desc.trim() });
  };
  let current = null;
  for (const line of text.split("\n")) {
    const m = /^\t(-{1,2}[^\s]+)(?:\s+(.*))?$/.exec(line);
    if (m) {
      const name = m[1];
      const rest = (m[2] ?? "").trim();
      current = { names: [name], usage: rest ? `${name} ${rest}` : name, desc: "" };
      options.push(current);
      if (rest && /^[A-Za-z<]/.test(rest)) values[name] = rest;
    } else if (current && /^\t\t/.test(line)) {
      current.desc = `${current.desc} ${line.trim()}`.trim();
    } else if (!line.trim()) {
      current = null;
    }
  }
  for (const m of text.matchAll(/\bThe (-{1,2}[A-Za-z0-9][\w-]*) flag\b([\s\S]*?)(?=\n\n|$)/g)) {
    add([m[1]], m[1], m[0].replace(/\s+/g, " "));
  }
  const usage = /^usage: (.*)$/m.exec(text)?.[1] ?? "";
  for (const m of usage.matchAll(/\[(-{1,2}[^\s\]]+)(?:\s+([A-Za-z][\w-]*))?\]/g)) {
    add([m[1]], m[2] ? `${m[1]} ${m[2]}` : m[1], m[0].replace(/[[\]]/g, ""));
    if (m[2]) values[m[1]] = m[2];
  }
  return { options, values };
}

function operandsFrom(text, path) {
  const usage = /^usage: (.*)$/m.exec(text)?.[1] ?? "";
  const rest = usage.replace(new RegExp(`^go\\s+${path.join("\\s+")}\\s*`), "");
  const out = [];
  for (const m of rest.matchAll(/\[([^\]]+)\]|\b([a-z][a-z0-9_-]*)(?:\.\.\.)?/gi)) {
    const word = (m[1] ?? m[2] ?? "").trim();
    if (!word || /^\s*-/.test(word) || /\b(?:flags?|options?)\b/i.test(word)) continue;
    for (const w of word.split(/[\s|]+/)) {
      if (/^[a-z][a-z0-9_-]*$/i.test(w) && !/^go$/i.test(w) && !out.includes(w)) out.push(w);
    }
  }
  return out.map((name) => ({ name, desc: "" }));
}

const made = new Set();
const skipped = [];
function visit(path, shortDesc) {
  const cmd = ["go", ...path].join("-");
  if (made.has(cmd)) return;
  made.add(cmd);
  let text;
  try {
    text = help(path);
  } catch {
    skipped.push(path.join(" "));
    return;
  }
  const { options, values } = optionsFrom(text);
  const addOptions = (extra) => {
    for (const option of extra.options) {
      if (options.some((o) => o.names.some((n) => option.names.includes(n)))) continue;
      options.push(option);
      for (const name of option.names) if (extra.values[name]) values[name] = extra.values[name];
    }
  };
  if (["build", "test", "run", "install", "get", "list", "clean"].includes(path[0])) addOptions(optionsFrom(help(["build"])));
  if (path[0] === "test") addOptions(optionsFrom(help(["testflag"])));
  const page = {
    cmd,
    env: "ubuntu/24.04",
    section: 1,
    source: `go help${path.length ? ` ${path.join(" ")}` : ""}`,
    synopsis: shortDesc || /^usage: .*$/m.exec(text)?.[0] || cmd,
    description: text,
    options,
    values,
    operands: operandsFrom(text, path),
    clientVersion: version,
  };
  writeFileSync(join(dir, `${cmd}.json`), JSON.stringify(page));
  const children = commandsFrom(text);
  if (!path.length || path.length === 1) for (const child of children) visit([...path, child.name], child.desc);
}
visit([], "Go is a tool for managing Go source code.");
// The root page is a command list, not a command page.
{
  const text = help([]);
  const children = commandsFrom(text);
  writeFileSync(join(dir, "go.json"), JSON.stringify({
    cmd: "go",
    env: "ubuntu/24.04",
    section: 1,
    source: "go help",
    synopsis: "Go is a tool for managing Go source code.",
    description: text,
    options: [],
    values: {},
    operands: children.map((child) => ({ name: child.name, desc: child.desc, command: true })),
    clientVersion: version,
  }));
}
console.log(`wrote ${made.size + 1} go pages from ${version} in ${dir}`);
if (skipped.length) console.log(`skipped: ${skipped.join(", ")}`);
