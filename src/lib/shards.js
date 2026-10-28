// Large man pages are option-heavy (gcc has 3,274). The explain path only
// needs the flags a command uses, so split those pages into small lite shards
// and load the shards named by the command's flags.
export const SHARD_AT_OPTIONS = 200;
export const SHARD_AT_BYTES = 100 * 1024;
export const SHARD_SIZE = 128;

export function shardPage(page, size = 0) {
  const options = page.options ?? [];
  if (options.length <= SHARD_AT_OPTIONS && size <= SHARD_AT_BYTES) return { main: page, shards: [] };
  const shards = [];
  const byName = {};
  for (let at = 0; at < options.length; at += SHARD_SIZE) {
    const slice = options.slice(at, at + SHARD_SIZE);
    const names = new Set(slice.flatMap((option) => option.names ?? []));
    const values = Object.fromEntries(Object.entries(page.values ?? {}).filter(([name]) => names.has(name)));
    const index = shards.length;
    shards.push({ options: slice, values });
    for (const name of names) byName[name] = index;
  }
  return { main: { ...page, options: [], values: {}, shards: byName }, shards };
}

export function flagCandidates(args, shards) {
  const out = new Set();
  for (const arg of args) {
    const text = typeof arg === "string" ? arg : arg?.text;
    if (!text || !text.startsWith("-")) continue;
    const equals = text.indexOf("=");
    const base = equals > 0 ? text.slice(0, equals) : text;
    out.add(base);
    for (let n = 2; n <= Math.min(base.length, 8); n++) out.add(base.slice(0, n));
  }
  return [...out].filter((flag) => Object.prototype.hasOwnProperty.call(shards, flag));
}
