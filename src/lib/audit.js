// Security audit for the model endpoints.
//
// The site promises that nothing is stored, so only an input that looks like
// an attempt to steer the model is written to Workers Logs: a truncated
// excerpt, a hashed IP, the route and the time. Ordinary searches never are.
const RULES = [
  ["override-previous", /\b(?:ignore|disregard|forget)\b[\s\S]{0,50}\b(?:instructions?|prompts?|rules|directions)\b/i],
  ["prompt-extraction", /\b(?:reveal|print|show|repeat|leak|output|tell me)\b[\s\S]{0,40}\b(?:system|developer|hidden|initial)\s+(?:prompt|message|instructions?)\b/i],
  ["role-change", /\b(?:you are now|act as|pretend to be|from now on you|roleplay as)\b/i],
  ["jailbreak", /\b(?:jailbreak|DAN mode|developer mode|unrestricted (?:mode|assistant|shell))\b/i],
  ["bypass", /\b(?:bypass|override|disable)\b[\s\S]{0,30}\b(?:safety|guardrails?|filters?|rules|instructions?)\b/i],
  ["encoded-payload", /\b(?:base64|rot13|hex decode|decode (?:this|the following))\b/i],
  ["encoded-blob", /[A-Za-z0-9+/]{80,}={0,2}/],
];

export function looksLikeInjection(text) {
  const value = String(text ?? "");
  if (!value) return null;
  for (const [reason, pattern] of RULES) if (pattern.test(value)) return reason;
  return null;
}

const MAX_EXCERPT = 500;

export async function audit(c, route, kind, text = "", envId = "") {
  let ip = "";
  try {
    // A salted hash, not the address: the log is for correlating attempts,
    // not for keeping a visitor list. Rotating CHAT_TOKEN rotates the hashes.
    const salt = c.env.CHAT_TOKEN ?? "rungkai-audit";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(salt),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(c.req.header("cf-connecting-ip") ?? "anon")));
    ip = [...signature.slice(0, 8)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch (error) {
    console.error("the audit address could not be hashed:", error);
  }
  console.log(
    JSON.stringify({
      audit: "security",
      kind,
      route,
      env: envId || undefined,
      excerpt: String(text ?? "").slice(0, MAX_EXCERPT),
      ip,
      ua: (c.req.header("user-agent") ?? "").slice(0, 120),
      at: new Date().toISOString(),
    }),
  );
}
