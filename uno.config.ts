import { defineConfig, presetWind3 } from "unocss";

export default defineConfig({
  presets: [presetWind3()],
  theme: {
    colors: {
      // Tokyo Night, matching fauzuwan.my
      paper: { DEFAULT: "#16171f", 2: "#1a1b26", 3: "#202233" },
      ink: { DEFAULT: "#eef0f6", muted: "#a9b1d6", dim: "#7f88ad" },
      rule: "#292b3a",
      blue: "#7aa2f7",
      purple: "#bb9af7",
      cyan: "#38bdf8",
      green: "#9ece6a",
      orange: "#ff9e64",
      signal: "#f7768e",
    },
    fontFamily: {
      sans: "Ubuntu Sans, Ubuntu, ui-sans-serif, sans-serif",
      display: "Orbitron, Ubuntu Sans, sans-serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
    },
  },
  shortcuts: {
    label: "font-display text-[11px] uppercase tracking-[0.14em] text-ink-muted",
    link: "py-1 font-mono text-[11px] text-ink-muted transition-colors hover:text-cyan",
    "btn-neon":
      "inline-flex items-center gap-1.5 rounded-[6px] border border-cyan/35 px-4 py-2 font-display text-[11px] uppercase tracking-[0.12em] text-cyan transition-colors hover:border-cyan hover:bg-cyan hover:text-paper",
    "btn-ghost":
      "inline-flex items-center gap-1.5 rounded-sm border border-ink/20 px-2.5 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted transition-colors hover:border-ink/50 hover:text-ink",
    field:
      "min-w-0 flex-1 bg-transparent font-mono text-[12.5px] text-ink outline-none placeholder:text-ink-muted/85",
  },
  content: { filesystem: ["src/**/*.{astro,js,ts}"] },
  safelist: ["bg-ink", "bg-ink-dim", "bg-signal", "text-signal", "bg-ink/5", "bg-signal/10"],
});
