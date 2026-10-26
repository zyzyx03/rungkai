// What may be sent to the explainer.
//
// A command is a line: short enough to be a one-liner, and carrying nothing
// that would make the page show a command other than the one the shell runs.
//
// The limit comes from real use. Of ten thousand commands typed over years,
// the median was 5 characters, the 99th percentile 243, and the longest ever
// typed 746. 1024 refuses none of them, and still bounds what one request
// can cost.
//
// The characters refused are the invisible ones: a control character, a
// zero-width space, or a bidi override that makes a line read backwards while
// running forwards. A shell metacharacter is the whole point of a one-liner
// and is left alone, as is a UTF-8 filename.
//
// Nothing is stripped. A command is either explained exactly as it was typed
// or refused: a command quietly changed on its way in is a command the reader
// cannot trust.

import { ENVIRONMENTS } from "./envs.js";

export const MAX_CMD = 1024;
// A conversation is a handful of questions about one command.
export const MAX_MESSAGES = 24;
export const MAX_MESSAGE = 4096;
// The body of a request: a command, or a conversation about one.
export const MAX_BODY = 256 * 1024;

const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

// The problem with a string, or null when there is none.
export function checkText(text, max = MAX_CMD) {
  if (typeof text !== "string") return "it is not text";
  if (!text) return "it is empty";
  if (text.length > max) return `it is ${text.length} characters; the limit is ${max}`;
  const invisible = INVISIBLE.exec(text);
  // The character is named, not shown: a message that carried it would be
  // read the way it makes the page read.
  if (invisible) {
    const code = invisible[0].codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
    return `it contains a character the page cannot show as typed (U+${code})`;
  }
  return null;
}

// A body that says it is enormous is refused before it is read.
export function checkBody(request, max = MAX_BODY) {
  const length = Number(request.headers?.get("content-length") ?? 0);
  if (length > max) return `the body is ${length} bytes; the limit is ${max}`;
  return null;
}

// The body of a request, read only if it is small enough to be one: an
// environment is a name, a body that is not JSON is a mistake, not a crash.
export async function readBody(request) {
  const tooBig = checkBody(request);
  if (tooBig) return { error: `bad request: ${tooBig}` };
  let raw;
  try {
    raw = await readText(request, MAX_BODY);
  } catch (error) {
    return { error: `bad request: ${error.message}` };
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return { error: "bad request: the body is not JSON" };
  }
  if (!body || typeof body !== "object") return { error: "bad request: the body is not an object" };
  const env = body.env ?? "all";
  const problem = checkText(env);
  if (problem) return { error: `bad environment: ${problem}` };
  // A name that resolves to nothing would become a cache key and a search
  // path that answers with gaps, so only the registry names are accepted.
  if (!ENVIRONMENTS.some((entry) => entry.id === env)) {
    return { error: `bad environment: it is not one of ${ENVIRONMENTS.map((entry) => entry.id).join(", ")}` };
  }
  return { body, env };
}

// The body, streamed and counted. The length header is a claim; this is the
// limit, and it holds when the claim is missing or false.
async function readText(request, max) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      throw new Error(`the body is over ${max} bytes`);
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
