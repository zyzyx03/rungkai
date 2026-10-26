import { decode, definitionEntries } from "./operands.mjs";

// Options a page defines in its SYNOPSIS or symbolic mode, not in the option list.
// rpm(8) documents {-q|--query} and friends that way; without this, `rpm -qa`
// anchors -a and leaves -q unexplained. The synopsis line is the description:
// nothing is invented beyond what the page prints.
export function synopsisOptions(html, known) {
  const section = /<section class="Sh">\s*<h1 class="Sh" id="SYNOPSIS"[\s\S]*?(?=<section class="Sh">|$)/.exec(html)?.[0];
  if (!section) return [];

  const out = [];
  const seen = new Set();
  for (const para of section.matchAll(/<p class="Pp">([\s\S]*?)<\/p>/g)) {
    const text = plain(para[1]).replace(/\s+/g, " ").trim();
    if (!text) continue;
    for (const b of para[1].matchAll(/<b>([^<]*)<\/b>/g)) {
      const parts = b[1].split(/[|,]/).map((s) => s.trim()).filter(Boolean);
      if (!parts.length || !parts.every((n) => /^(?:-{1,2}|\+)[\w-]+$/.test(n))) continue;
      // Keep the whole {-i|--install} group, not just the unknown long name:
      // the short name is what the user types, and the mode decides its meaning.
      const names = parts.map((n) => n.split("=")[0]);
      if (names.every((n) => known.has(n) || seen.has(n))) continue;
      for (const n of names) seen.add(n);
      out.push({ names, desc: "", usage: text, gap: true, synopsis: true });
    }
  }
  // A mode such as +-=[letters] supplies the signs; each letter's definition
  // supplies its meaning. Separate entries keep addition and removal distinct.
  const mode = /(\+-)=?\s*\[([A-Za-z]+)\]/.exec(plain(html));
  if (mode) {
    const operator = plain(/<p class="Pp">The operator\b[\s\S]*?<\/p>/.exec(html)?.[0] ?? "");
    for (const [head, body] of definitionEntries(html)) {
      const letter = plain(head).trim();
      if (letter.length !== 1 || !mode[2].includes(letter)) continue;
      const label = new RegExp(`(?:^|[:,])\\s*([^,():]+)\\s*\\(${letter}\\)`).exec(plain(html))?.[1]?.trim();
      for (const sign of mode[1]) {
        const name = sign + letter;
        if (known.has(name) || seen.has(name)) continue;
        seen.add(name);
        out.push({ names: [name], desc: `${label ? `${label}. ` : ""}${operator} ${plain(body)}`.replace(/\s+/g, " ").trim() });
      }
    }
  }
  return out;
}

function plain(html) {
  // Inline markup hugs its text: `{<b>-q|--query</b>}` must read as `{-q|--query}`.
  return decode(html.replace(/<[^>]+>/g, ""));
}
