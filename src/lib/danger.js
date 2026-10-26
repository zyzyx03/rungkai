// A deterministic floor under the model's danger line.
//
// The summary is the model's prose, and its leading DANGER line is the model's
// judgement. A model that misreads a command can call a disk wipe "none".
// These rules are literal and few, so the warning cannot be talked away; the
// model may still raise the severity above them.
const DESTRUCTIVE = [
  /\brm\b[^\n]*(?:--no-preserve-root|\s\/(?:\s|$)|\s~\/?(?:\s|$)|\s\*(?:\s|$))/,
  /\bmkfs(?:\.[a-z0-9]+)?\b/,
  /\bwipefs\b/,
  /\bshred\b/,
  /\bdd\b[^\n]*\bof=\/dev\//,
  />\s*\/dev\/(?:sd|nvme|vd|hd)/,
  /\btruncate\b[^\n]*-s\s*0\b/,
];

const RISKY = [
  /\brm\b[^\n]*\s-[a-zA-Z]*[rR]/,
  /\brm\b[^\n]*--recursive\b/,
  /\b(?:shutdown|reboot|halt|poweroff)\b/,
  /\binit\s+[06]\b/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\b[^\n]*-[a-zA-Z]*[fdx]/,
  /\bchmod\b[^\n]*\s-R\s*777\s+\//,
  /:\s*\(\s*\)\s*\{[^\n]*:\s*\|\s*:/,
  /\b(?:curl|wget)\b[^\n]*\|\s*(?:ba)?sh\b/,
];

// "destructive", "risky", or null when the command matches nothing here.
export function dangerFloor(cmd) {
  const text = String(cmd ?? "");
  if (DESTRUCTIVE.some((rule) => rule.test(text))) return "destructive";
  if (RISKY.some((rule) => rule.test(text))) return "risky";
  return null;
}

// The more serious of the two labels. "none" arrives as null; an unknown
// word ranks below both known labels.
const RANK = { destructive: 2, risky: 1 };
export const worseDanger = (a, b) => ((RANK[a] ?? 0) > (RANK[b] ?? 0) ? a : b);
