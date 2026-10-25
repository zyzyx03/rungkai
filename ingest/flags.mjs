// man(7) pages (docker-style tooling) print each flag as its own paragraph:
//   <b>-f</b>, <b>--file</b> <i>PATH</i> <br/> description
// or with a literal tab before the description. mdoc pages use <dt>/<dd> and
// never reach this path.
export function flagParagraphOptions(html, known) {
  const section = /<section class="Sh">\s*<h1[^>]*id="OPTIONS"[^>]*>[\s\S]*?(?=<section class="Sh">|$)/.exec(html)?.[0];
  if (!section) return [];

  const out = [];
  for (const para of section.matchAll(/<p class="Pp">([\s\S]*?)<\/p>/g)) {
    const text = decode(para[1].replace(/<br\s*\/?>/gi, "\t").replace(/<[^>]+>/g, ""));
    const tab = text.indexOf("\t");
    if (tab < 0) continue;
    const names = [...text.slice(0, tab).matchAll(/(?:^|,\s*)(-{1,2}[A-Za-z0-9][\w-]*)/g)]
      .map((m) => m[1])
      .filter((n) => !known.has(n));
    if (!names.length) continue;
    const desc = text.slice(tab + 1).replace(/\s+/g, " ").trim();
    if (!desc) continue;
    for (const n of names) known.add(n);
    out.push({ names: [...new Set(names)], desc });
  }
  return out;
}

function decode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// The body of a section of a page, as plain text. A section's words may sit
// in a paragraph or in an indented block, and the page means the same either
// way.
function sectionText(html, id) {
  const section = new RegExp(`<h1[^>]*id="${id}"[^>]*>([\\s\\S]*?)(?=<h1[^>]*id=|$)`).exec(html)?.[1];
  if (!section) return "";
  return decode(section.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// A page may document a thing in several forms and list them: kill's signals
// are given "-9, -SIGKILL or -KILL". The list is the documentation, so the
// flags in it are options the page names.
export function alternativeFlags(html, known) {
  const text = sectionText(html, "DESCRIPTION");
  if (!text) return [];

  const out = [];
  // The list is introduced by the words "way" or "form".
  for (const m of text.matchAll(/\b(?:ways?|forms?)\b[^.;]{0,60}?(-[A-Za-z0-9]+)((?:\s*,\s*|\s+or\s+|\s+and\s+)(?:-[A-Za-z0-9]+)+)/g)) {
    const names = [m[1], ...m[2].match(/-[A-Za-z0-9]+/g)].filter((n) => !known.has(n));
    if (names.length < 2) continue;
    const sentence = firstSentence(text, m.index ?? 0);
    if (!sentence || sentence.length > 300) continue;
    for (const name of names) known.add(name);
    out.push({ names, desc: sentence });
  }
  return out;
}

// A page may say that one flag is another's name: git-diff's "--staged is a
// synonym of --cached". The page documents both, so both are options.
export function synonymFlags(html, known) {
  const text = sectionText(html, "DESCRIPTION");
  if (!text) return [];

  const out = [];
  for (const m of text.matchAll(/(-{1,2}[A-Za-z][A-Za-z0-9-]*)\s+(?:is|are)\s+(?:an?\s+)?(?:synonym|alias)(?:\s+of|\s+for)\s+(-{1,2}[A-Za-z][A-Za-z0-9-]*)/g)) {
    const names = [m[1], m[2]].filter((n) => !known.has(n));
    if (!names.length) continue;
    const sentence = firstSentence(text, m.index ?? 0);
    if (!sentence || sentence.length > 300) continue;
    for (const name of names) known.add(name);
    out.push({ names, desc: sentence });
  }
  return out;
}

// Some old-style pages have no OPTIONS section and name each flag in the
// prose instead: "If the -u option is given, it specifies the name of the
// user ...". The sentence that names the flag is its description, so take
// that sentence rather than the whole paragraph.
export function proseOptions(html, known) {
  const section = /<section class="Sh">\s*<h1[^>]*id="DESCRIPTION"[^>]*>[\s\S]*?(?=<section class="Sh">|$)/.exec(html)?.[0];
  if (!section) return [];

  const out = [];
  for (const para of section.matchAll(/<p class="Pp">([\s\S]*?)<\/p>/g)) {
    const text = decode(para[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (!text) continue;
    for (const m of text.matchAll(/(?:^|[.;]?\s)(?:If\s+the\s+|The\s+|Using\s+)?(-{1,2}[A-Za-z0-9][\w-]*)\s+(?:option|flag)\b/g)) {
      const name = m[1];
      if (known.has(name)) continue;
      const sentence = firstSentence(text, m.index ?? 0);
      if (!sentence || sentence.length > 300) continue;
      known.add(name);
      out.push({ names: [name], desc: sentence });
    }
  }
  return out;
}

// The sentence around a point: from the last stop before it to the first
// full stop after it.
function firstSentence(text, at) {
  const before = text.slice(0, at);
  const start = Math.max(before.lastIndexOf(". "), before.lastIndexOf("; ")) + 1;
  const after = text.slice(at);
  const stop = after.search(/\.\s/);
  const end = stop < 0 ? text.length : at + stop + 1;
  return text.slice(start, end).replace(/^[,\s]+/, "").trim();
}
