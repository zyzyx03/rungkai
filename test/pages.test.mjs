import test from "node:test";
import assert from "node:assert/strict";
import { matchArg } from "../src/lib/pages.js";

const tar = {
  options: [
    { names: ["-z", "--gzip"], desc: "gzip" },
    { names: ["-c", "--create"], desc: "create" },
    { names: ["-f", "--file"], desc: "file" },
  ],
};

test("bundled short flags split into one part per letter", () => {
  const { parts } = matchArg("-zcf", tar);
  assert.deepEqual(parts.map((p) => p.name), ["-z", "-c", "-f"]);
  assert.deepEqual(parts.map((p) => [p.text, p.offset]), [["-z", 0], ["c", 2], ["f", 3]]);
});

test("long option with a value matches by name", () => {
  assert.ok(matchArg("--gzip=1", tar).names.includes("--gzip"));
  for (const [name, flag, value] of [
    ["-<signal>", "--help", "-TERM"],
    ["-<digit>", "--version", "-5"],
    ["-<n>", "--oneline", "-3"],
  ]) {
    const page = { options: [{ names: [name], desc: "placeholder" }] };
    assert.equal(matchArg(flag, page), null);
    assert.equal(matchArg(value, page).names[0], name);
  }
});

test("quoted operands never match", () => {
  assert.equal(matchArg('"some-dir"', tar), null);
  assert.equal(matchArg("some-dir", tar), null);
  for (const token of ['"-zcf"', "'-zcf'", '$"-zcf"', "$'-zcf'"]) {
    assert.equal(matchArg(token, tar), null);
  }
});

test("a bare double dash is never an option, even if a page lists it", () => {
  assert.equal(matchArg("--", tar), null);
  assert.equal(matchArg("--", { options: [{ names: ["--"], desc: "terminator" }] }), null);
});

test("unknown bundled flag is not invented", () => {
  assert.deepEqual(matchArg("-zq", tar).parts.map((p) => p.name), ["-z"]);
});

test("single-dash long options (find style) match whole", () => {
  assert.equal(matchArg("-type", { options: [{ names: ["-type"], desc: "type" }] }).names[0], "-type");
});

const ambiguous = {
  options: [
    { names: ["-i", "--info"], desc: "info" },
    { names: ["-i", "--install"], desc: "install" },
  ],
};

test("mode context chooses between entries sharing a short flag", () => {
  assert.equal(matchArg("-i", ambiguous, { prefer: "--install" }).desc, "install");
  assert.equal(matchArg("-i", ambiguous, { prefer: "--info" }).desc, "info");
  assert.equal(matchArg("-i", ambiguous).desc, "info");
});
