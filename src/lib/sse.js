// A server-sent event line can be split across two network chunks. Keep the
// unfinished tail with the caller, and hand back only the lines that are whole.
export function completeLines(buffer, chunk) {
  const lines = (buffer + chunk).split("\n");
  return { lines, buffer: lines.pop() };
}

// Upstream completions carry the model name, its fingerprint and the usage
// block on every event. The reader only uses the words. Re-emit one minimal
// event per delta, so nothing about the backend reaches the browser.
export function deltaStream(stream) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const event = (payload) => encoder.encode(`data: ${payload}\n\n`);
  let buffer = "";
  const forward = (line, controller) => {
    if (!line.startsWith("data: ")) return;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") return controller.enqueue(event("[DONE]"));
    let piece;
    try {
      piece = JSON.parse(payload).choices?.[0]?.delta?.content;
    } catch {
      return;
    }
    if (!piece) return;
    controller.enqueue(event(JSON.stringify({ choices: [{ delta: { content: piece } }] })));
  };
  return stream.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      const next = completeLines(buffer, decoder.decode(chunk, { stream: true }));
      buffer = next.buffer;
      for (const line of next.lines) forward(line, controller);
    },
    flush(controller) {
      buffer += decoder.decode();
      if (buffer) forward(buffer, controller);
    },
  }));
}
