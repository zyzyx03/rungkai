import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { synopsisOptions } from "../ingest/synopsis.mjs";

const rpm = `
<section class="Sh">
<h1 class="Sh" id="SYNOPSIS"><a href="#SYNOPSIS">SYNOPSIS</a></h1>
<section class="Ss">
<h2 class="Ss" id="Q">QUERYING AND VERIFYING PACKAGES:</h2>
<p class="Pp"><b>rpm</b> {<b>-q|--query</b>} [<b>select-options</b>]
    [<b>query-options</b>]</p>
<p class="Pp"><b>rpm</b> <b>--querytags</b></p>
</section>
</section>
<section class="Sh">
<h1 class="Sh" id="DESCRIPTION">DESCRIPTION</h1>
<p class="Pp"><b>-z</b> only in prose</p>
</section>`;

test("synopsis-only options are extracted with their line", () => {
  const got = synopsisOptions(rpm, new Set(["-a", "--all"]));
  assert.deepEqual(got.map((o) => o.names), [["-q", "--query"], ["--querytags"]]);
  assert.match(got[0].desc, /^In the SYNOPSIS: rpm \{-q\|--query\}/);
  const signed = synopsisOptions(rpm.replace("-q|--query", "+i|-i"), new Set());
  assert.deepEqual(signed[0].names, ["+i", "-i"]);
});

test("symbolic modes expand only writable attributes using their definitions", () => {
  const html = readFileSync(new URL("./fixtures/chattr.html", import.meta.url), "utf8");
  const got = synopsisOptions(html, new Set(["-RVf"]));
  assert.deepEqual(got.map((o) => o.names), [["+i"], ["-i"]]);
  assert.match(got[0].desc, /operator '\+' causes.*added/);
  assert.match(got[0].desc, /'i' attribute cannot be modified/);
  assert.deepEqual(synopsisOptions(html, new Set(["-RVf", "+i", "-i"])), []);
});

test("an option already documented in the list is not repeated", () => {
  const got = synopsisOptions(rpm, new Set(["-q", "--query"]));
  assert.deepEqual(got.map((o) => o.names), [["--querytags"]]);
});

test("prose outside SYNOPSIS is ignored", () => {
  assert.equal(synopsisOptions(rpm, new Set(["-q", "--query", "--querytags"])).length, 0);
});
