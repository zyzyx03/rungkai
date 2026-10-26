// The cache key for a command: a hash of it, not the command.
//
// Two reasons. A key long enough to hold the command is refused by the
// cache, so a long command would never be answered from it. And a pasted
// secret has no business sitting in the edge cache under its own name.
//
// This is not secrecy. There is no key, nothing is encrypted, and the
// answer that gets cached still contains the command — the corpus is public
// and so is the explanation. What the hash buys is a short, stable name for
// the command, and one that nobody can aim: a collision between two
// different commands would serve one of them the other's answer, so the
// whole 256-bit digest is the name. It is short enough for a cache key.
export async function commandHash(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
