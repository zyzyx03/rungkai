// A server-sent event line can be split across two network chunks. Keep the
// unfinished tail with the caller, and hand back only the lines that are whole.
export function completeLines(buffer, chunk) {
  const lines = (buffer + chunk).split("\n");
  return { lines, buffer: lines.pop() };
}
