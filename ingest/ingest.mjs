// Build one Corpus from man pages already on disk.
//   node ingest/ingest.mjs noble                                    # Ubuntu .debs
//   node ingest/ingest.mjs --env el9 --from-dir .corpus/el9/man     # any distro
//   node ingest/ingest.mjs --env alpine/3.22 --from-dir .corpus/alpine/man
import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync, rmSync, lstatSync, readlinkSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { synopsisOptions } from "./synopsis.mjs";
import { parseOptions, proseOptions } from "./flags.mjs";
import { optionValues, synopsisFacts, operandDocs, definitionEntries, text as plain } from "./operands.mjs";

const argv = process.argv.slice(2);
let release = "noble";
let envId = null;
let fromDir = null;
let sourceBase = "";
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--env") envId = argv[++i];
  else if (argv[i] === "--from-dir") fromDir = argv[++i];
  else if (argv[i] === "--source-base") sourceBase = argv[++i];
  else if (!argv[i].startsWith("--")) release = argv[i];
}

const ARCHIVE = "https://archive.ubuntu.com/ubuntu";
const UBUNTU_ENV = { noble: "ubuntu/24.04", jammy: "ubuntu/22.04" };
envId ??= fromDir ? release : UBUNTU_ENV[release];
if (!envId) throw new Error(`unknown release ${release}; pass --env <corpus id>`);

// Commands this audience types; extend freely.
const PACKAGES = [
  "manpages", "manpages-dev", "git-man", "coreutils", "procps", "iproute2",
  "openssh-client", "tar", "findutils", "grep", "sed", "gawk", "curl", "less",
  "rsync", "util-linux", "systemd", "net-tools", "iptables", "nftables",
  "cron", "apt", "dpkg",
  // The tools people reach for when the shell is not enough.
  "sudo", "gzip", "man-db", "debianutils", "make", "iputils-ping", "openssl",
  "wget", "unzip", "e2fsprogs", "cmake", "python3", "file", "diffutils",
  "bsdutils", "netcat-openbsd", "lsof", "psmisc", "binutils", "elfutils",
  "mawk", "python3.12-minimal", "bash",
  // Universe: the ones Ubuntu keeps out of the main archive.
  "npm", "nodejs", "python3-pip", "traceroute", "docker-compose",
  "jq", "tmux", "htop", "ripgrep", "fd-find", "bat", "eza", "lsd", "ncdu",
  "duf", "shellcheck", "shfmt", "httpie", "aria2", "podman", "skopeo",
  "buildah", "ansible", "gh", "neovim", "bats", "moreutils", "parallel",
  "pv", "glances", "powertop", "iotop", "bmon", "nload", "ethtool", "lshw",
  "usbutils", "pciutils", "lm-sensors", "smartmontools", "stress-ng",
  "hyperfine", "clang", "ninja", "meson", "cargo", "rustc", "golang-go",
  "maven", "gradle", "groovy", "scala", "kotlin", "lua5.4", "python3-poetry",
  "pipenv", "libxml2-utils", "xmlstarlet", "emacs", "festival",
  // The rest of the tools a person types.
  "gcc", "mount", "patch", "gnupg", "xz-utils", "zstd", "bzip2", "zip", "fdisk",
  "parted", "gdb", "strace", "ltrace", "valgrind", "perf", "sysstat", "nmap",
  "tree", "screen", "apache2", "nginx", "mysql-client", "postgresql-client",
  "redis-tools", "sqlite3", "php-cli", "ruby", "perl", "bc", "dc", "ksh",
  "dash", "zsh", "fish", "w3m", "lynx", "youtube-dl", "git-lfs", "mpstat",
  "pidstat", "dstat", "default-jdk-headless", "protobuf-compiler",
  "rpcsvc-proto", "systemtap", "golang-golang-x-tools", "lua5.1", "lua5.2",
  "lua5.3",
];

const work = `.corpus/${release}`;
const debs = join(work, "debs");
const out = fromDir ? `.corpus/${envId}/pages` : join(work, "pages");
// The corpus is a build, and a build starts from nothing: a page that is no
// longer written must not stay behind. It must not delete its own input
// either, which is what happens if --from-dir points at the output.
if (fromDir && resolve(fromDir) === resolve(out)) {
  console.error(`--from-dir ${fromDir} is the directory this build writes; refusing to delete it`);
  process.exit(1);
}

if (!has("mandoc")) {
  console.error("mandoc is required: sudo apt install mandoc");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let manRoot = fromDir;
if (!manRoot) {
  mkdirSync(debs, { recursive: true });
  // Main and universe: Ubuntu keeps half the tools people type out of the
  // main archive, and a corpus that is missing them has gaps everywhere.
  const filenames = new Map();
  const depends = new Map();
  for (const component of ["main", "universe"]) {
    const index = await fetchText(`${ARCHIVE}/dists/${release}/${component}/binary-amd64/Packages.gz`, true);
    for (const stanza of index.split("\n\n")) {
      const name = stanza.match(/^Package: (.+)$/m)?.[1];
      const file = stanza.match(/^Filename: (.+)$/m)?.[1];
      if (name && file) filenames.set(name, file);
      if (name) depends.set(name, dependenciesOf(stanza));
    }
  }

  for (const pkg of PACKAGES) {
    // A package may be a stub that points at the real one: Ubuntu's "gcc"
    // depends on "gcc-13", and the man pages are in the real package. The
    // real one may point at another in turn, so the search goes two deep.
    const wanted = [pkg];
    for (const dep of depends.get(pkg) ?? []) {
      if (!dep.startsWith(pkg)) continue;
      wanted.push(dep);
      for (const deep of depends.get(dep) ?? []) {
        if (deep.startsWith(pkg)) wanted.push(deep);
      }
    }
    for (const want of wanted) {
      const file = filenames.get(want);
      if (!file) {
        if (want === pkg) console.warn(`skip ${pkg}: not in ${release}`);
        continue;
      }
      const deb = join(debs, basename(file));
      if (!existsSync(deb)) writeFileSync(deb, await fetchBytes(`${ARCHIVE}/${file}`));
      execFileSync("dpkg-deb", ["-x", deb, work]);
      console.log(`extracted ${want}`);
    }
  }
  manRoot = join(work, "usr/share/man");
}

const sourceFor = (dir, file, tool) => {
  const page = file.replace(/\.gz$/, "");
  if (sourceBase) {
    const base = sourceBase.replace(/\/$/, "");
    // A mirror with a directory layout takes the plain base; a template
    // names the section and the page, which is how a flat browser works.
    if (base.includes("{")) {
      return base
        .replace(/\{section\}/g, dir.replace("man", ""))
        .replace(/\{name\}/g, tool)
        .replace(/\{page\}/g, page);
    }
    return `${base}/${dir}/${page}.html`;
  }
  if (!fromDir && UBUNTU_ENV[release]) return `https://manpages.ubuntu.com/manpages/${release}/en/${dir}/${page}.html`;
  // The docker corpus is the CLI reference: each page is the docs for the
  // same command. The reference has moved, and these three commands are only
  // at the new address.
  if (tool === "docker") return "https://docs.docker.com/reference/cli/docker/";
  if (tool.startsWith("docker-")) {
    const sub = tool.slice("docker-".length);
    return DOCKER_DOCS[sub] ?? `https://docs.docker.com/engine/reference/commandline/${sub.replace(/-/g, "_")}/`;
  }
  return "";
};

const DOCKER_DOCS = {
  bake: "https://docs.docker.com/reference/cli/docker/buildx/bake/",
  "stack-ps": "https://docs.docker.com/reference/cli/docker/stack/ps/",
  "swarm-unlock-key": "https://docs.docker.com/reference/cli/docker/swarm/unlock-key/",
};

// The operators that join commands, and the section of the manual that
// documents them.
const JOINING = {
  "|": "Pipelines",
  "|&": "Pipelines",
  ";": "Lists",
  "&": "Lists",
  "&&": "Lists",
  "||": "Lists",
  "command substitution": "Command_Substitution",
  "process substitution": "Process_Substitution",
  "function definitions": "Shell_Function_Definitions",
};

// The values a flag may take that are its default rather than a word the
// user types.
const DEFAULTS = new Set(["true", "false", "yes", "no"]);

// Some pages are filed under a name the command does not answer to: the
// distribution suffixes the file, and the command keeps the plain name.
// The page is still the page: awk(1) is mawk's. A command may be answered
// by a different page in each distribution, so the names are candidates and
// the first that exists wins.
const ALIASES = {
  awk: ["mawk", "gawk"],
  // OpenRC documents the command as openrc(8); Alpine's `rc` is that service
  // manager, and the page is the one the reader needs.
  rc: ["openrc"],
  fd: ["fdfind"],
  sar: ["sar.sysstat"],
  ksh: ["ksh93"],
  lua: ["lua5.4"],
  nc: ["nc.openbsd", "ncat"],
  which: ["which.debianutils", "which"],
  traceroute: ["traceroute.db", "traceroute"],
  man: ["man.man-db", "man"],
};

let count = 0;
let skipped = 0;
// The shell's builtins, gathered from bash(1) and written once the other
// pages are in, so that a builtin with a page of its own (echo, kill) keeps
// it.
const builtins = [];
// Only command manuals (1 and 8): sectionless keys cannot distinguish crontab(1) from crontab(5).
for (const dir of ["man1", "man8"]) {
  const path = join(manRoot, dir);
  if (!existsSync(path)) continue;
  for (const name of readdirSync(path)) {
    if (!name.endsWith(".gz")) continue;
    // The file name carries the section, and sometimes more: "openssl-req.1ssl"
    // is the page for openssl-req, and "python3.12.1" is the page for
    // python3.12.
    const tool = name.replace(/\.gz$/, "").replace(/\.\d+[a-z]*$/, "");
    let roff;
    try {
      roff = gunzipSync(readFileSync(join(path, name))).toString("utf8");
    } catch {
      skipped++; // dangling symlink or half-extracted page
      continue;
    }
    const html = execFileSync("mandoc", ["-Thtml"], { input: roff, maxBuffer: 64 << 20 }).toString("utf8");
    const text = plain(html).replace(/\s+/g, " ").trim();
    const options = parseOptions(html);
    // Options documented only in the SYNOPSIS (rpm's -q|--query) come last, so
    // a detailed option entry always wins the first match.
    options.push(...synopsisOptions(html, new Set(options.flatMap((o) => o.names))));
    // A page with no option list at all may still name its flags in the prose.
    if (options.length === 0) {
      options.push(...proseOptions(html, new Set()));
    }

    // Some tools take their options as a cluster with no leading dash — tar
    // documents that form itself, so let the page say so rather than keep a
    // list here that would drift from the documentation.
    const cluster = /cluster of (option letters|flags|short options)/i.test(text);

    // What each option takes, and what the command takes that is not an
    // option. The option list is the authority, but the synopsis knows better
    // than the man macros do which word belongs to which flag.
    const listed = optionValues(html, new Set(options.flatMap((o) => o.names)));
    const facts = synopsisFacts(html, tool);
    const values = { ...listed };
    for (const [flag, value] of Object.entries(facts.values)) values[flag] = value;
    // A missing synopsis value must not erase an explicit <value> from the
    // option list; otherwise the synopsis can discard prose mistaken for one.
    for (const flag of facts.shown) {
      if (!(flag in facts.values) && !/^<[A-Za-z][\w.-]*>$/.test(listed[flag] ?? "")) delete values[flag];
    }
    // A value named true or false is the flag's default, not a word the user
    // types: "docker ps --all" takes nothing.
    for (const [flag, value] of Object.entries(values)) {
      if (DEFAULTS.has(value)) delete values[flag];
    }
    for (const option of options) {
      if (!option.desc || option.synopsis) {
        const documented = options.find((other) => other !== option && !other.synopsis && other.desc
          && other.names.length === option.names.length && other.names.every((name) => option.names.includes(name)));
        if (documented) {
          option.desc = documented.desc;
          delete option.gap;
          delete option.synopsis;
        }
      }
      if (!option.desc || option.synopsis) {
        option.desc = "";
        option.gap = true;
      }
    }
    const docs = operandDocs(html, facts.operands);
    const operands = facts.operands
      // A symbolic mode expanded into attribute options is no longer a
      // positional argument; the next word is the file it applies to.
      .filter((operand) => operand !== "mode" || !options.some((o) => o.names.some((n) => n.startsWith("+"))))
      .map((operand) => ({ name: operand, desc: docs[operand] ?? "", ...(!docs[operand] ? { gap: true } : {}) }));

    const page = {
      cmd: tool,
      env: envId,
      // The section the page is in: sudo is sudo(8), not sudo(1).
      section: Number(dir.replace("man", "")) || 1,
      source: sourceFor(dir, name, tool),
      licence: licenceOf(html),
      synopsis: synopsisOf(html),
      description: plain(section(html, "DESCRIPTION")),
      options,
      values,
      operands,
      ...(cluster ? { cluster: true } : {}),
      // bash(1) documents the shell's own syntax, so the page holds it.
      ...(tool === "bash" ? { syntax: shellSyntax(html) } : {}),
    };
    writeFileSync(join(out, `${tool}.json`), JSON.stringify(page));
    // The shell's builtins have no man page of their own; bash(1) documents
    // them, and each one becomes a page of its own.
    if (tool === "bash") builtins.push(...builtinPages(html, page));
    // A page whose name carries a version is also the command without it:
    // python3.12.1 is the page for python3.
    const alias = tool.replace(/\.\d+$/, "");
    if (alias !== tool && !existsSync(join(out, `${alias}.json`))) {
      writeFileSync(join(out, `${alias}.json`), JSON.stringify({ ...page, cmd: alias }));
    }
    count++;
  }
}

// The packages a package depends on. A dependency may carry a version
// constraint: "gcc-13 (>= 13.2.0-11~)".
function dependenciesOf(stanza) {
  const lines = stanza.split("\n");
  const out = [];
  let inDepends = false;
  for (const line of lines) {
    if (/^Depends:/.test(line)) {
      inDepends = true;
      out.push(...line.replace(/^Depends:\s*/, "").split(/,\s*/).map((d) => d.split(/[\s(]/)[0]).filter(Boolean));
      continue;
    }
    if (inDepends) {
      if (/^ /.test(line)) {
        out.push(...line.trim().split(/,\s*/).map((d) => d.split(/[\s(]/)[0]).filter(Boolean));
        continue;
      }
      inDepends = false;
    }
  }
  return out;
}

// A command may be a link to another: fd is a link to fdfind, and the page
// the link points at is the page for the command.
function linkAliases(root) {
  const aliases = new Map();
  for (const dir of ["usr/bin", "usr/sbin", "bin", "sbin"]) {
    const path = join(root, dir);
    if (!existsSync(path)) continue;
    for (const name of readdirSync(path)) {
      const full = join(path, name);
      try {
        if (!lstatSync(full).isSymbolicLink()) continue;
        aliases.set(name, basename(readlinkSync(full)));
      } catch {
        // A link that goes nowhere is no help.
      }
    }
  }
  return aliases;
}

// A page the distribution filed under another name answers to the command's
// own name as well: awk(1) is mawk's.
let aliasCount = 0;
for (const [name, targets] of Object.entries(ALIASES)) {
  const target = targets.find((t) => existsSync(join(out, `${t}.json`)));
  if (!target || existsSync(join(out, `${name}.json`))) continue;
  const page = JSON.parse(readFileSync(join(out, `${target}.json`), "utf8"));
  writeFileSync(join(out, `${name}.json`), JSON.stringify({ ...page, cmd: name }));
  aliasCount++;
}

// A command that is a link to another: fd is a link to fdfind.
for (const [name, target] of linkAliases(work)) {
  if (!existsSync(join(out, `${target}.json`)) || existsSync(join(out, `${name}.json`))) continue;
  const page = JSON.parse(readFileSync(join(out, `${target}.json`), "utf8"));
  writeFileSync(join(out, `${name}.json`), JSON.stringify({ ...page, cmd: name }));
  aliasCount++;
}

// A builtin with a page of its own (echo, kill) keeps it: the shell's own
// version of a command is not the one the user runs.
let builtinCount = 0;
for (const page of builtins) {
  if (existsSync(join(out, `${page.cmd}.json`))) continue;
  for (const option of page.options) if (!option.desc) option.gap = true;
  writeFileSync(join(out, `${page.cmd}.json`), JSON.stringify(page));
  builtinCount++;
}

console.log(`wrote ${count + builtinCount + aliasCount} pages to ${out}${skipped ? `, skipped ${skipped}` : ""}`);
console.log(`upload: node ingest/upload.mjs ${envId} ${out} --local`);

// The shell's own syntax, as bash(1) states it: the compound commands in
// its SHELL GRAMMAR section, and the redirections in its REDIRECTION
// section. Each is the manual's usage line and the manual's own words for
// it, so a card can say what the manual says.
function shellSyntax(html) {
  const syntax = {};
  // The compound commands: a usage line, and what the shell does with it.
  // bash 5.2 calls the section SHELL GRAMMAR and 5.1 calls it COMPOUND
  // COMMANDS, and both document the same constructs the same way.
  const grammarId = ["SHELL_GRAMMAR", "COMPOUND_COMMANDS"].find((id) => section(html, id));
  const grammar = grammarId ? section(html, grammarId) : "";
  // The manual writes its section names in capitals; a card reads better
  // with them in words.
  const grammarName = titleCase(plain(new RegExp(`<h1[^>]*id="${grammarId}"[^>]*>([\\s\\S]*?)<\\/h1>`).exec(html)?.[1] ?? ""));
  const entries = [...grammar.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)]
    .map((pair) => ({
      synopsis: plain(pair[1]).replace(/\s+/g, " ").trim(),
      desc: plain(pair[2]).replace(/\s+/g, " ").trim(),
    }));
  entries.forEach((entry, i) => {
    // A usage line with no words of its own holds the entry that follows
    // it: the manual writes what `while` does under `until`.
    const desc = entry.desc || entries[i + 1]?.desc || "";
    if (!entry.synopsis || !desc) return;
    // The manual names each construct by the word that starts it.
    (syntax[entry.synopsis.split(" ")[0]] ??= []).push({ synopsis: entry.synopsis, desc, section: grammarName });
  });
  // The test operators: what `-f` and the rest mean, as the manual says it.
  const expressions = section(html, "CONDITIONAL_EXPRESSIONS");
  const expressionName = titleCase(plain(/<h1[^>]*id="CONDITIONAL_EXPRESSIONS"[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? ""));
  for (const pair of expressions.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)) {
    const synopsis = plain(pair[1]).replace(/\s+/g, " ").trim();
    const desc = plain(pair[2]).replace(/\s+/g, " ").trim();
    if (!synopsis || !desc) continue;
    (syntax[synopsis.split(" ")[0]] ??= []).push({ synopsis, desc, section: expressionName });
  }
  // The operators that join commands: the manual has a section for each.
  for (const [operator, id] of Object.entries(JOINING)) {
    const text = firstParagraph(subsection(html, id));
    if (!text) continue;
    (syntax[operator] ??= []).push({ synopsis: "", desc: text, section: titleCase(id.replace(/_/g, " ")) });
  }
  // The redirections: each form, with the words the manual gives it. The
  // operator is in the form's own line: "[n]>word".
  const redirection = section(html, "REDIRECTION");
  for (const sub of redirection.matchAll(/<h2[^>]*id="[^"]+"[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|<h1|$)/g)) {
    const body = sub[2];
    const title = plain(sub[1]).replace(/\s+/g, " ").trim();
    const desc = firstParagraph(body);
    for (const format of body.matchAll(/<div class="Bd-indent">([\s\S]*?)<\/div>/g)) {
      const line = plain(format[1]).replace(/\s+/g, " ").trim();
      const operator = /^(?:\[\s*n\s*\])?\s*([^\s\w\[]+)/.exec(line)?.[1];
      if (!operator) continue;
      (syntax[operator] ??= []).push({ synopsis: line, desc, section: title });
    }
  }
  return syntax;
}

// A subsection of a page, as html.
function subsection(html, id) {
  return new RegExp(`<h2[^>]*id="${id}"[^>]*>([\\s\\S]*?)(?=<h2|<h1|$)`).exec(html)?.[1] ?? "";
}

// The first paragraph of a block of text: the manual opens with what the
// thing is, and the rest is detail.
function firstParagraph(html) {
  const block = /<p class="Pp">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? html;
  return plain(block).replace(/\s+/g, " ").trim();
}

// A name in capitals, as words: "SHELL GRAMMAR" is "Shell Grammar".
function titleCase(text) {
  return text.toLowerCase().replace(/(^|\s)(\S)/g, (_, space, letter) => space + letter.toUpperCase());
}

// The body of a section of a page, as html.
//
// The heading is not part of the body. mandoc writes it inside the <h1>,
// wrapped in a permalink anchor, so reading the section from the opening
// tag leaves the word DESCRIPTION at the front of every page's prose.
function section(html, id) {
  return new RegExp(`<h1[^>]*id="${id}"[^>]*>[\\s\\S]*?</h1>([\\s\\S]*?)(?=<h1[^>]*id=|$)`).exec(html)?.[1] ?? "";
}

// The shell's builtins, one page each. bash(1) keeps them in a section of
// its own, and the flags a builtin takes are written in its usage line. A
// builtin may have several entries — bind has one per form — and they are
// one page.
function builtinPages(html, bash) {
  const section = /<h1[^>]*id="SHELL_BUILTIN_COMMANDS"[^>]*>([\s\S]*?)(?=<h1[^>]*id=|$)/.exec(html)?.[1];
  if (!section) return [];
  const byName = new Map();
  for (const [head, body] of definitionEntries(section)) {
    const pair = [null, head, body];
    // The name is the usage line's first word, and the page's anchor for it
    // is not the name: bash(1) numbers the entries that share one.
    const name = plain(/<b>([^<]*)<\/b>/.exec(pair[1])?.[1] ?? "");
    if (!name || name.startsWith("-")) continue;
    const usage = plain(pair[1]);
    // The flags are the usage line's own: "-a" in "[-a]", and a cluster
    // like "[-afptP]" is one flag per letter. A dash in a word is not a
    // flag: "option-name" is a value.
    const flags = [];
    for (const m of usage.match(/(?<![\w-])-[A-Za-z@][A-Za-z0-9@]*/g) ?? []) {
      if (m.startsWith("--")) flags.push(m);
      else for (const c of m.slice(1)) flags.push(`-${c}`);
    }
    const sentences = [plain(pair[1]), plain(pair[2])].filter(Boolean);
    const entry = byName.get(name) ?? { name, flags: new Set(), sentences: [], options: [], usage: [], bodies: [] };
    entry.options.push(...parseOptions(body));
    entry.usage.push(`<p class="Pp">${head}</p>`);
    entry.bodies.push(body);
    for (const flag of flags) entry.flags.add(flag);
    entry.sentences.push(...sentences);
    byName.set(name, entry);
  }
  return [...byName.values()].map((entry) => {
    const synopsis = entry.sentences[1] ?? "";
    const facts = synopsisFacts(`<h1 id="SYNOPSIS">SYNOPSIS</h1>${entry.usage.join(" ")}`, entry.name);
    const docs = operandDocs(`<h1 id="DESCRIPTION">DESCRIPTION</h1>${entry.bodies.join(" ")}`, facts.operands);
    return {
      cmd: entry.name,
      env: bash.env,
      builtin: true,
      source: bash.source,
      licence: bash.licence,
      synopsis,
      description: entry.sentences.slice(1).join(" "),
      options: [...entry.flags].map((flag) => ({
        names: [flag],
        // Its definition, or the full source paragraph naming it; no synopsis fallback.
        desc: entry.options.find((o) => o.names.includes(flag) && o.desc)?.desc ?? entry.sentences.find((s, i) => i > 0 && new RegExp(`(^|[\\s,])${flag}(?=[\\s,.;:]|$)`).test(s)) ?? "",
      })),
      values: facts.values,
      operands: facts.operands.map((name) => ({ name, desc: docs[name] ?? "", ...(!docs[name] ? { gap: true } : {}) })),
    };
  });
}

function synopsisOf(html) {
  const nd = html.match(/<td class="Nd">([\s\S]*?)<\/td>/);
  if (nd) return plain(nd[1]).replace(/\s+/g, " ").trim();

  // man(7) pages put the one-liner in the NAME section instead.
  const name = html.match(/id="NAME"[^>]*>([\s\S]*?)(?=<h1|<\/section>)/);
  if (!name) return "";
  const text = plain(name[1]).replace(/\s+/g, " ").trim();
  const dash = text.match(/\s[-\u2014]\s+(.*)$/);
  return dash ? dash[1].trim() : text;
}

function licenceOf(html) {
  // The heading is not part of the licence, the same as in section().
  const m = html.match(/<h1[^>]*id="COPYRIGHT"[^>]*>[\s\S]*?<\/h1>([\s\S]*?)(?=<h1|<\/section>|$)/i);
  return m ? plain(m[1]).replace(/\s+/g, " ").trim().slice(0, 2000) : "";
}

function has(bin) {
  try {
    execFileSync("which", [bin]);
    return true;
  } catch {
    return false;
  }
}

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function fetchText(url, gzip) {
  const bytes = await fetchBytes(url);
  return (gzip ? gunzipSync(bytes) : Buffer.from(bytes)).toString("utf8");
}
