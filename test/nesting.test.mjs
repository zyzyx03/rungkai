import test from "node:test";
import assert from "node:assert/strict";
import { explain } from "../src/lib/explain.js";
import { nestPieces, commandText } from "../src/lib/nesting.js";

const page = (synopsis) => ({ synopsis, source: "https://example.test/x", options: [] });

// A command substitution with a command inside it, and a substitution inside
// that: the pieces nest rather than sit side by side.
const cmd = 'name=$(printf "%s@%s" "$(id -nu)")';
const parsed = {
  commands: [
    {
      name: "printf",
      nameSpan: [7, 13],
      args: [
        { text: '"%s@%s"', span: [14, 21] },
        { text: '"$(id -nu)"', span: [22, 33] },
      ],
    },
    { name: "id", nameSpan: [25, 27], args: [{ text: "-nu", span: [28, 31] }] },
  ],
  syntax: [
    { text: '$(printf "%s@%s" "$(id -nu)")', section: "Command Substitution", span: [5, 33] },
    { text: "$(id -nu)", section: "Command Substitution", span: [23, 32] },
  ],
};

const rebuild = (command, segments) =>
  commandText(command, nestPieces(segments.filter((s) => s.kind !== "text")));

test("a command substitution nests the commands inside it", () => {
  const result = explain(cmd, parsed, { printf: page("format and print"), id: page("print user id") }, "el9");
  assert.equal(rebuild(cmd, result.segments), cmd);
});

test("a nested substitution prints its parts once, not twice", () => {
  const result = explain(cmd, parsed, { printf: page("format and print"), id: page("print user id") }, "el9");
  const printed = rebuild(cmd, result.segments);
  assert.equal(printed.split("printf").length - 1, 1);
  assert.equal(printed.split("id -nu").length - 1, 1);
});

test("the outer substitution is the region and the commands are inside it", () => {
  const result = explain(cmd, parsed, { printf: page("format and print"), id: page("print user id") }, "el9");
  const roots = nestPieces(result.segments.filter((s) => s.kind !== "text"));
  assert.equal(roots.length, 1);
  assert.equal(roots[0].piece.kind, "syntax");
  assert.deepEqual(roots[0].children.map((c) => c.piece.kind), ["tool", "operand", "operand"]);
});

test("a flat command still prints once", () => {
  const flat = {
    commands: [{ name: "ss", nameSpan: [0, 2], args: [{ text: "-tlnp", span: [3, 8] }] }],
    syntax: [],
  };
  const result = explain("ss -tlnp", flat, { ss: page("sockets") }, "el9");
  assert.equal(rebuild("ss -tlnp", result.segments), "ss -tlnp");
});
