import { text, definitionEntries, blockBody } from "./operands.mjs";

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
    const sentence = paragraphAt(html, m[0]) ?? "";
    if (!sentence) continue;
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
    const sentence = paragraphAt(html, m[0]) ?? "";
    if (!sentence) continue;
    for (const name of names) known.add(name);
    out.push({ names, desc: sentence });
  }
  return out;
}

// Some old-style pages have no OPTIONS section and name each flag in the
// prose instead: "If the -u option is given, it specifies the name of the
// user ...". Retain the complete paragraph that documents the flag.
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
      const sentence = text;
      if (!sentence) continue;
      known.add(name);
      out.push({ names: [name], desc: sentence });
    }
  }
  return out;
}

// mandoc renders .It Fl/.TP as a definition list, but pages written with .IP or
// .RS (git, systemd, many others) as <p>-then-indented-div. Handle both.
export function parseOptions(html) {
  // A page may name an option with a placeholder: git's "-<number>". The
  // placeholder is part of the name, and what it stands for is what the
  // page says it stands for.
  const OPTION_NAME = /(?:^|[\s,])(--?(?:[A-Za-z0-9][\w-]*|<[A-Za-z][A-Za-z0-9_-]*>)|\+[A-Za-z0-9])/g;
  const options = [];
  const push = (nameHtml, descHtml) => {
    const label = text(nameHtml).replace(/\s+/g, " ").trim();
    if (!/^[-+]/.test(label) || label.length > 160) return;
    const names = [...label.matchAll(OPTION_NAME)].map((m) => m[1]);
    if (names.length === 0) return;
    options.push({
      names: [...new Set(names)],
      usage: label,
      desc: text(descHtml).replace(/\s+/g, " ").trim(),
    });
  };

  // mdoc emits class="Bl-tag" or class="Bl-tag Bl-compact"; match every dt/dd
  // pair and let push() reject the ones that are not options.
  for (const pair of definitionEntries(html)) {
    push(pair[0], pair[1]);
  }
  for (const pair of html.matchAll(/<p class="Pp">((?:(?!<\/p>)[\s\S])*?)<\/p>\s*<div class="Bd-indent">/g)) {
    push(pair[1], blockBody(html, pair.index + pair[0].length, "div"));
  }
  // The name-then-blank-dt form (sed, timeout, watch): the option name is
  // in the paragraph above, and the description in the dd that follows an
  // empty dt.
  for (const pair of html.matchAll(/<p class="Pp HP">((?:(?!<\/p>)[\s\S])*?)<\/p>[\s\S]*?<dt><\/dt>\s*<dd[^>]*>/g)) {
    push(pair[1], blockBody(html, pair.index + pair[0].length, "dd"));
  }

  // man(7) pages (docker-style tooling) print each flag as its own paragraph.
  options.push(...flagParagraphOptions(html, new Set(options.flatMap((o) => o.names))));
  // A page may document a thing in several forms and list them.
  options.push(...alternativeFlags(html, new Set(options.flatMap((o) => o.names))));
  // A page may say that one flag is another's name.
  options.push(...synonymFlags(html, new Set(options.flatMap((o) => o.names))));
  return options;
}

function paragraphAt(html, phrase) {
  return html.split(/<\/?(?:p|div|dd|dt|h[1-6])\b[^>]*>/g)
    .map((part) => text(part)).find((p) => p.includes(phrase));
}
