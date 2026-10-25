// The shell's vocabulary: the operators the parser recognises, the compound
// commands it can name, and the sentence each one gets. The parser and the
// client share this file so a construct can never be added without a note.

export const SYNTAX = {
  "|": "Pipelines", "|&": "Pipelines",
  "&&": "Lists", "||": "Lists", ";": "Lists", "&": "Lists",
  ">": "Redirections", ">>": "Redirections", "<": "Redirections",
  "<>": "Redirections", ">|": "Redirections", "&>": "Redirections", "&>>": "Redirections",
  "<<": "Here Documents", "<<<": "Here Strings",
};

export const COMMAND_SUBSTITUTION = "Command Substitution";
export const FUNCTION_DEFINITION = "Function Definitions";
export const CONDITIONAL = "Conditional Constructs";
export const REDIRECTION = "Redirections";

// The compound commands, by the word that starts them: the manual names
// each construct by that word, and the corpus entry is found by it. The
// form says which of the manual's several versions is meant: the
// arithmetic for loop is the second one the manual gives.
export const CONSTRUCTS = {
  for: { label: "for loop", form: 0 },
  select: { label: "select loop", form: 0 },
  while: { label: "while loop", form: 0 },
  until: { label: "until loop", form: 0 },
  if: { label: "if statement", form: 0 },
  case: { label: "case statement", form: 0 },
};

// The node types that are compound commands. `select` and `until` share
// their node types with `for` and `while`, so the head word decides which
// construct it is.
export const COMPOUND = {
  for_statement: true,
  c_style_for_statement: true,
  while_statement: true,
  if_statement: true,
  case_statement: true,
};

export const SYNTAX_NOTES = {
  Pipelines: "Connects one command's standard output to the next command's standard input. Each side runs in its own process, and the exit status is the last command's.",
  Lists: "Runs commands in sequence. `&&` runs the next only if the previous succeeded; `||` runs it only if the previous failed; `;` always continues.",
  Redirections: "Points a command's file descriptors somewhere else before it runs: `>` writes a file, `<` reads one, `2>` moves standard error.",
  "Here Documents": "Feeds the following lines to a command's standard input until a delimiter line is reached.",
  "Here Strings": "Feeds one word, plus a newline, to a command's standard input.",
  [COMMAND_SUBSTITUTION]: "Runs the enclosed command and substitutes its standard output in place.",
  [FUNCTION_DEFINITION]: "Defines a function: a name bound to a compound command, which runs in a new set of positional parameters whenever the name is called.",
  [CONDITIONAL]: "Runs a list of commands under a condition, a list of words, or a choice of words.",
  // The loops each get their own sentence, keyed by the construct's title.
  "for loop": "Runs the body once for each item in a list of words: the variable takes each item in turn, and the body runs each time.",
  "until loop": "Runs the body repeatedly until the condition becomes true.",
  "while loop": "Runs the body repeatedly for as long as the condition stays true.",
  "if statement": "Runs the body only when the condition holds; elif and else add more branches.",
  "case statement": "Runs the first body whose pattern matches the word.",
  "select loop": "Asks the user to pick one of a list of words, and runs the body for the choice.",
};
