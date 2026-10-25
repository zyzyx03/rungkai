// Matching an argument token to a man-page option entry.
export function matchArg(text, page, { prefer } = {}) {
  const arg = text;
  if (arg === "--") return null;
  const opts = page?.options ?? [];
  // A few tools take their options as a cluster with no leading dash — tar's
  // `zcf` — and the page says so itself, so only those pages allow it. The
  // token must be a bare run of letters: a quoted string is a string.
  const cluster = !arg.startsWith("-") && !arg.startsWith("+")
    && Boolean(page?.cluster) && /^[A-Za-z]{2,}$/.test(text);
  if (!arg.startsWith("-") && !arg.startsWith("+") && !cluster) return null;
  const at = 0;

  // A short flag can be defined twice (rpm's -i is --info and --install).
  // `prefer` names the long form the command's mode implies. A page may also
  // list a flag twice, once with its description and once without: the one
  // that says something wins.
  const find = (name) => {
    const hits = opts.filter((o) => o.names.includes(name) || o.names.some((n) => placeholder(n, name)));
    return (prefer && hits.find((o) => o.names.includes(prefer)))
      || hits.find((o) => o.desc)
      || hits[0];
  };

  if (arg.startsWith("--")) {
    const name = arg.split("=")[0];
    const hit = find(name);
    return hit ? { names: hit.names, desc: hit.desc, at, value: valueOf(page, hit.names) } : null;
  }

  const whole = find(arg);
  if (whole) return { names: whole.names, desc: whole.desc, at, value: valueOf(page, whole.names) };

  // A bundle is a run of short flags, and only a dash can start one: date's
  // "+%Y-%m-%d" is a format, not the -d option with a prefix. A page that
  // documents a dashless bundle (tar's zcf) is the exception.
  if (!arg.startsWith("-") && !cluster) return null;

  // Bundled short flags: -zcf means -z -c -f. One part per letter, so each
  // option carries its own card rather than one wall of merged descriptions.
  if (arg.length < (cluster ? 2 : 3)) return null;
  const parts = [];
  let offset = 0;
  let missing = false;
  const letters = [...(cluster ? arg : arg.slice(1))];
  for (const [i, c] of letters.entries()) {
    const name = `-${c}`;
    const part = i === 0 && !cluster ? `-${c}` : c;
    const hit = find(name);
    if (hit) {
      parts.push({ text: part, offset, name, names: hit.names, desc: hit.desc, value: valueOf(page, hit.names) });
    } else if (parts.at(-1)?.value) {
      // The rest of the cluster is the value of the flag before it: "-f1".
      const rest = arg.slice(offset);
      parts.push({ kind: "value", text: rest, offset, names: parts.at(-1).names, value: parts.at(-1).value });
      offset = arg.length;
      break;
    }
    // A dashless cluster is all or nothing: one letter that is not an option
    // means the word is a word, not a cluster.
    else if (cluster) missing = true;
    offset += part.length;
  }
  if (missing) return null;
  return parts.length ? { at, parts } : null;
}

// The value an option takes, as the page names it: "-i" takes an
// identity_file. Null when the option takes no value.
function valueOf(page, names) {
  const values = page?.values ?? {};
  for (const name of names) {
    if (name in values) return { name: values[name] };
  }
  return null;
}

// A page may name an option with a placeholder: git's "-<number>". What the
// placeholder stands for is what the page says it stands for, so a number
// placeholder takes digits and any other takes a word.
function placeholder(pattern, name) {
  const m = /^(-*)<([A-Za-z][A-Za-z0-9_-]*)>(.*)$/.exec(pattern);
  if (!m) return false;
  const [, dashes, kind, rest] = m;
  if (!name.startsWith(dashes) || !name.endsWith(rest)) return false;
  const mid = name.slice(dashes.length, name.length - rest.length);
  if (!mid || mid.startsWith("-")) return false;
  return /^(num|number|count|integer|size)$/i.test(kind) ? /^\d+$/.test(mid) : /^\S+$/.test(mid);
}

// The value a match expects as the next argument. A value written attached
// to its flag (-f1) is part of the match, not the next argument.
export function matchValue(match) {
  if (!match) return null;
  if (match.parts) {
    const last = match.parts.at(-1);
    return last && last.kind !== "value" ? last.value ?? null : null;
  }
  return match.value ?? null;
}

