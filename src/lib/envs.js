// The dropdown is a registry: a corpus is data, not a code path. An entry may
// point at another entry's corpus when the OS ships the same packages.
export const ENVIRONMENTS = [
  { id: "all", label: "all" },
  { id: "ubuntu/24.04", label: "ubuntu 24.04" },
  { id: "el9", label: "el9 (rocky/alma/rhel)" },
  { id: "alpine/3.22", label: "alpine 3.22" },
];

export function resolveEnv(envId) {
  const entries = ENVIRONMENTS.filter((e) => e.id !== "all");
  if (envId === "all") return [...new Set(entries.map((e) => e.corpus ?? e.id))];
  const hit = entries.find((e) => e.id === envId);
  return [hit?.corpus ?? envId];
}
