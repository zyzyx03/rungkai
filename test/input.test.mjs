import test from "node:test";
import assert from "node:assert/strict";
import { checkText, checkBody, readBody, MAX_CMD } from "../src/lib/input.js";

// The characters that are refused, named rather than written: an escape, a
// bidi override that reads backwards, a zero-width space, a line separator,
// a newline, a tab and a delete.
const INVISIBLE = [
  String.fromCharCode(0x1b), // escape
  String.fromCharCode(0x202e), // right-to-left override
  String.fromCharCode(0x200b), // zero-width space
  String.fromCharCode(0x2028), // line separator
  "\n",
  "\t",
  String.fromCharCode(0x7f), // delete
];

test("a one-liner people actually type passes", () => {
  assert.equal(checkText("ls -la /var/log"), null);
  assert.equal(checkText("find /var/log -type f -name '*.log' -mtime +30 -exec rm -rf {} +"), null);
  // The longest command typed in ten thousand real ones was 746 characters.
  assert.equal(checkText("x".repeat(746)), null);
  assert.equal(checkText("x".repeat(MAX_CMD)), null);
});

test("a command over the limit is refused, and says what the limit is", () => {
  const problem = checkText("x".repeat(MAX_CMD + 1));
  assert.match(problem, /it is 1025 characters; the limit is 1024/);
});

test("the invisible characters are refused", () => {
  for (const c of INVISIBLE) {
    const problem = checkText(`ls${c}la`);
    assert.ok(problem, JSON.stringify(c));
    // The character is named, never carried back: a message that held it
    // would be read the way it makes the page read.
    assert.ok(!problem.includes(c), JSON.stringify(c));
    assert.match(problem, /U\+[0-9A-F]{4}/);
  }
});

test("a shell metacharacter is the point of a one-liner and is left alone", () => {
  assert.equal(checkText("a | b && c ; d $(e) `f` 'g' \"h\" >i 2>&1"), null);
});

test("a UTF-8 filename is fine", () => {
  assert.equal(checkText("ls /home/café"), null);
});

test("a body that says it is enormous is refused before it is read", () => {
  const request = (length) => ({ headers: { get: (name) => (name === "content-length" ? String(length) : null) } });
  assert.equal(checkBody(request(1024)), null);
  assert.match(checkBody(request(10 * 1024 * 1024)), /the limit is/);
  // A body that does not say its length is not assumed to be huge.
  assert.equal(checkBody({ headers: { get: () => null } }), null);
});

test("a body is read only when it is small enough and it is an object", async () => {
  const request = (body, length = 128) =>
    new Request("https://x.test/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(length) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  const good = await readBody(request({ cmd: "ls -la", env: "el9" }));
  assert.equal(good.error, undefined);
  assert.equal(good.body.cmd, "ls -la");
  assert.equal(good.env, "el9");

  // No environment given means every environment.
  assert.equal((await readBody(request({ cmd: "ls" }))).env, "all");

  assert.match((await readBody(request("not json"))).error, /not JSON/);
  assert.match((await readBody(request("7"))).error, /not an object/);
  assert.match((await readBody(request({ cmd: "ls" }, 10 * 1024 * 1024))).error, /the limit is/);
  assert.match((await readBody(request({ cmd: "ls", env: "a\nb" }))).error, /bad environment/);
});
