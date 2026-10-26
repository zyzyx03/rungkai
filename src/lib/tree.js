// The tree-sitter tree read as the commands and the shell syntax it holds.
// The parser is only how the tree is made; this is what everything else
// uses, so the reading can be exercised without a wasm parser.
import { SYNTAX, COMPOUND, CONSTRUCTS, COMMAND_SUBSTITUTION, FUNCTION_DEFINITION, CONDITIONAL, REDIRECTION } from "./syntax.js";

const WORDS = new Set([
  "word", "number", "string", "raw_string", "ansi_c_string",
  "concatenation", "simple_expansion", "expansion",
]);

export function readTree(tree) {
  const commands = [];
  const syntax = [];

  const walk = (node) => {
    if (node.type === "command") {
      const name = node.namedChildren.find((n) => n.type === "command_name");
      if (name) {
        commands.push({
          name: name.text,
          nameSpan: [name.startIndex, name.endIndex],
          args: node.namedChildren
            .filter((n) => n !== name && WORDS.has(n.type))
            .map((n) => ({ text: n.text, span: [n.startIndex, n.endIndex] })),
        });
      }
    }
    if (node.type in COMPOUND) {
      // `select` and `until` share their node types with `for` and `while`,
      // so the head word decides which construct it is.
      const head = node.child(0)?.text ?? "";
      const construct = CONSTRUCTS[head] ?? CONSTRUCTS.for;
      // The arithmetic for loop is the second of the manual's two `for`s.
      const form = node.type === "c_style_for_statement" ? 1 : construct.form;
      syntax.push({
        text: construct.label,
        span: [node.startIndex, node.endIndex],
        section: CONDITIONAL,
        key: head,
        form,
      });
    }
    if (node.type === "test_command") {
      // The test builtin: the bracket that opens it, the operator, and the
      // word the operator takes. The bracket is a command of its own, and
      // the operator and its word are one thing.
      const open = node.child(0);
      if (open) {
        commands.push({ name: open.text, nameSpan: [open.startIndex, open.endIndex], args: [] });
      }
      const operator = node.descendantsOfType("test_operator")[0];
      if (operator) {
        syntax.push({
          text: operator.text,
          span: [operator.startIndex, operator.parent?.endIndex ?? operator.endIndex],
          section: CONDITIONAL,
          key: operator.text,
          form: 0,
        });
      }
      return;
    }
    if (node.type === "file_redirect" || node.type === "heredoc_redirect") {
      // A redirection is one thing: the descriptor, the operator and the
      // file it names. The operator is a child of its own, and is not
      // walked into, so it is not counted twice.
      const operator = node.children.find((c) => !c.isNamed && c.type !== "file_descriptor")?.type ?? "";
      syntax.push({
        text: node.text,
        span: [node.startIndex, node.endIndex],
        section: REDIRECTION,
        key: operator,
        form: 0,
      });
      return;
    }
    if (node.type === "function_definition") {
      // `name() { ... }` is a definition, not a command: report the whole
      // thing so it explains as a function rather than as loose text.
      const name = node.childForFieldName("name");
      syntax.push({
        // The card is titled by what it is, not by the bare name: a function
        // called `:` must not be titled `:` next to the `:` builtin's entry.
        text: name ? `function ${name.text}` : node.text,
        span: [node.startIndex, node.endIndex],
        section: FUNCTION_DEFINITION,
        key: "function definitions",
        form: 0,
      });
    }
    if (node.type === "command_substitution" || node.type === "process_substitution") {
      syntax.push({
        text: node.text,
        span: [node.startIndex, node.endIndex],
        section: COMMAND_SUBSTITUTION,
        key: node.type === "command_substitution" ? "command substitution" : "process substitution",
        form: 0,
      });
    }
    if (!node.isNamed && SYNTAX[node.type]) {
      syntax.push({
        text: node.text,
        span: [node.startIndex, node.endIndex],
        section: SYNTAX[node.type],
        // The manual documents the operator by its own name.
        key: node.type,
        form: 0,
      });
    }
    for (const child of node.children) walk(child);
  };

  walk(tree.rootNode);
  // An ERROR node is the grammar saying it could not read the line. The
  // commands around it may still be there, but the line as typed is not one
  // the explainer can vouch for.
  return { ok: !tree.rootNode.hasError, commands, syntax };
}
