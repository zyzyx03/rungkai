// A command that runs another command: sudo runs ss, find -exec runs rm.
//
// The corpus says so, so the split comes from the page and not from a list
// kept here: a wrapper's operand is named "command", and an option that
// takes a value named "command" is followed by one.
import { matchArg, matchValue } from "./pages.js";

// The names a page gives the command it runs.
const COMMAND = /^(command|program)$/i;
// The names a page gives a value that is itself a program: find's -exec
// takes a command, python3's -m takes a module.
const PROGRAM = /^(command|program|module)/i;

// Where a command's arguments split: the ones the command itself takes, and
// the command it runs in turn. There may be more than one way to read it —
// env takes an assignment before the command — so the candidates are all of
// them, and the corpus decides which is a tool.
export function splitCommand(page, args) {
  if (!page) return [];
  const from = page.subArgs ?? 0;
  const end = args.findIndex((arg, i) => i >= from && arg.text === "--");

  // An option that takes a command: the word after it is the command.
  for (const [flag, value] of Object.entries(page.values ?? {})) {
    if (!PROGRAM.test(String(value).split(":")[0])) continue;
    const at = args.findIndex((arg, i) => i >= from && (end < 0 || i < end) && (arg.text === flag || arg.text.split("=")[0] === flag));
    if (at < 0 || at + 1 >= args.length) continue;
    // A command-taking action may delimit its arguments in its documented
    // usage. The terminator belongs to the action, not the nested program.
    const terminators = (page.options ?? []).filter((o) => o.names.includes(flag))
      .map((o) => o.usage?.split(/\s+/).at(-1)).filter((word) => word === ";" || word === "+");
    const stop = args.findIndex((arg, i) => i > at + 1 && terminators.includes(arg.text.replace(/^\\/, "")));
    return [{
      head: stop < 0 ? args.slice(0, at + 1) : [...args.slice(0, at + 1), ...args.slice(stop)],
      nested: { name: args[at + 1].text, span: args[at + 1].span, args: args.slice(at + 2, stop < 0 ? undefined : stop) },
    }];
  }

  // A wrapper: the command is the operand the page names "command". The page
  // says which word that is — the operand's own place in the list — and a
  // word there that the corpus has no page for is the wrapper's own operand,
  // not a program: systemctl's COMMAND is a subcommand of systemctl.
  const at = (page.operands ?? []).findIndex((o) => COMMAND.test(o.name));
  if (at < 0) return [];
  const word = positionals(args, page)[at];
  if (!word) return [];
  const i = args.indexOf(word);
  return [{
    head: args.slice(0, i),
    nested: { name: word.text, span: word.span, args: args.slice(i + 1) },
  }];
}

// The commands a one-liner runs: the ones the parse found, and the ones
// they run in turn. `pageFor` gives the page for a command, and may be
// async; the pages it hands back are collected in `pages`.
export async function resolveCommands(parsed, pageFor, pages = {}) {
  // The shell's own syntax is documented in bash(1), so the page that
  // documents it is needed whenever a command has any.
  if (parsed.syntax?.length && !("bash" in pages)) {
    pages.bash = await pageFor("bash", []);
  }
  const commands = [];
  for (const command of parsed.commands) {
    const page = await pageFor(command.name, command.args);
    commands.push(...(await expand(command, page, pageFor, pages)));
  }
  return commands;
}

async function expand(command, page, pageFor, pages) {
  pages[command.name] = page;
  for (const candidate of splitCommand(page, command.args)) {
    const nestedPage = await pageFor(candidate.nested.name, candidate.nested.args);
    // The corpus has no page for the command it runs, so it is not a tool of
    // its own here: it stays the wrapper's own operand, which is what the
    // page says the wrapper takes.
    if (!nestedPage) continue;
    const inner = await expand(
      { name: candidate.nested.name, nameSpan: candidate.nested.span, args: candidate.nested.args },
      nestedPage,
      pageFor,
      pages,
    );
    return [{ ...command, page, args: candidate.head }, ...inner];
  }
  return [{ ...command, page }];
}

// The arguments that are not options and not an option's value: the words
// the page calls operands.
function positionals(args, page) {
  const out = [];
  let pending = false;
  let optionsEnded = false;
  for (const arg of args.slice(page.subArgs ?? 0)) {
    if (pending) {
      pending = false;
      continue;
    }
    if (!optionsEnded && arg.text === "--") {
      optionsEnded = true;
      continue;
    }
    const match = optionsEnded ? null : matchArg(arg.text, page);
    if (match) {
      pending = Boolean(matchValue(match));
      continue;
    }
    if (!optionsEnded && /^[-+]/.test(arg.text)) continue;
    out.push(arg);
  }
  return out;
}
