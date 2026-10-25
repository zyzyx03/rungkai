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
