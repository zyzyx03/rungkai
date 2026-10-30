import { defineConfig, presetWind3 } from "unocss";

export default defineConfig({
  presets: [presetWind3()],
  theme: {
    colors: {
      // Tokyo Night (dark) and Tokyo Night Day (light). The values live in
      // global.css so [data-theme="light"] re-colours every utility; the
      // channels let UnoCSS keep its opacity modifiers (text-ink/80).
      paper: {
        DEFAULT: "rgb(var(--paper-rgb) / <alpha-value>)",
        2: "rgb(var(--paper-2-rgb) / <alpha-value>)",
        3: "rgb(var(--paper-3-rgb) / <alpha-value>)",
      },
      ink: {
        DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
        muted: "rgb(var(--ink-muted-rgb) / <alpha-value>)",
        dim: "rgb(var(--ink-dim-rgb) / <alpha-value>)",
      },
      rule: "rgb(var(--rule-rgb) / <alpha-value>)",
      blue: "rgb(var(--blue-rgb) / <alpha-value>)",
      purple: "rgb(var(--purple-rgb) / <alpha-value>)",
      cyan: "rgb(var(--cyan-rgb) / <alpha-value>)",
      green: "rgb(var(--green-rgb) / <alpha-value>)",
      orange: "rgb(var(--orange-rgb) / <alpha-value>)",
      signal: "rgb(var(--signal-rgb) / <alpha-value>)",
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
