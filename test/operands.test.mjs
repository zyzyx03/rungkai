import test from "node:test";
import assert from "node:assert/strict";
import { optionValues, synopsisFacts, operandDocs } from "../ingest/operands.mjs";

// mdoc: the value is an argument element.
const mdoc = `
<h1 class="Sh" id="SYNOPSIS"><a class="permalink" href="#SYNOPSIS">SYNOPSIS</a></h1>
<table class="Nm"><tbody><tr>
<td><code class="Nm">ssh</code></td>
<td>[<code class="Fl">-46Aa</code>] [<code class="Fl">-i</code> <var class="Ar">identity_file</var>]
  [<code class="Ar">destination</code>] [<code class="Ar">command</code>]</td>
</tr></tbody></table>
<h1 class="Sh" id="OPTIONS"><a class="permalink" href="#OPTIONS">OPTIONS</a></h1>
<dl class="Bl-tag">
  <dt><code class="Fl">-i</code> <var class="Ar">identity_file</var></dt>
  <dd>Specifies the identity file to use.</dd>
</dl>
<h1 class="Sh" id="DESCRIPTION"><a class="permalink" href="#DESCRIPTION">DESCRIPTION</a></h1>
<p class="Pp">ssh connects and logs into the specified destination.</p>`;

// The man macros: the value is in italics, and the operands are too.
const macros = `
<h1 class="Sh" id="SYNOPSIS"><a class="permalink" href="#SYNOPSIS">SYNOPSIS</a></h1>
<p class="Pp"><b>cut</b> <i>OPTION</i>... [<i>FILE</i>]...</p>
<h1 class="Sh" id="OPTIONS"><a class="permalink" href="#OPTIONS">OPTIONS</a></h1>
<p class="Pp"><b>-b</b>, <b>--bytes</b>=<i>LIST</i>
    <br/>select only these bytes</p>`;

test("an option's value comes from the option list", () => {
  const values = optionValues(mdoc);
  assert.equal(values["-i"], "identity_file");
});

test("a value written after an equals sign is read", () => {
  assert.equal(optionValues(macros)["--bytes"], "LIST");
});

test("the synopsis names the positional operands in order", () => {
  const { operands } = synopsisFacts(mdoc, "ssh");
  assert.deepEqual(operands, ["destination", "command"]);
});

test("a placeholder is not an operand", () => {
  const { operands } = synopsisFacts(macros, "cut");
  assert.deepEqual(operands, ["FILE"]);
});

test("the synopsis says which flag takes a value", () => {
  const { values } = synopsisFacts(mdoc, "ssh");
  assert.equal(values["-i"], "identity_file");
});

test("a flag the synopsis shows without a value takes none", () => {
  const { values } = synopsisFacts(mdoc, "ssh");
  assert.equal(values["-46Aa"], undefined);
});

test("the description of an operand is the page's own words for it", () => {
  const docs = operandDocs(mdoc, ["destination"]);
  assert.match(docs.destination, /logs into the specified destination/);
});
