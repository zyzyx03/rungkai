// The text a page offers retrieval: its own prose, and one entry per
// documented option or operand. Short chunks retrieve precisely — a question
// about one flag should not have to out-rank the whole page to be found. The
// cap keeps pathological pages (gcc names 3,274 options) from becoming a
// multi-megabyte document; retrieve() still injects a flag the reader names.
const MAX_CHARS = 800;
export const MAX_CHUNKS = 128;

export function chunksOf(page) {
  const out = [];
  const add = (text) => {
    const clean = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
    if (clean && !out.includes(clean)) out.push(clean);
  };

  if (page.synopsis) add(page.synopsis);
  // The description is prose: cut it at a sentence end so a chunk is a
  // thought rather than an arbitrary slice.
  const prose = String(page.description ?? "");
  for (let at = 0; at < prose.length && out.length < 6; ) {
    let end = Math.min(prose.length, at + MAX_CHARS);
    if (end < prose.length) {
      const stop = Math.max(prose.lastIndexOf(". ", end), prose.lastIndexOf("; ", end));
      if (stop > at + MAX_CHARS / 2) end = stop + 1;
    }
    add(prose.slice(at, end));
    at = end;
  }

  // What the page documents, nearest thing first: the flags it names, then
  // the operands.
  for (const option of page.options ?? []) {
    if (out.length >= MAX_CHUNKS) break;
    if (option.desc) add(`${(option.names ?? []).join(", ")}: ${option.desc}`);
  }
  for (const operand of page.operands ?? []) {
    if (out.length >= MAX_CHUNKS) break;
    if (operand.desc) add(`${operand.name}: ${operand.desc}`);
  }
  return out.slice(0, MAX_CHUNKS);
}
