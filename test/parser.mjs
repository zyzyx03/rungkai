// The parser, in Node.
//
// The worker's copy imports the wasm modules as ES modules, which Node
// cannot load. The test loads the same two modules from disk and hands the
// tree to the same reader, so what is tested is the code that runs.
import { readFileSync } from "node:fs";
import { readTree } from "../src/lib/tree.js";

const root = new URL("../node_modules/", import.meta.url);
const runtime = new WebAssembly.Module(readFileSync(new URL("web-tree-sitter/web-tree-sitter.wasm", root)));
const bash = new WebAssembly.Module(readFileSync(new URL("tree-sitter-bash/tree-sitter-bash.wasm", root)));

const { Parser, Language } = await import("web-tree-sitter");
// The Emscripten factory takes the Node path whenever `process` exists, and
// then looks for its own files where Node keeps them. Hide process for the
// call, and put it back.
const saved = globalThis.process;
globalThis.process = undefined;
await Parser.init({
  instantiateWasm(imports, done) {
    const instance = new WebAssembly.Instance(runtime, imports);
    done(instance, runtime);
    return instance.exports;
  },
});
globalThis.process = saved;

const parser = new Parser();
parser.setLanguage(Language.loadSync(bash));

export function parse(cmd) {
  return readTree(parser.parse(cmd));
}
