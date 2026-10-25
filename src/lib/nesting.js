// The pieces the parser returns nest: a command substitution spans the
// commands inside it, and an operand spans the substitution inside it. They
// must never half-overlap, or the command prints itself more than once.

export function nestPieces(pieces) {
  const roots = [];
  const stack = [];
  for (const piece of pieces) {
    while (stack.length && stack[stack.length - 1].piece.end <= piece.start) stack.pop();
    const node = { piece, children: [] };
    const parent = stack.length ? stack[stack.length - 1] : null;
    (parent ? parent.children : roots).push(node);
    stack.push(node);
  }
  return roots;
}

// The command as it reads once every piece is placed: each node prints only
// the parts of the command its children do not cover.
export function commandText(cmd, roots) {
  const print = (node) => {
    let at = node.piece.start;
    let out = "";
    for (const child of node.children) {
      if (child.piece.start > at) out += cmd.slice(at, child.piece.start);
      out += print(child);
      at = Math.max(at, child.piece.end);
    }
    if (at < node.piece.end) out += cmd.slice(at, node.piece.end);
    return out;
  };
  let at = 0;
  let out = "";
  for (const root of roots) {
    if (root.piece.start > at) out += cmd.slice(at, root.piece.start);
    out += print(root);
    at = Math.max(at, root.piece.end);
  }
  if (at < cmd.length) out += cmd.slice(at, cmd.length);
  return out;
}
