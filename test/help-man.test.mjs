import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../ingest/help-man.mjs", import.meta.url));
const run = (args, input) => execFileSync(process.execPath, [script, ...args], { input, encoding: "utf8" });

test("help becomes a .TP list", () => {
  const out = run(
    ["--name", "pt-x", "--desc", "Does x."],
    "Usage: pt-x [OPTIONS]\n\nFlags:\n  -h, --help   Show help.\n      --mongodb.uri=URI   Connection URI.\n",
  );
  assert.match(out, /\.SH NAME\npt-x \\- Does x\./);
  assert.match(out, /\\fB-h, --help\\fR/);
  assert.match(out, /\\fB--mongodb\.uri\\fR/);
  assert.match(out, /Connection URI\./);
});

test("--man fills an empty NAME line", () => {
  const out = run(["--man", "--name", "pt-x", "--desc", "Does x."], '.TH pt-x 1\n.SH "NAME"\npt-x\n.SH "SYNOPSIS"\n');
  assert.match(out, /\.SH "NAME"\npt-x \\- Does x\./);
});

test("an option without a description stays a gap, not an alias of the next", () => {
  const out = run(
    ["--name", "pt-x", "--desc", "Does x."],
    "Usage: pt-x\n\nFlags:\n      --version\n      --all   Do all.\n",
  );
  assert.ok(out.indexOf("--all") < out.indexOf("--version"), "the described option comes first");
  assert.match(out, /--version\\fR\n\n?$/);
});

test("--[no-]flag is named in both spellings", () => {
  const out = run(
    ["--name", "pt-x", "--desc", "Does x."],
    "Usage: pt-x\n\nFlags:\n      --[no-]version-check   Check.\n",
  );
  assert.match(out, /--version-check, --no-version-check/);
});
