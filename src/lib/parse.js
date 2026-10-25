// The only file that knows about tree-sitter. Swap the seam, keep the shape.
import { Parser, Language } from "web-tree-sitter";
import runtimeWasm from "web-tree-sitter/web-tree-sitter.wasm";
import bashWasm from "tree-sitter-bash/tree-sitter-bash.wasm";
import { readTree } from "./tree.js";

// No top-level await: workerd refuses module startup that waits on a promise.
// The Emscripten factory takes the Node path whenever `process` exists (Workers
// expose it with nodejs_compat) and then calls createRequire(import.meta.url),
// which has no URL here; hide process for that call.
let ready;
let parser;
function init() {
  ready ??= (async () => {
    const saved = globalThis.process;
    globalThis.process = undefined;
    try {
      // Workers forbid compiling wasm at runtime, so hand Emscripten the module
      // wrangler precompiled; this also skips its file/URL lookup entirely.
      await Parser.init({
        instantiateWasm(imports, done) {
          const instance = new WebAssembly.Instance(runtimeWasm, imports);
          done(instance, runtimeWasm);
          return instance.exports;
        },
      });
    } finally {
      globalThis.process = saved;
    }
    parser = new Parser();
    parser.setLanguage(Language.loadSync(bashWasm));
  })();
  return ready;
}

export async function parseOneLiner(cmd) {
  await init();
  let tree;
  try {
    tree = parser.parse(cmd);
  } catch {
    return { ok: false, commands: [], syntax: [] };
  }
  const parsed = readTree(tree);
  tree.delete();
  return parsed;
}
