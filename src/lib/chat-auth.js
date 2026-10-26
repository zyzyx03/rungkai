// /api/chat is internal: only the Promptfoo harness calls it. A bearer token
// gates it so the endpoint cannot spend the model budget for anyone who finds
// the URL. Digests are compared so the token's content does not leak by timing.
export async function chatAuthorized(request, token) {
  if (!token) return "missing";
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) return "denied";
  const [given, wanted] = await Promise.all([digest(match[1]), digest(token)]);
  let difference = given.length ^ wanted.length;
  for (let i = 0; i < wanted.length; i++) difference |= (given[i] ?? 0) ^ wanted[i];
  return difference === 0 ? "ok" : "denied";
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
