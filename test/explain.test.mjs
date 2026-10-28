import test from "node:test";
import assert from "node:assert/strict";
import { explain } from "../src/lib/explain.js";

const rsync = {
  synopsis: "copy files",
  source: "https://example.test/rsync",
  options: [
    { names: ["--archive", "-a"], desc: "archive" },
    { names: ["--human-readable", "-h"], desc: "human" },
    { names: ["--one-file-system", "-x"], desc: "one" },
  ],
};
const parsed = (cmd, args) => ({
  commands: [{ name: "rsync", nameSpan: [0, 5], args }],
  syntax: [],
});
const cards = (result) => result.segments.filter((s) => s.kind === "arg").map((s) => s.anchor.title);

test("a bundle splits into one card per option", () => {
  const result = explain("rsync -ahax", parsed("rsync -ahax", [{ text: "-ahax", span: [6, 11] }]), { rsync }, "el9");
  assert.deepEqual(cards(result), ["--archive, -a", "--human-readable, -h", "--one-file-system, -x"]);
});

test("a repeated letter is not a second token", () => {
  const result = explain("rsync -ahax", parsed("rsync -ahax", [{ text: "-ahax", span: [6, 11] }]), { rsync }, "el9");
  assert.equal(result.segments.filter((s) => s.kind === "arg").length, 3);
});

test("the same option typed twice gets one card", () => {
  const result = explain("rsync -a -a", parsed("rsync -a -a", [{ text: "-a", span: [6, 8] }, { text: "-a", span: [9, 11] }]), { rsync }, "el9");
  assert.deepEqual(cards(result), ["--archive, -a"]);
});

const rpmPage = {
  synopsis: "RPM Package Manager",
  source: "https://example.test/rpm",
  options: [
    { names: ["-i", "--info"], desc: "info" },
    { names: ["-i", "--install"], desc: "install" },
    { names: ["-q", "--query"], desc: "query" },
    { names: ["-v", "--verbose"], desc: "verbose" },
  ],
};
const rpmParsed = (cmd, args) => ({ commands: [{ name: "rpm", nameSpan: [0, 3], args }], syntax: [] });
const descOf = (result, text) => result.segments.find((s) => s.text === text && s.anchor)?.anchor.desc;

test("rpm -i means --info when the command queries", () => {
  const result = explain("rpm -qi", rpmParsed("rpm -qi", [{ text: "-qi", span: [4, 7] }]), { rpm: rpmPage }, "el9");
  assert.equal(descOf(result, "i"), "info");
});

test("rpm -i means --install when the command installs", () => {
  const result = explain("rpm -ivh", rpmParsed("rpm -ivh", [{ text: "-ivh", span: [4, 8] }]), { rpm: rpmPage }, "el9");
  assert.equal(descOf(result, "-i"), "install");
  const literal = explain("rpm -i -- -q", rpmParsed("rpm -i -- -q", [
    { text: "-i", span: [4, 6] }, { text: "--", span: [7, 9] }, { text: "-q", span: [10, 12] },
  ]), { rpm: rpmPage }, "el9");
  assert.equal(descOf(literal, "-i"), "install");
  assert.equal(literal.segments.find((s) => s.text === "-q").kind, "operand");
});

// ── one entry per thing, and function definitions ────────────────
test("the same tool twice is one entry, not two", () => {
  const twice = {
    commands: [
      { name: "echo", nameSpan: [0, 4], args: [] },
      { name: "echo", nameSpan: [7, 11], args: [] },
    ],
    syntax: [],
  };
  const result = explain("echo hi | echo yo", twice, { echo: { synopsis: "write", source: "https://example.test/echo" } }, "el9");
  const keys = result.segments.filter((s) => s.kind === "tool").map((s) => s.anchor.key);
  assert.deepEqual(keys, ["cmd:echo", "cmd:echo"]);
});

test("a tool with no page is one entry however often it appears", () => {
  const twice = {
    commands: [
      { name: "nope", nameSpan: [0, 4], args: [] },
      { name: "nope", nameSpan: [7, 11], args: [] },
    ],
    syntax: [],
  };
  const result = explain("nope a | nope b", twice, {}, "el9");
  const keys = result.segments.filter((s) => s.kind === "tool").map((s) => s.anchor.key);
  assert.deepEqual(keys, ["gap:nope", "gap:nope"]);
});

test("a function definition explains as a function, not as loose text", () => {
  const def = {
    commands: [{ name: "echo", nameSpan: [10, 14], args: [] }],
    syntax: [{ text: "greet", span: [0, 20], section: "Shell Functions" }],
  };
  const result = explain("greet() { echo hi; }", def, { echo: { synopsis: "write", source: "https://example.test/echo" } }, "el9");
  const fn = result.segments.find((s) => s.kind === "syntax");
  assert.equal(fn.anchor.title, "bash(1) — Shell Functions");
  assert.equal(fn.anchor.key, "bash:Shell Functions");
  assert.equal(fn.text, "greet");
});

test("a shell builtin explains from bash(1), not as a gap", () => {
  const colon = {
    commands: [{ name: ":", nameSpan: [0, 1], args: [] }],
    syntax: [],
  };
  const result = explain(":()", colon, {}, "el9");
  const builtin = result.segments.find((s) => s.kind === "builtin");
  assert.equal(builtin.anchor.title, "bash(1) § Builtins");
  assert.equal(builtin.anchor.desc, "Does nothing and returns a successful exit status.");
  assert.equal(result.gaps.length, 0);
});

test("a command with no page and no builtin is still a gap", () => {
  const unknown = {
    commands: [{ name: "nosuchtool", nameSpan: [0, 10], args: [] }],
    syntax: [],
  };
  const result = explain("nosuchtool", unknown, {}, "el9");
  assert.equal(result.segments.find((s) => s.kind === "tool").anchor.key, "gap:nosuchtool");
  assert.equal(result.gaps.length, 1);
});

// ── values and operands ───────────────────────────────────────────
const ssh = {
  synopsis: "secure shell",
  source: "https://example.test/ssh",
  options: [
    { names: ["-i", "--identity-file"], desc: "the identity file" },
    { names: ["-N"], desc: "no remote command" },
  ],
  values: { "-i": "identity_file" },
  operands: [
    { name: "destination", desc: "the host to log into" },
    { name: "command", desc: "the command to run there" },
  ],
};
const sshParsed = (args) => ({ commands: [{ name: "ssh", nameSpan: [0, 3], args }], syntax: [] });
const cardOf = (result, text) => result.segments.find((s) => s.text === text && s.anchor)?.anchor;

test("command cards carry the summary while used flags keep their own definitions", () => {
  const page = { ...ssh, description: "The complete SSH manual. ".repeat(1000) };
  const result = explain("ssh -N host", sshParsed([
    { text: "-N", span: [4, 6] },
    { text: "host", span: [7, 11] },
  ]), { ssh: page }, "el9");
  const command = cardOf(result, "ssh");
  assert.equal(command.desc, page.synopsis);
  assert.equal(command.url, page.source);
  assert.equal("description" in command, false);
  assert.equal("options" in command, false);
  assert.equal(cardOf(result, "-N").desc, "no remote command");
  assert.equal(cardOf(result, "host").desc, "the host to log into");
});

test("the word after an option that takes a value belongs to that option", () => {
  const result = explain("ssh -i keyfile", sshParsed([{ text: "-i", span: [4, 6] }, { text: "keyfile", span: [7, 14] }]), { ssh }, "el9");
  assert.equal(cardOf(result, "-i").key, cardOf(result, "keyfile").key);
  assert.equal(cardOf(result, "-i").value, "identity_file");
});

test("an option that takes no value leaves the next word to the page", () => {
  const result = explain("ssh -N host", sshParsed([{ text: "-N", span: [4, 6] }, { text: "host", span: [7, 11] }]), { ssh }, "el9");
  assert.equal(cardOf(result, "host").title, "destination");
});

test("the words that are not options claim the operands in order", () => {
  const result = explain("ssh host whoami", sshParsed([{ text: "host", span: [4, 8] }, { text: "whoami", span: [9, 15] }]), { ssh }, "el9");
  assert.equal(cardOf(result, "host").title, "destination");
  assert.equal(cardOf(result, "whoami").title, "command");
});

test("an operand the page names by that name is that operand", () => {
  const result = explain("ssh host command", sshParsed([{ text: "host", span: [4, 8] }, { text: "command", span: [9, 16] }]), { ssh }, "el9");
  assert.equal(cardOf(result, "command").title, "command");
});

test("a word the page does not name is plain, not a gap", () => {
  const result = explain("ssh host", sshParsed([{ text: "host", span: [4, 8] }]), { ssh: { synopsis: "s", source: "u" } }, "el9");
  assert.equal(result.segments.find((s) => s.text === "host").anchor, null);
  assert.notEqual(result.segments.find((s) => s.text === "host").gap, true);
});

test("a flag the page does not list is not mistaken for an operand", () => {
  const result = explain("ssh --nope host", sshParsed([{ text: "--nope", span: [4, 10] }, { text: "host", span: [11, 15] }]), { ssh }, "el9");
  assert.equal(result.segments.find((s) => s.kind === "unknown").anchor.title, "--nope");
  assert.equal(cardOf(result, "host").title, "destination");
});

test("a subcommand page covers the subcommand words", () => {
  const docker = {
    ...ssh,
    cmd: "docker-run",
    subArgs: 1,
    synopsis: "run a container",
    options: [...ssh.options, { names: ["-d", "--detach"], desc: "detach" }],
  };
  const result = explain("docker run -d nginx", {
    commands: [{ name: "docker", nameSpan: [0, 6], args: [{ text: "run", span: [7, 10] }, { text: "-d", span: [11, 13] }, { text: "nginx", span: [14, 19] }] }],
    syntax: [],
  }, { docker }, "el9");
  const tool = result.segments.find((s) => s.kind === "tool");
  assert.equal(tool.text, "docker run");
  assert.equal(cardOf(result, "run"), undefined);
  assert.equal(cardOf(result, "nginx").title, "destination");
});

test("a documented subcommand gets its own card; the package name stays plain", () => {
  const page = {
    synopsis: "DNF Command Reference",
    source: "https://example.test/dnf",
    options: [{ names: ["-y", "--assumeyes"], desc: "answer yes" }],
    operands: [
      { name: "install", desc: "Install packages.", command: true },
      { name: "remove", desc: "Remove packages.", command: true },
    ],
  };
  const parsed = {
    commands: [{
      name: "dnf",
      nameSpan: [0, 3],
      args: [
        { text: "install", span: [4, 11] },
        { text: "-y", span: [12, 14] },
        { text: "httpd", span: [15, 20] },
      ],
    }],
    syntax: [],
  };
  const result = explain("dnf install -y httpd", parsed, { dnf: page }, "el9");
  const byText = (text) => result.segments.find((s) => s.text === text);
  assert.equal(byText("install").anchor.desc, "Install packages.");
  assert.notEqual(byText("install").gap, true);
  assert.equal(byText("httpd").anchor, null);
  assert.equal(byText("-y").anchor.desc, "answer yes");
});

test("an unnamed positional operand with no description stays plain", () => {
  const page = {
    synopsis: "Control services",
    source: "https://example.test/systemctl",
    operands: [{ name: "COMMAND", desc: "" }, { name: "UNIT", desc: "" }],
  };
  const parsed = {
    commands: [{ name: "systemctl", nameSpan: [0, 9], args: [{ text: "status", span: [10, 16] }, { text: "nginx", span: [17, 22] }] }],
    syntax: [],
  };
  const result = explain("systemctl status nginx", parsed, { systemctl: page }, "el9");
  const nginx = result.segments.find((s) => s.text === "nginx" && s.anchor);
  assert.equal(nginx, undefined);
  assert.equal(result.gaps.length, 0);
});

test("a synopsis-only flag carries the page's usage as its citation", () => {
  const page = {
    synopsis: "RPM Package Manager",
    source: "https://example.test/rpm",
    options: [{ names: ["-q"], usage: "rpm {-q|--query} [select-options] [query-options]", desc: "" }],
  };
  const parsed = { commands: [{ name: "rpm", nameSpan: [0, 3], args: [{ text: "-q", span: [4, 6] }] }], syntax: [] };
  const result = explain("rpm -q", parsed, { rpm: page }, "el9");
  const q = result.segments.find((s) => s.text === "-q" && s.anchor)?.anchor;
  assert.match(q.desc, /only in its synopsis/);
});
