// Build a man page for a Percona tool that ships only --help, or repair the
// NAME line of a man page the tool prints itself.
//
//   tool --help      | node ingest/help-man.mjs --name tool --desc "One line." > tool.1
//   tool --help-man  | node ingest/help-man.mjs --man --name tool --desc "One line." > tool.1
//
// The help formats differ: kingpin prints "  -h, --help   Desc", getopt prints
// " -a, --opt=<placeholder>" with the words after the equal sign standing in
// for the value. Both become a .TP list, which is what the ingester reads.
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : args[at + 1];
};
const name = option("name");
const desc = option("desc", "");
if (!name) {
  console.error("usage: tool --help | node ingest/help-man.mjs --name <tool> --desc <one line>");
  process.exit(1);
}

const input = await new Response(process.stdin).text();

// A kingpin page names the tool but says nothing about it; the corpus needs
// the one-liner after the dash.
if (args.includes("--man")) {
  const lines = input.split("\n");
  const at = lines.findIndex((line) => /^\.SH\s+"?NAME"?\s*$/.test(line));
  if (at !== -1 && lines[at + 1] && !/^\.SH/.test(lines[at + 1])) {
    lines[at + 1] = `${name} \\- ${desc}`;
  }
  process.stdout.write(lines.join("\n"));
  process.exit(0);
}

const lines = input.split("\n");
const synopsis = (lines.find((line) => /^Usage:\s+/.test(line)) ?? "").replace(/^Usage:\s+/, "").trim();

// Only a line that starts with a macro character needs the escape; a flag
// label starts with a backslash (bold), so its dash is safe.
const body = (text) => text.replace(/\\/g, "\\\\").replace(/(^|\n)([-.'])/g, "$1\\&$2");
const label = (text) => text.replace(/\\/g, "\\\\");

const entries = [];
let current = null;
let commands = false;
for (const raw of lines) {
  const line = raw.replace(/\s+$/, "");
  const trimmed = line.trim();
  if (!trimmed) continue;
  if (/^(Commands|Available commands|Examples|Environment|Files|See also):?$/.test(trimmed)) {
    commands = true;
    continue;
  }
  if (commands) continue;
  if (/^(Flags|Options|Global flags):?$/.test(trimmed)) continue;
  const flag = /^(\s*)((?:-[A-Za-z0-9?](?:,\s*)?)?--[A-Za-z0-9][\w.-]*)([\s\S]*)$/.exec(line);
  if (flag) {
    const rest = flag[3];
    let text = "";
    if (/^\s*=/.test(rest)) {
      const after = rest.replace(/^\s*=/, "");
      const aligned = after.split(/\s{2,}/);
      if (aligned.length > 1) text = aligned.slice(1).join(" ").trim();
      else if (/\s/.test(after)) text = after.trim();
      // A single token (VALUE, DATABASES,...) is a placeholder, not a description.
    } else {
      text = rest.trim();
    }
    current = { names: [flag[2]], text };
    entries.push(current);
    continue;
  }
  // A wrapped description line belongs to the option above it.
  if (current && /^\s{2,}/.test(line) && !/^[A-Z][A-Za-z ]+:/.test(trimmed)) {
    current.text = `${current.text} ${trimmed}`.trim();
  }
}

const out = [
  `.TH "${name.toUpperCase()}" "1"`,
  ".SH NAME",
  `${label(name)} \\- ${label(desc)}`,
  ...(synopsis ? [".SH SYNOPSIS", `.B ${label(synopsis)}`] : []),
  ".SH DESCRIPTION",
  body(desc),
  ".SH OPTIONS",
];
for (const entry of entries) {
  out.push(".TP", `\\fB${label(entry.names.join(", "))}\\fR`, body(entry.text));
}
process.stdout.write(`${out.join("\n")}\n`);
