// What a command's arguments are: the value each option expects, and the
// positional operands the command takes.
//
// A man page states both, but in two places. The option list says "-i
// identity_file" — that option takes a value, and the value is called
// identity_file. The synopsis says what the command is given that is not an
// option: "ssh destination [command]", "cut [FILE]...". Explainshell keeps
// both in one place (Option.has_argument, Option.positional); this keeps them
// apart because they come from apart.

// ── the option list ────────────────────────────────────────────────

// The value an option entry expects.
//
// mdoc writes "<code class="Fl">-B</code> <var class="Ar">bind_interface</var>"
// (a space, then the value) and the man macros write "-e, --regexp=PATTERNS".
// The mdoc value may have parts: "bind_address:port" is one value in two.
export function optionArg(entry) {
  const args = [...entry.matchAll(/<var class="Ar">([^<]*)<\/var>/g)].map((m) => m[1].trim()).filter(Boolean);
  if (args.length) return args.join(":");

  // The man macros name the value in italics, but they use italics for the
  // operands too: "tar -A [OPTIONS] ARCHIVE ARCHIVE" documents -A with three
  // italic words. Only the first that is not a placeholder is the value.
  const italics = [...entry.matchAll(/<i>([^<]*)<\/i>/g)].map((m) => m[1].trim()).filter(Boolean);
  const first = italics.find((v) => !isPlaceholder(v));
  if (first) return first;

  // Or after an equals sign: "--regexp=PATTERNS". Or in plain text after the
  // flag: "-D debugopts".
  const flat = text(entry);
  const spans = flagSpans(flat);
  const cut = spans.length ? spans.at(-1).end : (flat.split(/\s+/)[0]?.length ?? 0);
  const rest = flat.slice(cut);
  const eq = /=([A-Za-z][\w./:-]*)/.exec(rest);
  if (eq) return eq[1];
  const word = /^([A-Za-z][\w./:-]*)/.exec(rest.replace(/^[=,\s[]+/, ""));
  return word ? word[1] : null;
}

// The flags an option entry names. A flag stands on its own: the "=" in
// "--regexp=PATTERNS" and the "[" in "[-e PATTERNS]" are not part of it.
export function flagsOf(entry) {
  return flagSpans(text(entry)).map((s) => s.name);
}

// The flags in a line of text, and where each one sits.
function flagSpans(flat) {
  const spans = [];
  for (const m of flat.matchAll(/--?[A-Za-z0-9][\w-]*|\+[A-Za-z0-9]/g)) {
    const before = flat[m.index - 1] ?? " ";
    if (!/[\s,]/.test(before)) continue;
    if (spans.some((s) => s.name === m[0])) continue;
    spans.push({ name: m[0], start: m.index, end: m.index + m[0].length });
  }
  return spans;
}

// The value each option takes, as { "-i": "identity_file" }.
//
// The option list is the authority for the options it documents. The synopsis
// has the same facts, and for the man macros it has the better ones, so the
// caller gives the synopsis the last word.
export function optionValues(html, known = new Set()) {
  const values = {};
  // A definition list is an option list wherever it sits; a paragraph is one
  // only in the sections that hold them.
  const entries = [
    ...[...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>/g)].map((m) => m[1]),
    ...sections(html, ["OPTIONS", "DESCRIPTION"]).flatMap((s) => [...s.matchAll(/<p class="Pp">([\s\S]*?)<\/p>/g)].map((m) => m[1])),
  ];
  for (const entry of entries) {
    // An entry's name and value come before its description.
    const head = entry.split(/<br\s*\/?>|\t/)[0];
    const flat = text(head);
    let flags = flagsOf(head);
    if (flags.length) {
      // An entry names its option first; prose that mentions a flag in passing
      // does not, and its italics are not the flag's value.
      if (!/^(--?[A-Za-z0-9][\w-]*|\+[A-Za-z0-9])/.test(flat)) continue;
    } else {
      // Some pages write the option without its dash: "name pattern".
      const dashed = `-${flat.split(/\s+/)[0] ?? ""}`;
      if (!known.has(dashed)) continue;
      flags = [dashed];
    }
    const arg = optionArg(head);
    if (!arg) continue;
    for (const flag of flags) {
      if (!(flag in values)) values[flag] = arg;
    }
  }
  return values;
}

// The body of each named section of a page.
function sections(html, ids) {
  return ids.map((id) => new RegExp(`<h1[^>]*id="${id}"[^>]*>[\\s\\S]*?</h1>([\\s\\S]*?)(?=<h1[^>]*id=|$)`).exec(html)?.[1] ?? "");
}

// ── the synopsis ───────────────────────────────────────────────────

// The synopsis of a page, as html. The headings inside it name the usage
// styles ("Traditional usage") and are not part of the usage.
function synopsisHtml(html) {
  const m = /<h1[^>]*id="SYNOPSIS"[^>]*>[\s\S]*?<\/h1>([\s\S]*?)(?=<h1[^>]*id=|$)/.exec(html);
  if (!m) return "";
  return m[1].replace(/<h[23][^>]*>[\s\S]*?<\/h[23]>/g, " ");
}

// The placeholders that stand for "any options" rather than for a value.
const PLACEHOLDERS = new Set(["OPTION", "OPTIONS", "ARG", "ARGS", "ARGUMENT", "ARGUMENTS"]);

function isPlaceholder(name) {
  return PLACEHOLDERS.has(String(name).toUpperCase());
}

// The synopsis, as lines of items: the flags, the words and the brackets that
// group them.
function lines(html) {
  const out = [];
  for (const line of synopsisHtml(html).split(/<\/p>|<br\s*\/?>|<\/td>|<\/tr>/)) {
    const items = [];
    let mark = null;
    for (const m of line.matchAll(/<[^>]+>|[^<]+/g)) {
      const s = m[0];
      if (s[0] === "<") {
        mark = s === '<code class="Fl">' ? "flag"
          : s === '<code class="Nm">' ? "name"
          : s === '<var class="Ar">' ? "value"
          : s === "<b>" ? "bold"
          : s === "<i>" ? "value"
          : null;
        continue;
      }
      const words = text(s);
      if (!words) continue;
      items.push(...runItems(words, mark));
      mark = null;
    }
    if (items.length) out.push(items);
  }
  return out;
}

// One run of text, as items. How a word is read depends on the markup it
// carries: an mdoc flag is a flag, an mdoc argument is a value, and a bold
// word is a flag if it starts with a dash and the command's own name if it
// does not.
function runItems(words, mark) {
  if (mark === "name") return []; // the command's own name
  if (mark === "flag") return [{ kind: "flag", text: words, cluster: isCluster(words) }];
  if (mark === "bold") {
    // A bold run may hold the command's name and its whole usage:
    // "docker builder build [OPTIONS] PATH | URL | -".
    const out = [];
    for (const part of words.split(/([\[\]{}()|=])/)) {
      const word = part.trim();
      if (!word) continue;
      if (word === "[" || word === "(" || word === "{") out.push({ kind: "open" });
      else if (word === "]" || word === ")" || word === "}") out.push({ kind: "close" });
      else if (word === "|" || word === "=") out.push({ kind: "alt" });
      else if (/^[-+]/.test(word)) out.push({ kind: "flag", text: word, cluster: isCluster(word) });
      else out.push({ kind: "boldword", text: word });
    }
    return out;
  }
  if (mark === "value") {
    // "SOURCE DEST" is two operands; "-t DIRECTORY SOURCE" is a flag and two.
    return words.split(/\s+/).map((w) => (w.startsWith("-")
      ? { kind: "flag", text: w, cluster: false }
      : { kind: "word", text: w, markup: true }));
  }
  // Plain text: the brackets group, everything else is a word.
  const out = [];
  for (const part of words.split(/([\[\]{}()|=])/)) {
    const word = part.trim();
    if (!word) continue;
    if (word === "[" || word === "(" || word === "{") out.push({ kind: "open" });
    else if (word === "]" || word === ")" || word === "}") out.push({ kind: "close" });
    else if (word === "|" || word === "=") out.push({ kind: "alt" });
    else if (/^[-+]/.test(word)) out.push({ kind: "flag", text: word, cluster: isCluster(word) });
    else out.push({ kind: "word", text: word });
  }
  return out;
}

// A run of letters after one dash is a bundle of flags, not one flag.
function isCluster(text) {
  if (text.startsWith("--") || text.startsWith("+")) return false;
  return text.length > 2;
}

// The facts a synopsis states: the value each flag takes, the flags it shows,
// and the positional operands the command takes, in the order it names them.
export function synopsisFacts(html, tool = "") {
  const values = {};
  const operands = [];
  const shown = new Set();
  // The command's own name, as the page writes it: "docker builder build".
  const nameWords = tool ? tool.split("-") : [];

  for (const line of lines(html)) {
    // Each group of brackets holds the flags seen inside it and the words
    // bound to them; the first group is the line itself.
    const stack = [{ flags: [], words: [] }];
    let pending = null;
    // How much of the command's name the line has said so far.
    let nameAt = 0;

    for (const item of line) {
      // The command's own name opens the line and is not an operand.
      if ((item.kind === "word" || item.kind === "boldword") && item.text === nameWords[nameAt]) {
        nameAt += 1;
        continue;
      }
      if (item.kind === "open") {
        stack.push({ flags: [], words: [] });
        if (pending) pending.barrier = true;
        continue;
      }
      if (item.kind === "close") {
        const group = stack.length > 1 ? stack.pop() : stack[0];
        flush(group, values);
        if (pending && pending.group === group) pending = null;
        if (pending) pending.barrier = true;
        continue;
      }
      if (item.kind === "alt") continue;
      if (item.kind === "flag") {
        const group = stack.at(-1);
        group.flags.push(item.text);
        shown.add(item.text);
        pending = item.cluster ? null : { group, depth: stack.length, barrier: false };
        continue;
      }
      if (item.kind === "boldword" && stack.length > 1) {
        // A bold letter inside a group is a flag written without a dash
        // (tar's {A|c|d}).
        const group = stack.at(-1);
        group.flags.push(item.text);
        shown.add(item.text);
        pending = null;
        continue;
      }

      // A word belongs to the flag before it when it stands in the group that
      // holds the flag; a flag outside any group only takes the word that
      // follows it, with no group in between.
      const name = clean(item.text);
      // Punctuation is neither value nor operand, unless the page marked it
      // as the value: docker writes an unnamed value as "[]".
      if (!/[A-Za-z]/.test(name) && !item.markup) continue;
      const binds = pending
        && (pending.depth > 1 ? stack.length >= pending.depth : stack.length === 1 && !pending.barrier);
      if (binds) {
        pending.group.words.push(name);
        // A flag outside any group takes one word; inside a group it takes
        // them all, as ssh's "-D [bind_address:]port" takes two.
        if (pending.depth === 1) pending = null;
        continue;
      }
      if (!name || isPlaceholder(name)) continue;
      // A capitalised word that is not a name in capitals is a note, not an
      // operand: "Experimental", "Linux".
      if (/^[A-Z][a-z]/.test(name)) continue;
      // A compound word is a form of an operand, not an operand: rsync's
      // "[USER@]HOST:SRC" says SRC, and the page names it plain elsewhere.
      // A '+' is a sign, not a word: date's "+FORMAT" is the format it takes.
      // An '=' is a pair: env's "NAME=VALUE" is the assignment it takes.
      const plain = name.replace(/^\[+/, "").replace(/\]+$/, "").replace(/^\+/, "");
      if (!/^[A-Za-z][A-Za-z0-9_=-]*$/.test(plain)) continue;
      if (!operands.includes(plain)) operands.push(plain);
    }
    flush(stack[0], values);
  }
  return { values, operands, shown: [...shown] };
}

// The value a group of flags took, as the page words it.
function flush(group, values) {
  if (!group.words.length) return;
  const name = group.words.join(":");
  for (const flag of group.flags) if (!(flag in values)) values[flag] = name;
}

// A word as the man page means it: "FILE..." is FILE, "bind_address:" is
// bind_address.
function clean(word) {
  return String(word)
    .trim()
    .replace(/\.\.\.$/, "")
    .replace(/:$/, "")
    .trim();
}

// ── descriptions ───────────────────────────────────────────────────

// The description of each operand: the man page's own words for it. The
// DESCRIPTION section names the operands, so the paragraph that mentions one
// is that operand's description.
export function operandDocs(html, names) {
  const docs = {};
  if (!names.length) return docs;
  const section = /<h1[^>]*id="DESCRIPTION"[^>]*>[\s\S]*?<\/h1>([\s\S]*?)(?=<h1[^>]*id=|$)/.exec(html)?.[1] ?? "";
  const paragraphs = [...section.matchAll(/<p class="Pp">([\s\S]*?)<\/p>/g)].map((m) => text(m[1]));
  for (const name of names) {
    const exact = new RegExp(`\\b${escapeRe(name)}\\b`);
    const plural = new RegExp(`\\b${escapeRe(name)}(?:s|es)?\\b`);
    const loose = new RegExp(`\\b${escapeRe(name)}\\b`, "i");
    const hit = paragraphs.find((p) => exact.test(p))
      ?? paragraphs.find((p) => plural.test(p))
      ?? paragraphs.find((p) => loose.test(p));
    if (hit) docs[name] = hit.slice(0, 600);
  }
  return docs;
}

export function text(html) {
  return String(html)
    // An emphasis tag inside a word does not break the word: mandoc writes a
    // short flag as "-<b>b</b>", and a space there loses the flag.
    .replace(/<\/?(?:b|i|em|strong|code|var|span)\b[^>]*>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
