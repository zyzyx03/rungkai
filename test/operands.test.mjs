import test from "node:test";
import assert from "node:assert/strict";
import { optionArg, optionValues, synopsisFacts, operandDocs, commandEntries } from "../ingest/operands.mjs";

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

test("angle-bracket values are read for short flags and long aliases, keeping the first value", () => {
  const html = `<h1 id="OPTIONS">OPTIONS</h1>
    <p class="Pp">-m &lt;msg&gt;, --message=&lt;msg&gt;</p>
    <p class="Pp">-o &lt;file&gt;</p>
    <p class="Pp">--cleanup=&lt;mode&gt;</p>
    <p class="Pp">-o &lt;other&gt;</p>`;
  assert.deepEqual(optionValues(html), { "-m": "<msg>", "--message": "<msg>", "-o": "<file>", "--cleanup": "<mode>" });
  assert.equal(optionArg("-L &lt;start&gt;"), "<start>");
  assert.equal(optionArg("-S &lt;revs-file&gt;"), "<revs-file>");
  assert.equal(optionArg("-m <i>&lt;msg&gt;</i>"), "<msg>");
});

test("generic option placeholders are not values, including angle brackets", () => {
  for (const generic of ["OPTION", "OPTIONS", "ARG", "ARGS", "ARGUMENT", "ARGUMENTS"]) {
    for (const word of [generic, generic.toLowerCase()]) {
      for (const value of [word, `&lt;${word}&gt;`, `<i>${word}</i>`, `<i>&lt;${word}&gt;</i>`, `<var class="Ar">${word}</var>`, `<var class="Ar">&lt;${word}&gt;</var>`]) {
        assert.equal(optionArg(`-x ${value}`), null, value);
        assert.equal(optionArg(`--example=${value}`), null, value);
      }
    }
  }
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

test("operand prose excludes introductory boilerplate and has no length cap", () => {
  const html = `<h1 id="DESCRIPTION">DESCRIPTION</h1>
    <p class="Pp">This manual page documents the GNU version of rm.
    rm removes each specified file. By default, it does not remove directories.</p>
    <p class="Pp">The TARGET operand identifies the destination. ${"Further source detail. ".repeat(50)}</p>`;
  const docs = operandDocs(html, ["FILE", "TARGET", "absent"]);
  assert.equal(docs.FILE, "rm removes each specified file.");
  assert.ok(docs.TARGET.length > 600);
  assert.equal(docs.absent, undefined);
});

test("an explicit operand definition wins over an incidental mention", () => {
  const html = `<h1 id="DESCRIPTION">DESCRIPTION</h1>
    <p class="Pp">See FILE below.</p>
    <h1 id="OPERANDS">OPERANDS</h1>
    <dt>FILE</dt><dd>The input file.<p class="Pp">Further details.</p></dd>`;
  assert.equal(operandDocs(html, ["FILE"]).FILE, "The input file. Further details.");
});

test("a marked operand definition wins over general introductory mentions", () => {
  const html = `<h1 id="DESCRIPTION">DESCRIPTION</h1>
    <p class="Pp">ssh is a program for executing commands.</p>
    <p class="Pp">Use this command with care.</p>
    <p class="Pp">If a <i>command</i> is specified, it is executed on the remote host. Further source detail.</p>`;
  assert.equal(operandDocs(html, ["command"]).command,
    "If a command is specified, it is executed on the remote host. Further source detail.");
});

test("dnf-style Command: entries become subcommands", () => {
  const html = `<h1 class="Sh" id="COMMANDS">COMMANDS</h1>
<pre>Command: <b>install</b></pre><p class="Pp">Install packages.</p>
<pre>Command: <b>check-update</b></pre><p class="Pp">Check for updates.</p>`;
  assert.deepEqual(commandEntries(html), [
    { name: "install", desc: "Install packages." },
    { name: "check-update", desc: "Check for updates." },
  ]);
});

test("man(7) command paragraphs become commands", () => {
  const html = `<h1 id="COMMANDS">COMMANDS</h1>
    <p class="Pp"><b>status</b> [<i>PATTERN</i>...|<i>PID</i>...]]</p>
    <div class="Bd-indent">Show runtime status information.</div>
    <p class="Pp"><b>restart</b> <i>UNIT</i>...</p>
    <div class="Bd-indent">Restart the specified units.</div>`;
  assert.deepEqual(commandEntries(html), [
    { name: "status", desc: "Show runtime status information." },
    { name: "restart", desc: "Restart the specified units." },
  ]);
});
