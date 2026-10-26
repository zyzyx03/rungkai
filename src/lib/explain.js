// Turns a parse plus corpus pages into the renderable Explainer.
import { matchArg, formUsed } from "./pages.js";
import { BUILTINS } from "./builtins.js";

export function explain(cmd, parsed, pages, envId) {
  const pieces = [];

  for (const command of parsed.commands) {
    const page = command.page ?? pages[command.name] ?? null;
    // The page may be a subcommand page (docker-run), so label cards by it.
    const label = page?.cmd ?? command.name;
    // A builtin has no man page of its own; bash(1) documents it. The
    // corpus may hold that page already, and then the flags it takes are
    // documented the way every other tool's are.
    const builtinPage = page?.builtin ? page : null;
    const builtin = builtinPage ? builtinPage.synopsis : (!page ? BUILTINS[command.name] : null);
    // The page may cover a command path, not just the binary: "docker run" is
    // docker-run(1). The words that make the path are the command, not its
    // arguments.
    const sub = page?.subArgs ?? 0;
    const words = [command.name];
    let end = command.nameSpan[1];
    for (let i = 0; i < sub && i < command.args.length; i++) {
      if (command.args[i].text.startsWith("-")) break;
      words.push(command.args[i].text);
      end = command.args[i].span[1];
    }
    const subWords = words.length - 1;
    // Where the parts of the command are cited: its own manual, or bash(1)
    // for a builtin, which has no manual of its own.
    const cite = builtinPage ? { url: null, env: "bash(1)", section: 1 } : { url: page?.source ?? null, env: page?.env ?? null, section: page?.section ?? 1 };
    const anchor = builtin
      ? { key: `builtin:${command.name}`, title: "bash(1) § Builtins", desc: builtin, url: null, env: "bash(1)" }
      : page
        ? { key: `cmd:${label}`, title: `${label}(${page.section ?? 1})`, desc: page.synopsis, description: page.description, options: page.options, url: cite.url, env: cite.env, section: cite.section }
        : { key: `gap:${label}`, title: label, desc: null, url: null, env: null };
    pieces.push({
      kind: builtin ? "builtin" : "tool",
      text: words.join(" "),
      start: command.nameSpan[0],
      end,
      tool: label,
      // The key is what makes two uses of the same tool share one entry.
      anchor,
      gap: !page && !builtin,
    });
    // rpm's -i is --info under -q and --install otherwise; the page defines both.
    const prefer = command.name === "rpm" ? (queryMode(command.args) ? "--info" : "--install") : undefined;
    // One card per option: -ahax repeats -a, so its second `a` stays plain text.
    const seen = new Set();
    // A page that lists '+' options (chattr's attributes) is the only kind
    // where a '+' word is a flag rather than a word.
    const plusFlags = (page?.options ?? []).some((o) => o.names.some((n) => n.startsWith("+")));
    // The option that may be waiting for its value, and the operands the
    // command takes that are not options.
    let pending = null;
    let operandAt = 0;
    let optionsEnded = false;
    const optionArgs = command.args.slice(subWords);
    for (const [at, arg] of optionArgs.entries()) {
      // A pending value consumes the next token even when it looks like a flag.
      if (pending) {
        pieces.push({
          kind: "arg",
          text: arg.text,
          start: arg.span[0],
          end: arg.span[1],
          tool: label,
          anchor: pending.anchor,
        });
        pending = null;
        continue;
      }
      if (!optionsEnded && arg.text === "--") {
        optionsEnded = true;
        continue;
      }
      const match = page && !optionsEnded ? matchArg(arg.text, page, { prefer }) : null;
      if (match?.parts) {
        let waiting = null;
        let last = null;
        for (const part of match.parts) {
          const start = arg.span[0] + match.at + part.offset;
          if (part.kind === "value") {
            // The rest of the cluster is the value of the flag before it.
            pieces.push({
              kind: "arg",
              text: part.text,
              start,
              end: start + part.text.length,
              tool: label,
              anchor: last,
            });
            // The value came with the flag, so the flag is not waiting for one.
            waiting = null;
            continue;
          }
          const key = `${command.name}:${part.names[0]}`;
          // The page may give the option in more than one form, and the
          // command says which one it used: find(1) writes "-exec command ;"
          // and "-exec command {} +", and the "+" is the second form, with
          // its own words about running the command once for all the files.
          const form = formUsed(page, part.names, optionArgs.slice(at + 1));
          const option = {
            key,
            // The page's own usage line: "-mtime n", not "-mtime".
            title: form?.usage ?? part.usage ?? part.names.join(", "),
            desc: form?.desc ?? part.desc,
            url: cite.url,
            env: cite.env,
            section: cite.section,
            value: part.value?.name ?? null,
          };
          last = option;
          if (part.value) waiting = { anchor: option };
          if (seen.has(key)) continue;
          seen.add(key);
          pieces.push({
            kind: "arg",
            text: part.text,
            start,
            end: start + part.text.length,
            tool: label,
            anchor: option,
          });
        }
        pending = waiting;
        continue;
      }
      if (match) {
        const key = `${command.name}:${match.names[0]}`;
        // The page may give the option in more than one form, and the command
        // says which one it used.
        const form = formUsed(page, match.names, optionArgs.slice(at + 1));
        const option = {
          key,
          // The page's own usage line: "-mtime n", not "-mtime".
          title: form?.usage ?? match.usage ?? match.names.join(", "),
          desc: form?.desc ?? match.desc,
          url: cite.url,
          env: cite.env,
          section: cite.section,
          value: match.value?.name ?? null,
        };
        pending = match.value ? { anchor: option } : null;
        if (seen.has(key)) continue;
        seen.add(key);
        pieces.push({
          kind: "arg",
          text: arg.text,
          start: arg.span[0],
          end: arg.span[1],
          tool: label,
          anchor: option,
        });
        continue;
      }
      // Otherwise it is an operand: what the page says the command takes.
      // A flag the page does not list is neither: it is undocumented, and it
      // must not take an operand's place. A '+' word is a flag only on a
      // page that lists '+' options (chattr's attributes); anywhere else it
      // is a word the tool takes, as date's +FORMAT is.
      if (!optionsEnded && (/^-/.test(arg.text) || (plusFlags && /^\+/.test(arg.text)))) {
        pieces.push({
          kind: "unknown",
          text: arg.text,
          start: arg.span[0],
          end: arg.span[1],
          tool: label,
          anchor: {
            key: `unknown:${label}:${arg.text}`,
            title: arg.text,
            desc: null,
            url: page?.source ?? null,
            env: page?.env ?? null,
            section: cite.section,
          },
        });
        continue;
      }
      const operands = page?.operands ?? [];
      const named = operands.find((o) => o.name === arg.text);
      const operand = named ?? operands[Math.min(operandAt, operands.length - 1)];
      if (!named) operandAt++;
      pieces.push({
        kind: "operand",
        text: arg.text,
        start: arg.span[0],
        end: arg.span[1],
        tool: label,
        // Literal absolute paths stay plain; an undocumented operand must
        // never borrow the command's prose as its own definition.
        anchor: arg.text.startsWith("/") ? null
          : { key: `op:${label}:${operand?.name ?? "?"}`, title: operand?.name ?? arg.text, desc: operand?.desc ?? null, url: cite.url, env: cite.env, section: cite.section },
      });
    }
  }

  // The shell's own syntax, as bash(1) states it: the corpus holds the
  // manual's usage line for each construct and the manual's own words for
  // it. Without that page the note in the syntax table is what is left.
  const shell = pages.bash?.syntax ?? {};
  for (const s of parsed.syntax) {
    const entry = shell[s.key]?.[s.form ?? 0];
    pieces.push({
      kind: "syntax",
      text: s.text,
      start: s.span[0],
      end: s.span[1],
      anchor: {
        key: `bash:${s.key ?? s.section}`,
        title: `bash(1) — ${entry?.section ?? s.section}`,
        desc: entry?.desc ?? null,
        url: null,
        env: "bash(1)",
      },
    });
  }

  for (const piece of pieces) {
    if (["arg", "operand"].includes(piece.kind) && piece.anchor && !piece.anchor.desc) piece.gap = true;
  }
  pieces.sort((a, b) => a.start - b.start);
  const segments = [];
  let cursor = 0;
  for (const p of pieces) {
    if (p.start > cursor) segments.push({ kind: "text", text: cmd.slice(cursor, p.start) });
    segments.push(p);
    cursor = Math.max(cursor, p.end);
  }
  if (cursor < cmd.length) segments.push({ kind: "text", text: cmd.slice(cursor) });

  // One source per page, named by the page, not by the matched flag.
  const sources = [...new Map(
    pieces.filter((p) => p.anchor?.url).map((p) => [p.anchor.url, {
      // The tool's own title carries the section it is in.
      title: p.kind === "tool" ? p.anchor.title : `${p.tool}(${p.anchor.section ?? 1})`,
      url: p.anchor.url,
      env: p.anchor.env,
    }]),
  ).values()];
  // Shell syntax and builtins are cited to bash(1), which is a source even
  // though it is not a page in the corpus.
  if (pieces.some((p) => p.anchor?.env === "bash(1)")) {
    sources.push({ title: "bash(1)", url: null, env: "bash(1)" });
  }

  const gaps = pieces.filter((p) => p.gap && p.anchor?.key.startsWith("gap:")).map((p) => p.tool);
  return { env: envId, segments, sources, gaps };
}

function queryMode(args) {
  const end = args.findIndex((arg) => arg.text === "--");
  return args.slice(0, end < 0 ? args.length : end).some((arg) =>
    arg.text.startsWith("--") ? arg.text.split("=")[0] === "--query" : /^-[a-z]*q/.test(arg.text),
  );
}
