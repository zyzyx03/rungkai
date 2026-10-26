import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "./parser.mjs";
import { explain } from "../src/lib/explain.js";
import { resolveCommands } from "../src/lib/wrap.js";
import { CONSTRUCTS } from "../src/lib/syntax.js";
import { audit, loadPages } from "../ingest/audit.mjs";
import { loadPage } from "../src/lib/pages.js";

// The one-liners people actually type. Each one must be fully explained by
// the corpus: no flag left undocumented, and no tool left with no page.
const cmds = JSON.parse(readFileSync("test/fixtures/one-liners.json", "utf8"));

// The corpus sample that ships with the repository, and the corpus on this
// machine when it has been built.
const SAMPLE = "test/fixtures/corpus";
const CORPUS = ".corpus/noble/pages";

// The whole pipeline, as the worker runs it.
async function run(cmd, pages) {
  const parsed = parse(cmd);
  const map = {};
  const commands = await resolveCommands(parsed, loadPage(pages), map);
  return explain(cmd, { ...parsed, commands }, map, "ubuntu/24.04");
}

const undocumented = (result) => result.segments.filter((s) => s.kind === "unknown").map((s) => s.text);

test("a line the grammar cannot read is refused, not explained as nothing", () => {
  for (const cmd of ["ls | ", "if; then", "&&&", "echo )"]) {
    assert.equal(parse(cmd).ok, false, cmd);
  }
  // A comment and a bare assignment are valid lines with nothing to explain.
  assert.equal(parse("# just a comment").ok, true);
  assert.equal(parse("FOO=bar").ok, true);
});

test("no popular one-liner leaves a flag the corpus does not document", async () => {
  const pages = loadPages(SAMPLE);
  const bad = [];
  for (const cmd of cmds) {
    const unknown = undocumented(await run(cmd, pages));
    if (unknown.length) bad.push(`${cmd} → ${unknown.join(" ")}`);
  }
  assert.deepEqual(bad, []);
});

test("no popular one-liner leaves a tool the corpus has no page for", async () => {
  const pages = loadPages(SAMPLE);
  for (const [name, page] of pages) {
    assert.equal(typeof page.env, "string", `${name} fixture needs its corpus environment`);
    assert.ok(page.env.length, `${name} fixture needs a nonempty environment`);
  }
  const bad = [];
  for (const cmd of cmds) {
    const gaps = (await run(cmd, pages)).gaps;
    if (gaps.length) bad.push(`${cmd} → ${gaps.join(" ")}`);
  }
  assert.deepEqual(bad, []);
});

test("every argument of a one-liner is explained, and every piece says the words it stands for", async () => {
  const pages = loadPages(SAMPLE);
  const bad = [];
  for (const cmd of cmds) {
    const parsed = parse(cmd);
    const result = await run(cmd, pages);
    // Every argument of every command has a piece of its own.
    for (const command of parsed.commands) {
      for (const arg of command.args) {
        const covered = result.segments.some((s) => s.start < arg.span[1] && s.end > arg.span[0]);
        if (!covered) bad.push(`${cmd} → ${arg.text} is not explained`);
      }
    }
    // And every piece quotes the command as it stands there. The shell's own
    // syntax is the exception: a construct is titled by what it is.
    for (const segment of result.segments) {
      if (segment.kind === "text" || segment.kind === "syntax") continue;
      if (cmd.slice(segment.start, segment.end) !== segment.text) {
        bad.push(`${cmd} → ${segment.text} is not what the command says`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

// The corpus on this machine, when it has been built: the same one-liners,
// against the real pages.
test("the corpus on this machine documents the same one-liners", {
  skip: existsSync(CORPUS) ? false : "no corpus: build one with node ingest/ingest.mjs noble",
}, async () => {
  const pages = loadPages(CORPUS);
  const bad = [];
  for (const cmd of cmds) {
    const result = await run(cmd, pages);
    const unknown = undocumented(result);
    if (unknown.length) bad.push(`${cmd} → ${unknown.join(" ")}`);
    if (result.gaps.length) bad.push(`${cmd} → no page for ${result.gaps.join(" ")}`);
  }
  assert.deepEqual(bad, []);
});

// The corpus on this machine, when it has been built: every tool in it, in
// every form its options are written in. This is the one that covers the
// tools nobody put in the list above.
test("every tool in the corpus is explained, in every form its options are written", {
  skip: existsSync(CORPUS) ? false : "no corpus: build one with node ingest/ingest.mjs noble",
}, async () => {
  const { unexplained } = await audit(loadPages(CORPUS));
  assert.deepEqual(unexplained, []);
});

// ── the shell's own syntax ─────────────────────────────────────────

test("the corpus holds every construct and every form of redirection the manual documents", async () => {
  const pages = loadPages(SAMPLE);
  const syntax = pages.get("bash")?.syntax ?? {};
  for (const construct of Object.keys(CONSTRUCTS)) {
    assert.ok(syntax[construct]?.length, `the corpus has no ${construct}`);
  }
  for (const operator of [">", ">>", "<", "<<", "<<<", "&>", "&>>", "<&", ">&", "<>"]) {
    assert.ok(syntax[operator]?.length, `the corpus has no ${operator}`);
  }
});

test("a loop is explained with the manual's own words for it", async () => {
  const pages = loadPages(SAMPLE);
  const result = await run("for f in *.txt; do echo $f; done", pages);
  const loop = result.segments.find((s) => s.kind === "syntax" && s.text === "for loop");
  assert.match(loop.anchor.desc, /The list of words following/);
  assert.equal(loop.anchor.title, "bash(1) — Shell Grammar");
});

test("a redirection is explained, and not left as loose text", async () => {
  const pages = loadPages(SAMPLE);
  const result = await run("crontab -u $user -l 2>/dev/null", pages);
  const redirect = result.segments.find((s) => s.kind === "syntax" && s.text === "2>/dev/null");
  assert.match(redirect.anchor.desc, /opened for writing/);
  assert.equal(redirect.anchor.title, "bash(1) — Redirecting Output");
});

// ── the two shapes that used to break ──────────────────────────────

test("each command a wrapper runs is a tool with its own page", async () => {
  const pages = loadPages(SAMPLE);
  const result = await run("sudo ss -tulpn", pages);
  const tools = result.segments.filter((s) => s.kind === "tool").map((s) => s.text);
  assert.deepEqual(tools, ["sudo", "ss"]);
  // The flags belong to ss, not to sudo.
  const flag = result.segments.find((s) => s.text === "-t");
  assert.equal(flag.anchor.title, "-t, --tcp");
  assert.deepEqual(undocumented(result), []);

  for (const [cmd, titles] of [
    ["docker run -d nginx && docker ps -a", ["docker-run(1)", "docker-ps(1)"]],
    ["git status && git diff", ["git-status(1)", "git-diff(1)"]],
    ["sudo docker run -d nginx && sudo docker ps -a", ["sudo(8)", "docker-run(1)", "sudo(8)", "docker-ps(1)"]],
  ]) {
    const explained = await run(cmd, pages);
    assert.deepEqual(explained.segments.filter((s) => s.kind === "tool").map((s) => s.anchor.title), titles);
    assert.deepEqual(undocumented(explained), []);
    if (cmd.includes("-d")) assert.equal(explained.segments.find((s) => s.text === "-d").anchor.title, "-d, --detach");
  }
});

test("the command find runs is a tool of its own", async () => {
  const pages = loadPages(SAMPLE);
  const result = await run("find /var/log -type f -mtime +30 -exec rm -rf {} +", pages);
  const tools = result.segments.filter((s) => s.kind === "tool").map((s) => s.text);
  assert.deepEqual(tools, ["find", "rm"]);
  // -r and -f are rm's flags, not find's.
  const recursive = result.segments.find((s) => s.text === "-r");
  assert.match(recursive.anchor.title, /--recursive/);
  assert.deepEqual(undocumented(result), []);
});

test("a wrapper that takes a subcommand keeps it as its own", async () => {
  const pages = loadPages(SAMPLE);
  const result = await run("systemctl status nginx", pages);
  const tools = result.segments.filter((s) => s.kind === "tool").map((s) => s.text);
  assert.deepEqual(tools, ["systemctl"]);
  assert.deepEqual(result.gaps, []);
});

test("double dash ends options for each command, including commands inside wrappers", async () => {
  const pages = loadPages(SAMPLE);
  for (const cmd of ["ls -- -la", "grep -- -v file", "sudo -- ls -- -la"]) {
    const result = await run(cmd, pages);
    const literal = result.segments.find((s) => s.text === (cmd.includes("grep") ? "-v" : "-la"));
    assert.equal(literal.kind, "operand", cmd);
    assert.deepEqual(undocumented(result), [], cmd);
    assert.equal(result.segments.some((s) => s.kind === "arg"), false, cmd);
  }
  const result = await run("ls -- -la && ls -la", pages);
  assert.equal(result.segments.filter((s) => s.kind === "operand" && s.text === "-la").length, 1);
  assert.equal(result.segments.filter((s) => s.kind === "arg").length, 2);
  const find = await run("find -- -exec rm -rf", pages);
  assert.deepEqual(find.segments.filter((s) => s.kind === "tool").map((s) => s.tool), ["find"]);
});

test("quoted flag words are operands or option values and keep their original spans", async () => {
  const pages = loadPages(SAMPLE);
  const ls = await run('ls "-la"', pages);
  assert.equal(ls.segments.find((s) => s.text === '"-la"').kind, "operand");
  const git = await run('git commit -m "-q"', pages);
  const message = git.segments.find((s) => s.text === '"-q"');
  assert.equal(message.kind, "arg");
  assert.equal(message.anchor.key, git.segments.find((s) => s.text === "-m").anchor.key);
  assert.equal(message.anchor.value, "<msg>");
  assert.equal(git.segments.some((s) => s.anchor?.title.includes("--quiet")), false);
  for (const cmd of ['ssh -i "-N"', "ssh -i -N", "ssh -i --"]) {
    const result = await run(cmd, pages);
    const flag = result.segments.find((s) => s.text === "-i");
    const value = result.segments.find((s) => ["\"-N\"", "-N", "--"].includes(s.text));
    assert.equal(value.anchor.key, flag.anchor.key, cmd);
    assert.equal(cmd.slice(value.start, value.end), value.text);
  }
});

test("section 8 citations survive option, value and operand anchors and source deduplication", async () => {
  const pages = loadPages(SAMPLE);
  const result = await run("sudo -u www ls -la", pages);
  assert.equal(result.segments.find((s) => s.text === "sudo").anchor.title, "sudo(8)");
  for (const text of ["-u", "www"]) {
    assert.equal(result.segments.find((s) => s.text === text).anchor.section, 8);
  }
  assert.ok(result.sources.some((s) => s.title === "sudo(8)"));
  assert.equal(result.sources.some((s) => s.title === "sudo(1)"), false);
  const operand = (await run("sudo -u www nonexistent", pages)).segments.find((s) => s.text === "nonexistent");
  assert.equal(operand.anchor.section, 8);
});

test("a documented plus attribute is an option and the next word is the file", async () => {
  const result = await run("chattr +i config.conf", loadPages(SAMPLE));
  const option = result.segments.find((s) => s.text === "+i");
  assert.equal(option.kind, "arg");
  assert.match(option.anchor.desc, /cannot be modified/);
  assert.equal(result.segments.find((s) => s.text === "config.conf").anchor.title, "files");
});

test("every fixture option and operand carries source text or an explicit gap", async () => {
  const { silent } = await audit(loadPages(SAMPLE));
  assert.deepEqual(silent, []);
});

for (const dir of [".corpus/noble/pages", ".corpus/el9/pages", ".corpus/alpine/3.22/pages", ".corpus/docker/pages"]) {
  test(`${dir}: every option and operand carries source text or an explicit gap`, {
    skip: !existsSync(dir),
  }, async () => {
    const { silent } = await audit(loadPages(dir));
    assert.deepEqual(silent, []);
  });
}

test("the example preserves full option prose and the operand's own meaning", async () => {
  const pages = loadPages(SAMPLE);
  const result = await run("find /var/log -type f -name '*.log' -mtime +30 -exec rm -rf {} +", pages);
  const desc = (text) => result.segments.find((s) => s.text === text)?.anchor?.desc;
  assert.equal(result.segments.find((s) => s.text === "/var/log").anchor, null);
  assert.match(desc("-type"), /f regular file/);
  // find(1) writes -type with c as its value placeholder; this command used
  // f, so the card's title carries the word the reader typed.
  assert.equal(result.segments.find((s) => s.text === "-type").anchor.title, "-type f");
  assert.equal(result.segments.find((s) => s.text === "-type").anchor.value, null);
  assert.match(desc("-type"), /more than one type/);
  assert.match(desc("-name"), /fnmatch\(3\)/);
  assert.match(desc("-name"), /Don't forget to enclose the pattern in quotes/);
  assert.match(desc("-mtime"), /rounding affects/);
  // The command used the "+" form of -exec, so that is the form the page's own words come from: find(1) writes "-exec command ;" and "-exec command {} +" as two entries.
  assert.match(desc("-exec"), /command line is built by appending each selected file name/);
  assert.equal(result.segments.find((s) => s.text === "-exec").anchor.title, "-exec command {} +");
  assert.equal(desc("+"), desc("-exec"));
  assert.equal(desc("-r"), "remove directories and their contents recursively");
  // The operand's own words, not the page's opening line: rm(1) writes
  // "Remove (unlink) the FILE(s)." in the OPTIONS section, before its first
  // flag, and that is what the operand means.
  assert.equal(desc("{}"), "Remove (unlink) the FILE(s).");
  assert.notEqual(desc("{}"), pages.get("rm").description);
  assert.equal(result.segments.find((s) => s.text === "+").anchor.key, "find:-exec");
  assert.match(pages.get("find").description, /GNU find searches the directory tree/);
  // The command card carries the page's summary; the full option list is not
  // sent with every explanation.
  assert.equal(result.segments.find((s) => s.text === "find").anchor.desc, pages.get("find").synopsis);
});

test("the description audit detects deleted option and operand text", async () => {
  for (const kind of ["options", "operands"]) {
    const pages = loadPages(SAMPLE);
    const entry = pages.get("rm")[kind].find((entry) => entry.desc);
    delete entry.desc;
    const { silent } = await audit(pages);
    assert.ok(silent.some((line) => line.startsWith("rm:")), `${kind} deletion must fail the audit`);
  }
});
