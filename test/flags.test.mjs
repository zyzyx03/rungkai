import test from "node:test";
import assert from "node:assert/strict";
import { flagParagraphOptions } from "../ingest/flags.mjs";

const html = `
<section class="Sh">
<h1 class="Sh" id="OPTIONS"><a href="#OPTIONS">OPTIONS</a></h1>
<p class="Pp"><b>-a</b>, <b>--all</b>[=false] \tShow all containers (default
    shows just running)</p>
<p class="Pp"><b>-f</b>, <b>--file</b> <i>PATH/Dockerfile</i>
  <br/>
   Path to the Dockerfile to use.</p>
<p class="Pp"><b>--format</b>=&quot;&quot; \tFormat output using a custom template</p>
</section>
<section class="Sh">
<h1 class="Sh" id="DESCRIPTION">DESCRIPTION</h1>
<p class="Pp"><b>--not-an-option</b> \tNot in OPTIONS</p>
</section>`;

test("flag paragraphs become options, short and long names together", () => {
  const got = flagParagraphOptions(html, new Set());
  assert.deepEqual(got.map((o) => o.names), [["-a", "--all"], ["-f", "--file"], ["--format"]]);
  assert.equal(got[0].desc, "Show all containers (default shows just running)");
  assert.equal(got[1].desc, "Path to the Dockerfile to use.");
});

test("names already documented are not repeated", () => {
  const got = flagParagraphOptions(html, new Set(["--all", "-a"]));
  assert.deepEqual(got.map((o) => o.names), [["-f", "--file"], ["--format"]]);
});

test("prose outside the OPTIONS section is ignored", () => {
  assert.equal(flagParagraphOptions('<section class="Sh"><h1 id="DESCRIPTION">D</h1><p class="Pp"><b>--x</b> \td</p></section>', new Set()).length, 0);
});

test("nested definitions and indented blocks retain all option prose", async () => {
  const { parseOptions } = await import("../ingest/flags.mjs");
  const html = `<dt>-type c</dt><dd>File is of type c:
    <dl><dt>f</dt><dd>regular file</dd><dt>d</dt><dd>directory</dd></dl>
    <p class="Pp">More than one type may be specified.</p></dd>
    <p class="Pp">--nested</p><div class="Bd-indent">First paragraph.
    <div class="Bd-indent">Nested text.</div>Last paragraph.</div>`;
  const got = parseOptions(html);
  assert.equal(got[0].desc, "File is of type c: f regular file d directory More than one type may be specified.");
  assert.equal(got[1].desc, "First paragraph. Nested text. Last paragraph.");
});

test("a definition continues through a sibling indent and an empty term", async () => {
  const { parseOptions } = await import("../ingest/flags.mjs");
  const html = `<dl><dt>-type c</dt><dd>File is of type c:</dd></dl>
    <div class="Bd-indent"><dl><dt>f</dt><dd>regular file</dd></dl></div>
    <dl><dt></dt><dd>Additional source detail.</dd><dt>-next</dt><dd>Next option.</dd></dl>`;
  assert.equal(parseOptions(html)[0].desc, "File is of type c: f regular file Additional source detail.");
});

test("consecutive empty definitions share the following source description", async () => {
  const { parseOptions } = await import("../ingest/flags.mjs");
  const html = `<dl><dt>-a</dt><dd></dd><dt>--addresses</dt>
    <dd>Display the address. Full source paragraph.</dd>
    <dt>-b</dt><dd></dd></dl><h1>OTHER</h1>
    <dl><dt>--unrelated</dt><dd>Unrelated description.</dd></dl>`;
  const got = parseOptions(html);
  assert.equal(got[0].desc, "Display the address. Full source paragraph.");
  assert.equal(got[1].desc, got[0].desc);
  assert.equal(got[2].desc, "");
});

test("a long option may carry a dot", async () => {
  const { parseOptions } = await import("../ingest/flags.mjs");
  const html = `
<section class="Sh">
<h1 class="Sh" id="OPTIONS">OPTIONS</h1>
<dl class="Bl-tag Bl-compact">
<dt><b>--mongodb.uri</b>=<i>URI</i></dt>
<dd><p class="Pp">Connection URI.</p></dd>
</dl>
</section>`;
  const got = parseOptions(html);
  assert.deepEqual(got[0].names, ["--mongodb.uri"]);
});
