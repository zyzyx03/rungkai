/* @unocss-include */
import { MAN_PAGE_ICON, EXTERNAL_ICON } from "../lib/icons.js";
import { nestPieces } from "../lib/nesting.js";
import { SYNTAX_NOTES } from "../lib/syntax.js";

const $ = (sel) => document.querySelector(sel);

const els = {
  form: $("#explain-form"),
  cmd: $("#cmd"),
  clear: $("#clear"),
  explain: $("#explain"),
  envPicker: $("#env-picker"),
  envButton: $("#env-button"),
  envMenu: $("#env-menu"),
  envLabel: $("#env-label"),
  results: $("#results"),
  examples: $("#examples"),
  synopsis: $("#synopsis"),
  connectors: $("#connectors"),
  cards: $("#cards"),
  brackets: $("#brackets"),
  empty: $("#empty"),
  statusDot: $("#status-dot"),
  statusText: $("#status-text"),
  undo: $("#undo"),
  newCommand: $("#new-command"),
  tldr: $("#tldr"),
  tldrText: $("#tldr-text"),
  tldrDanger: $("#tldr-danger"),
  tldrButton: $("#tldr-button"),
  escHint: $("#esc-hint"),
  modePicker: $("#mode-picker"),
  modeButton: $("#mode-button"),
  modeMenu: $("#mode-menu"),
  modeLabel: $("#mode-label"),
  prompt: $("#prompt"),
  suggestion: $("#suggestion"),
  suggestionCommand: $("#suggestion-command"),
  suggestionRationale: $("#suggestion-rationale"),
  suggestionAssumed: $("#suggestion-assumed"),
  suggestionBasis: $("#suggestion-basis"),
  suggestionLabel: $("#suggestion-label"),
  suggestionGround: $("#suggestion-ground"),
  suggestionCopy: $("#suggestion-copy"),
  suggestionAgain: $("#suggestion-again"),
  suggestionToggle: $("#suggestion-toggle"),
  suggestionDismiss: $("#suggestion-dismiss"),
  suggestionExplain: $("#suggestion-explain"),
};

// Tokyo Night, one colour per token role; the connector uses the same ink.
// The diagram's spacing lives in the stylesheet, so the geometry and the
// layout cannot drift apart.
const styles = getComputedStyle(document.documentElement);
const LANE = parseFloat(styles.getPropertyValue("--lane")) || 22;

const COLORS = {
  tool: "#9ece6a",
  builtin: "#ff9e64",
  arg: "#bb9af7",
  syntax: "#38bdf8",
  gap: "#f7768e",
  unknown: "#f7768e",
  operand: "#7f88ad",
};



const state = { cmd: "", env: "all", mode: "explain", undo: [], busy: false, suggested: "" };

// The geometry the connectors were last drawn for; a redraw onto the same
// geometry is skipped so a draw-in animation is not cut short.
let connectorKey = "";
const svgNS = "http://www.w3.org/2000/svg";
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let viewTransition;
let explainRequest;

async function transitionView(update) {
  if (!document.startViewTransition || reducedMotion()) {
    update();
    return;
  }
  viewTransition?.skipTransition();
  viewTransition = document.startViewTransition(update);
  // updateCallbackDone carries update errors to the caller; finished can
  // reject for the same error and must not leave an unhandled promise.
  viewTransition.finished.catch(() => {});
  await viewTransition.updateCallbackDone;
}

/* ── explain ──────────────────────────────────────────────── */
async function explain(cmd, env) {
  explainRequest?.abort();
  const request = explainRequest = new AbortController();
  state.cmd = cmd;
  state.env = env;
  permalink(cmd, env);
  els.newCommand.hidden = false;
  els.escHint.hidden = false;
  // Keep the current view in place until its replacement is ready.
  setBusy(true);
  try {
    const res = await fetch("/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cmd, env }),
      signal: request.signal,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `explain failed (${res.status})`);
    const result = await res.json();
    await document.fonts?.ready;
    if (request.signal.aborted) return;
    await transitionView(() => {
      if (!request.signal.aborted) render(result, cmd);
    });
  } catch (error) {
    if (request.signal.aborted) return;
    await transitionView(() => {
      if (request.signal.aborted) return;
      delete document.documentElement.dataset.initialCommand;
      els.examples.hidden = true;
      els.results.hidden = false;
      els.synopsis.replaceChildren();
      els.connectors.replaceChildren();
      els.brackets.replaceChildren();
      connectorKey = "";
      els.empty.hidden = true;
      const alert = document.createElement("p");
      alert.className = "border-t border-signal/40 pt-5 text-[14px] text-signal";
      alert.textContent = error.message;
      els.cards.replaceChildren(alert);
    });
  } finally {
    if (explainRequest === request) setBusy(false);
  }
}

function setBusy(busy) {
  state.busy = busy;
  els.explain.disabled = busy;
  els.form.setAttribute("aria-busy", String(busy));
}

function permalink(cmd, env) {
  const url = new URL(location.href);
  if (cmd) url.searchParams.set("cmd", cmd);
  else url.searchParams.delete("cmd");
  url.searchParams.set("env", env);
  history.replaceState(null, "", url);
}

/* ── render ────────────────────────────────────────────────── */
// Every new explanation gets the same token → route → card entrance.
function render(result, cmd) {
  delete document.documentElement.dataset.initialCommand;
  els.examples.hidden = true;
  els.results.hidden = false;
  els.results.classList.add("has-intro");
  releaseRoute();
  els.synopsis.replaceChildren();
  els.cards.replaceChildren();
  els.connectors.replaceChildren();
  els.brackets.replaceChildren();
  connectorKey = "";

  let cardIndex = 0;
  const cardIds = new Map(); // anchor key → card, so two pipes share one entry
  const roots = nestPieces(result.segments.filter((seg) => seg.kind !== "text"));
  let partIndex = 0;

  // A leaf is a token you can click. A region is the span around its parts:
  // it cannot be a button, because buttons cannot hold buttons.
  const build = (node) => {
    const { piece: seg, children } = node;
    const kind = seg.gap ? "gap" : seg.kind;
    const hasCard = Boolean(seg.anchor) || Boolean(seg.gap);
    const isRegion = children.length > 0;
    const el = document.createElement(!isRegion && hasCard ? "button" : "span");
    // Entrance order: left-to-right across the command, so the line reads
    // itself in as the routes below draw out from it.
    el.style.setProperty("--t", String(Math.min(partIndex++, 10)));
    if (hasCard) {
      const key = seg.anchor?.key;
      let id = key ? cardIds.get(key) : undefined;
      if (!id) {
        cardIndex += 1;
        id = `card-${cardIndex}`;
        if (key) cardIds.set(key, id);
        els.cards.append(makeEntry(seg, kind, cardIndex));
      }
      el.dataset.card = id;
      el.dataset.color = COLORS[kind] ?? COLORS.operand;
      el.style.setProperty("--token-color", el.dataset.color);
      if (kind === "arg" && seg.anchor?.title) el.setAttribute("aria-label", seg.anchor.title);
      el.addEventListener("mouseenter", () => setActive(id));
      el.addEventListener("mouseleave", clearActive);
      if (!isRegion) {
        el.type = "button";
        el.className = `token ${kind === "gap" ? "text-signal" : "text-ink"}`;
        el.addEventListener("click", () => {
          lockRoute(id);
          focusEntry(id);
        });
        el.addEventListener("focus", () => setActive(id));
        el.addEventListener("blur", clearActive);
      } else {
        el.className = "region";
        el.dataset.region = "1";
      }
    }

    // The node prints only the parts of the command its children do not.
    let at = seg.start;
    for (const child of children) {
      if (child.piece.start > at) el.append(cmd.slice(at, child.piece.start));
      el.append(build(child));
      at = Math.max(at, child.piece.end);
    }
    if (at < seg.end) el.append(cmd.slice(at, seg.end));
    return el;
  };

  let at = 0;
  for (const node of roots) {
    if (node.piece.start > at) els.synopsis.append(cmd.slice(at, node.piece.start));
    els.synopsis.append(build(node));
    at = Math.max(at, node.piece.end);
  }
  if (at < cmd.length) els.synopsis.append(cmd.slice(at, cmd.length));

  const hasEntries = result.segments.some((s) => s.kind !== "text");
  els.empty.hidden = hasEntries;
  els.results.classList.toggle("has-entries", hasEntries);
  tldrText = "";
  els.tldr.hidden = true;
  tldrRun++;
  els.tldrButton.setAttribute("aria-expanded", "false");
  updateStatus(result);
  floatCommand();
  drawConnectors(true);
}

function makeEntry(seg, kind, index) {
  const color = COLORS[kind] ?? COLORS.operand;
  const article = document.createElement("article");
  article.id = `card-${index}`;
  article.className = `entry scroll-mt-24 rounded-[4px] border px-5 py-4 ${index === 1 ? "" : "mt-3"}`;
  article.dataset.card = `card-${index}`;
  article.style.setProperty("--role", color);
  article.style.setProperty("--i", String(Math.min(index - 1, 8)));

  const head = document.createElement("div");
  head.className = "flex flex-wrap items-baseline gap-x-3 gap-y-1.5";
  const title = document.createElement("h3");
  title.className = "font-mono text-[14.5px] font-medium text-ink";
  // An option card is named by its flags (--archive, -a); a bundled letter
  // alone is too small to be a heading. An operand card is named by what the
  // page calls the thing: "destination", not "host".
  title.textContent = kind === "arg" && seg.anchor?.title ? seg.anchor.title
    : kind === "operand" && seg.anchor?.title ? seg.anchor.title
      : seg.text;
  const kindTag = document.createElement("span");
  kindTag.className = "kind-tag";
  kindTag.textContent = categoryFor(seg, kind);
  head.append(title, kindTag);
  // What the option takes, in the page's own words: "identity_file". The
  // heading usually says it already — "-mtime n" is the page's usage line —
  // so the chip is only for a page that gives no usage.
  const value = seg.anchor?.value;
  if (kind === "arg" && value && /^[A-Za-z][\w.-]*$/.test(value) && !seg.anchor?.title?.includes(value)) {
    const valueTag = document.createElement("span");
    valueTag.className = "value-tag";
    valueTag.textContent = `takes ${value}`;
    head.append(valueTag);
  }

  const body = document.createElement("p");
  body.className = "entry-body";
  body.textContent = bodyFor(seg, kind);

  article.append(head, body);

  if (kind === "tool" && seg.anchor?.description) {
    const prose = document.createElement("p");
    prose.className = "entry-body";
    prose.textContent = seg.anchor.description;
    article.append(prose);
  }
  if (kind === "tool" && seg.anchor?.options?.length) {
    const list = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = `All options (${seg.anchor.options.length})`;
    list.append(summary);
    for (const option of seg.anchor.options) {
      const term = document.createElement("p");
      term.className = "font-mono mt-3";
      term.textContent = option.usage || option.names.join(", ");
      const definition = document.createElement("p");
      definition.className = "entry-body";
      definition.textContent = option.desc || "The page names this option, but no description was extracted.";
      list.append(term, definition);
    }
    list.addEventListener("toggle", () => drawConnectors(true));
    article.append(list);
  }

  const citation = citationFor(seg, kind);
  if (citation || seg.anchor?.url) {
    const ref = document.createElement("p");
    ref.className = "entry-ref";
    if (citation) {
      const cite = document.createElement("span");
      cite.textContent = citation;
      ref.append(cite);
    }
    if (seg.anchor?.url) {
      const env = seg.anchor.env.replace("/", " ");
      const link = document.createElement("a");
      link.className = "source-chip";
      link.href = seg.anchor.url;
      link.rel = "noreferrer";
      link.target = "_blank";
      link.setAttribute("aria-label", `${env} man page`);
      link.innerHTML = `${MAN_PAGE_ICON}<span>${env}</span>${EXTERNAL_ICON}`;
      ref.append(link);
    }
    article.append(ref);
  }

  article.addEventListener("mouseenter", () => setActive(article.dataset.card));
  article.addEventListener("mouseleave", clearActive);
  article.addEventListener("focusin", () => setActive(article.dataset.card));
  article.addEventListener("focusout", clearActive);
  // The other half of the route: the entry sends the reader back up to the
  // command and the bracket hanging from its token.
  article.addEventListener("click", (event) => {
    if (event.target.closest("a, button, details")) return;
    // Drag-selecting a sentence is reading, not a jump.
    if (!getSelection().isCollapsed) return;
    lockRoute(article.dataset.card);
    focusCommand();
  });
  return article;
}

// The page an entry was taken from, shown under the description.
function citationFor(seg, kind) {
  if (kind === "gap" || kind === "unknown") return "";
  if (kind === "arg") return `${seg.tool}(${seg.anchor?.section ?? 1}) § OPTIONS`;
  if (kind === "operand") return `${seg.tool}(${seg.anchor?.section ?? 1}) § DESCRIPTION`;
  if (kind === "syntax") return seg.anchor.title.replace("bash(1) — ", "bash(1) § ");
  return seg.anchor?.title ?? "";
}

function categoryFor(seg, kind) {
  if (kind === "tool") return "command";
  if (kind === "builtin") return "builtin";
  if (kind === "arg") return "option";
  if (kind === "operand") return "argument";
  if (kind === "unknown") return "undocumented";
  if (kind === "syntax") return "shell syntax";
  if (kind === "gap") return "undocumented";
  return "token";
}

function bodyFor(seg, kind) {
  if (kind === "gap") {
    if (seg.anchor?.key && !seg.anchor.key.startsWith("gap:")) {
      return "The page names this token, but no description was extracted. This is a documentation gap.";
    }
    return `No page for ${seg.tool} was found in this environment, so nothing here is checked against documentation.`;
  }
  if (kind === "syntax") {
    // The manual's own words for the construct, when the corpus has them.
    const desc = seg.anchor?.desc?.trim();
    if (desc) return desc;
    const section = seg.anchor.title.replace("bash(1) — ", "");
    // A construct with its own sentence wins over the section's.
    return SYNTAX_NOTES[seg.text] ?? SYNTAX_NOTES[section] ?? "Shell syntax, cited from bash(1).";
  }
  const desc = seg.anchor?.desc?.trim();
  if (desc) return desc;
  if (kind === "tool") return "This tool has a page in the corpus, but no synopsis was extracted for it.";
  if (kind === "builtin") return "This builtin is documented in bash(1).";
  if (kind === "operand") return "The page names this operand, but says no more about it.";
  if (kind === "unknown") return "This flag is not in the page's option list, so nothing here is checked against documentation.";
  return "Matched an option on this page, which did not carry a description.";
}

function updateStatus(result) {
  const sources = result.sources ?? [];
  if (sources.length) {
    els.statusDot.className = "inline-block h-1.5 w-1.5 bg-blue";
    els.statusText.textContent = `${sources.length} source${sources.length === 1 ? "" : "s"} · ${result.env}`;
  } else {
    els.statusDot.className = `inline-block h-1.5 w-1.5 ${result.gaps?.length ? "bg-signal" : "bg-ink-dim"}`;
    els.statusText.textContent = `${result.gaps?.length ? "no matching pages" : "no sources"} · ${result.env}`;
  }
  // Restore this command's toolbar before the next refresh paints. The API
  // still refreshes the status when its response arrives.
  try {
    sessionStorage.setItem("rungkai:command-status", JSON.stringify({
      cmd: state.cmd,
      env: state.env,
      text: els.statusText.textContent,
      dot: els.statusDot.className,
    }));
  } catch {
    // Storage can be unavailable; the live explanation still works.
  }
}

/* ── token → entry routing ─────────────────────────────────── */
// shortcut: lanes repeat every 4 connectors per side; widen the 70px margin
// before supporting commands with more anchored tokens than that.
function drawConnectors(animate = false) {
  const svg = els.connectors;
  const marksSvg = els.brackets;
  const hostRect = els.results.getBoundingClientRect();
  const width = Math.round(hostRect.width);
  const height = Math.round(hostRect.height);
  // The stylesheet decides when the diagram is off (it hides the overlay and
  // lets the token's own colour carry the role), so the drawing asks it
  // rather than keeping a second threshold of its own.
  if (height < 20 || !svg.getClientRects().length) {
    svg.replaceChildren();
    marksSvg.replaceChildren();
    connectorKey = "";
    return;
  }
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const tokens = [...els.synopsis.querySelectorAll("[data-card]")].filter((t) => document.getElementById(t.dataset.card));
  if (!tokens.length) {
    svg.replaceChildren();
    marksSvg.replaceChildren();
    connectorKey = "";
    return;
  }

  // Read every rect up front: the loop only writes SVG afterwards, so no
  // layout invalidation lands between a write and the next measurement.
  const synopsis = els.synopsis.getBoundingClientRect();
  const cards = els.cards.getBoundingClientRect();
  const rects = new Map(tokens.map((token) => [token, token.getBoundingClientRect()]));
  const leafRects = tokens.filter((token) => !token.dataset.region).map((token) => rects.get(token));
  const commandWraps = leafRects.some((r) => Math.abs(r.top - leafRects[0].top) > 2
    || Math.abs(r.bottom - leafRects[0].bottom) > 2);
  if (els.synopsis.classList.contains("is-wrapped") !== commandWraps) {
    els.synopsis.classList.toggle("is-wrapped", commandWraps);
    // Extra row spacing changes the geometry. Measure once more before
    // drawing so the brackets use the final positions.
    drawConnectors(animate);
    return;
  }
  const entryRects = new Map();
  const entryRect = (id) => {
    if (!entryRects.has(id)) entryRects.set(id, document.getElementById(id).getBoundingClientRect());
    return entryRects.get(id);
  };

  // One route per card: two pipes point at one Pipelines entry, so the extra
  // token joins the main line instead of stacking an identical path on it.
  const groups = new Map();
  for (const token of tokens) {
    const id = token.dataset.card;
    if (!groups.has(id)) groups.set(id, { id, tokens: [] });
    groups.get(id).tokens.push(token);
  }
  const routes = [...groups.values()];

  // The band the routes fan out through: the space between the command and
  // the entries. It closes as the entries rise under the floating command —
  // but never so far that the routes merge into one line. A ladder of a few
  // pixels each still reads as a fan, and the entries fade under it with the
  // band.
  const bandTop = synopsis.bottom - hostRect.top + 5;
  const bandHeight = Math.max(
    (routes.length + 1) * 4,
    Math.min(140, cards.top - synopsis.bottom - 12),
  );
  els.synopsis.style.setProperty("--band", `${bandHeight + 22}px`);

  // A redraw that would land on the same geometry is skipped, so the routes
  // keep their draw-in when a resize observer fires right after a render.
  const key = `${width}x${height}|${[...rects.values()].map((r) => `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`).join(";")}|${routes.map((r) => {
    const e = entryRect(r.id);
    return `${Math.round(e.left)},${Math.round(e.top)},${Math.round(e.height)}`;
  }).join(";")}`;
  if (key === connectorKey && !animate) return;
  connectorKey = key;

  const wires = [];
  const brackets = [];

  const mid = synopsis.left + synopsis.width / 2;


  const tokenX = (token) => {
    const r = rects.get(token);
    return r.left + r.width / 2;
  };

  // explainshell decides each link's side by its centreline, then forces half
  // across if every link would use one margin. Left links are handled
  // left-to-right and right links right-to-left, so a side's drops step outward
  // without crossing the next route's vertical.
  const centreOf = (route) => route.tokens.reduce((sum, token) => sum + tokenX(token), 0) / route.tokens.length;
  const byX = [...routes].sort((a, b) => centreOf(a) - centreOf(b));
  let left = byX.filter((route) => centreOf(route) <= mid);
  let right = byX.filter((route) => centreOf(route) > mid);
  if (!left.length || !right.length) {
    const half = Math.floor(byX.length / 2);
    left = byX.slice(0, half);
    right = byX.slice(half);
  }

  const outerX = (route, side) => route.tokens.reduce(
    (best, token) => (side === "left" ? Math.min(best, tokenX(token)) : Math.max(best, tokenX(token))),
    tokenX(route.tokens[0]),
  );
  const ordered = [
    ...left.map((route) => ({ route, side: "left" })).sort((a, b) => outerX(a.route, "left") - outerX(b.route, "left")),
    ...right.map((route) => ({ route, side: "right" })).sort((a, b) => outerX(b.route, "right") - outerX(a.route, "right")),
  ];
  const counts = { left: left.length, right: right.length };
  const taken = { left: 0, right: 0 };
  const firstEntryId = els.cards.querySelector(".entry")?.dataset.card;
  // Long commands can reach past the cards. Keep every lane outside its
  // side's stems so a connector never doubles back towards the command.
  const stemEdges = {
    left: commandWraps
      ? Math.min(...[...rects.values()].map((r) => r.left - hostRect.left))
      : Math.min(...left.map((route) => outerX(route, "left") - hostRect.left)),
    right: commandWraps
      ? Math.max(...[...rects.values()].map((r) => r.right - hostRect.left))
      : Math.max(...right.map((route) => outerX(route, "right") - hostRect.left)),
  };

  for (const { route, side } of ordered) {
    const idx = taken[side]++;
    const count = counts[side];
    const e = entryRect(route.id);
    const colour = route.tokens[0].dataset.color ?? COLORS.operand;

    // The bracket under a token is the token's own mark, and the wire that
    // carries the route belongs to the page. They are drawn apart so the
    // floating command can sit between them: the bracket stays crisp above
    // it, and the wire passes under it.
    const group = document.createElementNS(svgNS, "g");
    group.dataset.card = route.id;
    group.style.setProperty("--path-color", colour);
    const marks = document.createElementNS(svgNS, "g");
    marks.dataset.card = route.id;
    marks.style.setProperty("--path-color", colour);
    // The wire is the pair too: pointing at it lights its route the way the
    // token does. Only the hit stroke takes pointer events, so this fires
    // when the reader is actually over the line.
    for (const g of [group, marks]) {
      g.addEventListener("mouseenter", () => setActive(route.id));
      g.addEventListener("mouseleave", clearActive);
    }

    const slot = bandTop + (bandHeight / (count + 1)) * (idx + 1);
    const edge = side === "left" ? e.left - hostRect.left : e.right - hostRect.left;
    const laneEdge = side === "left" ? Math.min(edge, stemEdges.left) : Math.max(edge, stemEdges.right);
    // Tight margins must still fit one lane per route, or lanes overlap.
    const gap = Math.min(LANE, Math.max(4, (side === "left" ? laneEdge - 8 : width - 8 - laneEdge) / (count + 1)));
    let laneX = side === "left" ? laneEdge - (idx + 1) * gap : laneEdge + (idx + 1) * gap;
    const endY = e.top - hostRect.top + Math.min(30, Math.max(14, e.height / 2));

    const tokenRects = route.tokens.map((token) => {
      const t = rects.get(token);
      const y0 = t.bottom - hostRect.top;
      // A region's bracket drops well below the parts' brackets, so a
      // substitution reads as the thing holding them.
      const region = Boolean(token.dataset.region);
      const drop = region ? 17 : 5;
      return { x0: t.left - hostRect.left, x1: t.right - hostRect.left, y0, y1: y0 + drop, cy: t.top + t.height / 2 - hostRect.top, sx: t.left + t.width / 2 - hostRect.left, region };
    });
    const rep = side === "left"
      ? tokenRects.reduce((a, b) => (b.sx < a.sx ? b : a))
      : tokenRects.reduce((a, b) => (b.sx > a.sx ? b : a));

    // Several tokens can share one entry — the same tool used twice — and
    // then they are one thing, so they get one bracket rather than a row of
    // ticks that read as a single bar.
    const lines = [];
    for (const r of tokenRects) {
      // Inline regions and token buttons have different heights even on the
      // same text line. Their centres align; their bottom edges do not.
      const row = lines.find((row) => Math.abs(row[0].cy - r.cy) < 2);
      if (row) row.push(r);
      else lines.push([r]);
    }
    const bracketBottom = (row) => Math.max(...row.map((r) => r.y1));
    const repRow = lines.find((row) => row.includes(rep));
    const repY = bracketBottom(repRow);
    const bracketLeft = Math.min(...repRow.map((r) => r.x0));
    const bracketRight = Math.max(...repRow.map((r) => r.x1));
    const bracketEdge = side === "left" ? bracketLeft : bracketRight;
    const isRegion = repRow.some((r) => r.region);
    // A region represents the whole construct. Leave from its midpoint so
    // its underline does not turn into the outer edge of a large frame.
    let stemX = isRegion ? (bracketLeft + bracketRight) / 2 : rep.sx;
    // A bracket already beside the cards can descend from its outer end.
    // Align the lane with that end instead of adding a tiny sideways step.
    const outsideCard = side === "left" ? bracketEdge < edge - 8 : bracketEdge > edge + 8;
    if (!commandWraps && !isRegion && outsideCard && Math.abs(laneX - bracketEdge) <= LANE) {
      stemX = bracketEdge;
      laneX = bracketEdge;
    }
    const aboveFirstEntry = isRegion && route.id === firstEntryId
      && stemX >= e.left - hostRect.left && stemX <= e.right - hostRect.left;
    const wrapRoute = commandWraps && !aboveFirstEntry;
    // Only the bracket is a click target. The long reach down the margin is
    // decoration over empty space, and a click there is a click on nothing.
    const bracket = [];
    let step = 0;
    const add = (d, opacity, hit = false) => {
      if (hit) bracket.push(d);
      const path = segment(d, colour, opacity);
      path.dataset.step = String(step++);
      group.append(path);
    };
    const mark = (d, opacity, hit = false) => {
      if (hit) bracket.push(d);
      const path = segment(d, colour, opacity);
      path.dataset.step = String(step++);
      marks.append(path);
    };
    for (const row of lines) {
      const x0 = Math.min(...row.map((r) => r.x0));
      const x1 = Math.max(...row.map((r) => r.x1));
      const y0 = Math.max(...row.map((r) => r.y0));
      const y1 = bracketBottom(row);
      // A region's bracket is the quieter mark: it holds the parts, it is not
      // one of them.
      mark(`M ${x0} ${y0} V ${y1} H ${x1} V ${y0}`, row.some((r) => r.region) ? 0.5 : 0.8, true);
      if (wrapRoute) {
        // Leave each wrapped row sideways, below its text. Joining through
        // the command's centre would run a wire through subsequent rows.
        const rowEdge = side === "left" ? x0 : x1;
        if (rowEdge !== laneX) mark(`M ${rowEdge} ${y1} H ${laneX}`, 0.42);
      } else if (!row.includes(rep)) {
        // A token on another line still joins the route, or its entry would
        // have no line to it.
        mark(`M ${row[0].sx} ${y1} H ${stemX} V ${repY}`, 0.42, true);
      }
    }
    if (aboveFirstEntry) {
      // The enclosing construct's card is directly below the command. Go
      // straight to its top instead of making a detour around the margin.
      const topY = e.top - hostRect.top;
      if (topY > repY) {
        mark(`M ${stemX} ${repY} V ${topY}`, 0.5);
        group.append(dot(stemX, topY, 3, colour));
      }
    } else if (wrapRoute) {
      // One trunk in the margin joins every row belonging to this card.
      const startY = Math.min(...lines.map(bracketBottom));
      mark(`M ${laneX} ${startY} V ${endY} H ${edge}`, 0.5);
      group.append(dot(side === "left" ? edge + 3 : edge - 3, endY, 3, colour));
    } else if (stemX === laneX) {
      // One continuous stroke avoids stacked round caps and glow where an
      // aligned stem meets its lane. An empty horizontal path makes a dot.
      mark(`M ${stemX} ${repY} V ${endY} H ${edge}`, 0.5);
      group.append(dot(side === "left" ? edge + 3 : edge - 3, endY, 3, colour));
    } else {
      // Other cards use the side lanes to avoid crossing earlier entries.
      mark(`M ${stemX} ${repY} V ${slot}`, 0.5);
      add(`M ${stemX} ${slot} H ${laneX}`, 0.2);
      add(`M ${laneX} ${slot} V ${endY}`, fade(endY - slot));
      add(`M ${laneX} ${endY} H ${edge}`, 0.78);
      group.append(dot(side === "left" ? edge + 3 : edge - 3, endY, 3, colour));
    }
    // The bracket is a hairline: one wider invisible stroke over it is what a
    // click actually lands on.
    const hit = document.createElementNS(svgNS, "path");
    hit.setAttribute("d", bracket.join(" "));
    hit.setAttribute("class", "route-hit");
    marks.append(hit);

    wires.push(group);
    brackets.push(marks);
  }

  reconcileRoutes(svg, wires);
  reconcileRoutes(marksSvg, brackets);
  for (const overlay of [svg, marksSvg]) {
    if (lockedId !== null) overlay.querySelector(`g[data-card="${lockedId}"]`)?.classList.add("is-active");
    // Newly added routes inherit the pair the reader is following.
    if (activeId !== null) overlay.querySelector(`g[data-card="${activeId}"]`)?.classList.add("is-active");
  }
  if (animate) {
    animateRoutes();
  }
}

// Keep existing SVG nodes when the page scrolls or changes size. Their
// normalized dash animations continue while their geometry is updated.
function reconcileRoutes(overlay, groups) {
  const existing = new Map([...overlay.children].map((g) => [g.dataset.card, g]));
  for (const next of groups) {
    const current = existing.get(next.dataset.card);
    if (!current) {
      overlay.append(next);
      continue;
    }
    existing.delete(next.dataset.card);
    const children = [...current.children];
    const nextChildren = [...next.children];
    nextChildren.forEach((child, index) => {
      const previous = children[index];
      if (previous?.tagName === child.tagName) {
        for (const attr of [...previous.attributes]) {
          if (!child.hasAttribute(attr.name)) previous.removeAttribute(attr.name);
        }
        for (const attr of child.attributes) previous.setAttribute(attr.name, attr.value);
      } else if (previous) {
        previous.replaceWith(child);
      } else {
        current.append(child);
      }
    });
    children.slice(nextChildren.length).forEach((child) => child.remove());
  }
  for (const group of existing.values()) group.remove();
}

// The wire fades where it is long. The eye is carried by the ends, not the
// wire: a route to the card just below stays crisp, one that has to run past
// a screenful of entries thins out. A long command is then a wash of wires
// rather than a cage, and the route the reader is looking at comes back in
// full when they hover it.
function fade(length) {
  const view = window.innerHeight || 900;
  return 0.38 * Math.max(0.1, 1 - Math.max(0, length - view) / (view * 2));
}

function segment(d, colour, opacity) {
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", d);
  path.setAttribute("stroke", colour);
  path.setAttribute("stroke-opacity", String(opacity));
  path.setAttribute("pathLength", "1");
  return path;
}

// The one authored moment: each route draws itself from the token it belongs
// to, down the margin and into the entry it documents.
function animateRoutes() {
  if (reducedMotion()) return;
  const start = document.timeline.currentTime;
  for (const group of els.connectors.querySelectorAll("g[data-card]")) {
    const marks = els.brackets.querySelector(`g[data-card="${group.dataset.card}"]`);
    const paths = [...group.querySelectorAll("path[data-step]"), ...marks.querySelectorAll("path[data-step]")]
      .sort((a, b) => Number(a.dataset.step) - Number(b.dataset.step));
    const base = 160 + Math.min(Number(group.dataset.card.slice(5)) - 1, 8) * 45;
    const duration = 700 / Math.max(paths.length, 1);
    paths.forEach((path, index) => {
      const animation = path.animate([
        { strokeDasharray: "1 1", strokeDashoffset: "1" },
        { strokeDasharray: "1 1", strokeDashoffset: "0" },
      ], { duration, delay: base + index * duration, easing: "ease-in-out", fill: "both" });
      animation.startTime = start;
    });
    const animation = group.querySelector("circle")?.animate([
      { opacity: 0 }, { opacity: 1 },
    ], { duration: 160, delay: base + 700, fill: "both" });
    if (animation) animation.startTime = start;
  }
}

function dot(cx, cy, r, color) {
  const circle = document.createElementNS(svgNS, "circle");
  circle.setAttribute("cx", String(cx));
  circle.setAttribute("cy", String(cy));
  circle.setAttribute("r", String(r));
  circle.setAttribute("fill", color);
  return circle;
}

// A hover previews one route; a click locks it, so the pair stays isolated
// while the reader moves between the command and its entry. The lock is let
// go by clicking off the route, or by Escape.
let lockedId = null;

function setActive(id) {
  if (lockedId === null) showRoute(id);
}

function clearActive() {
  if (lockedId === null) hideRoute();
}

let activeId = null;

function showRoute(id) {
  // A pointer sweeping the command line calls this every frame; the same
  // route is not re-applied.
  if (activeId !== id) {
    activeId = id;
    for (const el of els.results.querySelectorAll("[data-card]")) {
      el.classList.toggle("is-active", el.dataset.card === id);
    }
    for (const el of els.connectors.querySelectorAll("g[data-card]")) {
      el.classList.toggle("is-active", el.dataset.card === id);
    }
    for (const el of els.brackets.querySelectorAll("g[data-card]")) {
      el.classList.toggle("is-active", el.dataset.card === id);
    }
  }
  // Keep the pair isolated through the gaps too, so crossing an entry's
  // edge never brings every label and connector back at once.
  els.results.classList.add("hovering");
}

function hideRoute() {
  activeId = null;
  els.results.classList.remove("hovering");
  for (const el of els.results.querySelectorAll(".is-active")) el.classList.remove("is-active");
  for (const el of els.connectors.querySelectorAll(".is-active")) el.classList.remove("is-active");
  for (const el of els.brackets.querySelectorAll(".is-active")) el.classList.remove("is-active");
}

function lockRoute(id) {
  lockedId = id;
  showRoute(id);
}

function releaseRoute() {
  lockedId = null;
  hideRoute();
}

// Down to the entry the token documents, and back up to the command and the
// bracket under its token.
function focusEntry(id) {
  const entry = document.getElementById(id);
  if (!entry) return;
  entry.scrollIntoView({ behavior: "smooth", block: "center" });
  entry.classList.add("is-flash");
  setTimeout(() => entry.classList.remove("is-flash"), 1600);
}

function focusCommand() {
  // The whole command, so the chosen token's bracket is on screen with it.
  // The command floats, so it is already on screen: scrolling to it would
  // only throw the reader out of the entry they came from.
  const box = els.synopsis.getBoundingClientRect();
  if (box.bottom > 0 && box.top < innerHeight) return;
  els.synopsis.scrollIntoView({ behavior: "smooth", block: "start" });
}

// The command line is a scrubber, the way explainshell's labels are: the
// route nearest the pointer lights, so sweeping left to right lights each in
// turn without having to land on the token. The scrub reaches as far as the
// entries do, so a pointer in the gap between them still holds one route
// lit — the reader keeps the arrow and the card it belongs to.
let scrubFrame = 0;
let scrubX = 0;
let scrubY = 0;
let scrubPointer = false;

function scrub() {
  if (scrubFrame) return;
  scrubFrame = requestAnimationFrame(() => {
    scrubFrame = 0;
    if (lockedId !== null || !scrubPointer) return;
    const target = document.elementFromPoint(scrubX, scrubY);
    if (!target || !els.results.contains(target)) {
      clearActive();
      return;
    }
    // Resolve the target again after scrolling: an entry can move under a
    // stationary pointer without a pointermove event.
    const route = target.closest("[data-card]");
    if (route) {
      setActive(route.dataset.card);
      return;
    }
    const line = els.synopsis.getBoundingClientRect();
    if (scrubY < line.top - 6) {
      clearActive();
      return;
    }
    let best = null;
    let bestGap = Infinity;
    for (const token of els.synopsis.querySelectorAll("[data-card]")) {
      const r = token.getBoundingClientRect();
      // Distance to the token's box, not its centre: a long token owns the
      // span it covers, and the nearest edge wins in the gaps between them.
      const gap = scrubX < r.left ? r.left - scrubX : scrubX > r.right ? scrubX - r.right : 0;
      const score = gap * 3 + Math.abs(scrubY - (r.top + r.height / 2));
      if (score < bestGap) {
        bestGap = score;
        best = token;
      }
    }
    if (best) setActive(best.dataset.card);
  });
}

function trackScrubPointer(event) {
  // A finger dragging the page is scrolling, not pointing.
  if (event.pointerType === "touch") return;
  scrubPointer = true;
  scrubX = event.clientX;
  scrubY = event.clientY;
  scrub();
}

els.results.addEventListener("pointerenter", trackScrubPointer);
els.results.addEventListener("pointermove", trackScrubPointer);
els.results.addEventListener("pointerleave", () => {
  scrubPointer = false;
  clearActive();
});

// Clicking off any route lets the lock go; a click on one is handled by the
// token, the entry or the wire itself.
addEventListener("click", (event) => {
  if (!event.target.closest?.("[data-card]")) releaseRoute();
});

els.connectors.addEventListener("click", (event) => {
  const route = event.target.closest?.("g[data-card]");
  if (!route) return;
  lockRoute(route.dataset.card);
  focusEntry(route.dataset.card);
});

let resizeFrame;
addEventListener("resize", () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => drawConnectors());
});
// The command line floats, so its tokens stay put while the entries move
// under them: the routes have to be drawn again as the page scrolls, or they
// would hang from where the command used to be.
let scrollFrame;
addEventListener("scroll", () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    floatCommand();
    drawConnectors();
    scrub();
  });
}, { passive: true });

// The panel is only there once the command floats: above the entries, the
// command is just the command, with the page's own wash behind it.
function floatCommand() {
  const box = els.synopsis.getBoundingClientRect();
  // The command is floating when it is held at the top of the window. The
  // test is the top of the window itself, so the panel cannot flicker in and
  // out on a boundary.
  els.synopsis.classList.toggle("is-floating", box.height > 0 && box.top <= 0);
}
document.fonts?.ready.then(() => drawConnectors());
if ("ResizeObserver" in window) {
  new ResizeObserver(() => requestAnimationFrame(() => drawConnectors())).observe(els.results);
}

/* ── plain english ─────────────────────────────────────────── */
// The reader asks for it. The model writes it, so the panel says so and
// never wears a citation.
let tldrRun = 0;
let tldrText = "";

// The model leads with one line naming the danger, so the reader sees the
// warning before the explanation. The line is the model's, not ours: it is
// taken off the text and shown as a label.
const DANGER_LINE = /^\s*DANGER:\s*([a-z]+)\s*\n?/i;

function showTldr(text) {
  const match = DANGER_LINE.exec(text);
  const danger = match && match[1].toLowerCase() !== "none" ? match[1].toLowerCase() : null;
  const body = match ? text.slice(match[0].length) : text;
  els.tldrText.textContent = body;
  if (danger) {
    els.tldrDanger.textContent = danger;
    els.tldrDanger.hidden = false;
  } else {
    els.tldrDanger.hidden = true;
  }
  return { body, danger };
}

async function loadTldr(cmd) {
  const run = ++tldrRun;
  els.tldr.hidden = false;
  els.tldr.classList.add("is-pending");
  if (!tldrText) els.tldrText.textContent = "";
  try {
    const res = await fetch("/api/tldr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cmd, env: state.env }),
    });
    if (!res.ok) throw new Error("no summary");
    // The answer arrives as it is written, so the reader watches it land.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (run !== tldrRun) return;
      for (const line of decoder.decode(value, { stream: true }).split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;
        let piece = "";
        try {
          piece = JSON.parse(payload).choices?.[0]?.delta?.content ?? "";
        } catch {
          continue;
        }
        if (!piece) continue;
        if (!text) els.tldr.classList.remove("is-pending");
        text += piece;
        showTldr(text);
      }
    }
    const { body, danger } = showTldr(text.trim());
    tldrText = danger ? `DANGER: ${danger}\n${body}` : body;
  } catch {
    // No model, no budget, or no network: the breakdown still stands.
    if (run === tldrRun) els.tldr.hidden = true;
  } finally {
    if (run === tldrRun) els.tldr.classList.remove("is-pending");
  }
}

els.tldrButton.addEventListener("click", () => {
  const open = !els.tldr.hidden;
  els.tldrButton.setAttribute("aria-expanded", String(!open));
  if (open) {
    els.tldr.hidden = true;
    return;
  }
  if (tldrText) {
    showTldr(tldrText);
    els.tldr.hidden = false;
    return;
  }
  loadTldr(state.cmd);
});

/* ── command recommender ───────────────────────────────────── */
async function suggest(request) {
  if (!request.trim()) return;
  setSuggestBusy(true);
  els.suggestion.hidden = false;
  els.suggestion.style.opacity = "0.55";
  // The panel is working, not empty: a bar stands for the words on their way.
  els.suggestion.classList.add("is-pending");
  els.suggestion.classList.remove("is-collapsed");
  els.suggestionToggle.setAttribute("aria-expanded", "true");
  els.suggestionBasis.textContent = state.cmd ? "based on the command above" : "new command";
  els.suggestionCommand.textContent = "…";
  els.suggestionLabel.textContent = "suggested command";
  els.suggestionRationale.textContent = "";
  els.suggestionAssumed.textContent = "";
  els.suggestionGround.textContent = "";
  els.suggestionRationale.classList.remove("text-signal");

  try {
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request, cmd: state.cmd, env: state.env }),
    });
    const data = await res.json();
    if (!res.ok) {
      els.suggestion.classList.remove("is-pending");
      els.suggestionCommand.textContent = "";
      els.suggestionRationale.textContent = data.error ?? "the recommender failed";
      els.suggestionRationale.classList.add("text-signal");
      return;
    }
    state.suggested = data.command;
    els.suggestion.classList.remove("is-pending");
    els.suggestionCommand.textContent = data.command;
    els.suggestionRationale.textContent = data.rationale ?? "";
    els.suggestionAssumed.textContent = data.assumed ? `assumed: ${data.assumed}` : "";
    // The command is what a reader might run, so the panel says what it rests
    // on. No command means the model had none, and the panel says that too
    // rather than showing an empty command under a heading.
    const grounded = data.grounded ?? { pages: [], gaps: [] };
    const parts = [];
    if (grounded.pages?.length) parts.push(`documented by ${grounded.pages.join(", ")}`);
    if (grounded.gaps?.length) parts.push(`not in the corpus: ${grounded.gaps.join(", ")}`);
    els.suggestionGround.textContent = parts.join(" · ");
    if (!data.command) {
      els.suggestionLabel.textContent = "no shell command for this";
      els.suggestionCommand.textContent = "";
      // Nothing to copy and nothing to explain: only asking again is left.
      els.suggestionCopy.hidden = true;
      els.suggestionExplain.hidden = true;
    } else {
      els.suggestionCopy.hidden = false;
      // Explaining a command the corpus has nothing for would show a screen
      // of red: every word in it undocumented, and no page to check any of
      // them against. The panel already says what is not in the corpus, so
      // the reader is not left guessing why there is nothing to open.
      els.suggestionExplain.hidden = !grounded.pages?.length;
    }
  } catch (error) {
    els.suggestion.classList.remove("is-pending");
    els.suggestionCommand.textContent = "";
    els.suggestionRationale.textContent = error.message;
    els.suggestionRationale.classList.add("text-signal");
  } finally {
    els.suggestion.style.opacity = "";
    setSuggestBusy(false);
  }
}

function setSuggestBusy(busy) {
  els.explain.disabled = busy;
  els.explain.classList.toggle("opacity-50", busy);
}

/* ── wiring ────────────────────────────────────────────────── */
els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = els.cmd.value.trim();
  if (!value) return;
  if (state.mode === "suggest") suggest(value);
  else explain(value, state.env);
});

/* one box, two jobs: explain the command that was typed, or ask for the
   command that was wanted */
function setMode(mode) {
  state.mode = mode;
  const suggesting = mode === "suggest";
  els.modeButton.dataset.mode = mode;
  els.modeLabel.textContent = suggesting ? "suggest" : "explain";
  for (const option of els.modeMenu.querySelectorAll("[data-mode]")) {
    option.setAttribute("aria-selected", String(option.dataset.mode === mode));
  }
  els.cmd.placeholder = suggesting
    ? "Write what you want to do, e.g. show the ports listening on this box…"
    : "Paste a command to explain…";
  els.cmd.setAttribute("aria-label", suggesting ? "What you want to do" : "Command line");
  els.prompt.textContent = suggesting ? "?" : "$";
  // The action is a keycap, so the word only lives in its name.
  const verb = suggesting ? "Suggest a command" : "Explain";
  els.explain.setAttribute("aria-label", `${verb} (press Enter)`);
  els.explain.setAttribute("title", `${verb} (press Enter)`);
}

function setModeOpen(open) {
  els.modeMenu.hidden = !open;
  els.modeButton.setAttribute("aria-expanded", String(open));
}

els.modeButton.addEventListener("click", () => setModeOpen(els.modeMenu.hidden));

els.modeButton.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  setModeOpen(true);
  els.modeMenu.querySelector('[aria-selected="true"]')?.focus();
});

els.modeMenu.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const options = [...els.modeMenu.querySelectorAll("[data-mode]")];
  const index = options.indexOf(document.activeElement);
  event.preventDefault();
  options[(index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length]?.focus();
});

els.modeMenu.addEventListener("click", (event) => {
  const option = event.target.closest("[data-mode]");
  if (!option) return;
  setModeOpen(false);
  setMode(option.dataset.mode);
  els.cmd.focus();
});

addEventListener("click", (event) => {
  if (!els.modePicker.contains(event.target)) setModeOpen(false);
});

// Escape belongs to the page, not to the field: it has to work wherever the
// reader's focus happens to be. A menu still takes it first, then the field
// empties and the page goes home.
addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!els.modeMenu.hidden) {
    setModeOpen(false);
    return;
  }
  if (!els.envMenu.hidden) {
    setEnvOpen(false);
    return;
  }
  if (lockedId !== null) {
    releaseRoute();
    return;
  }
  event.preventDefault();
  goHome();
});

setMode("explain");

/* Home: no command, the default corpus, the samples back, nothing to undo.
   The clear button, the Escape key and the "new command" link all land here. */
function goHome() {
  explainRequest?.abort();
  setBusy(false);
  tldrRun++;
  els.cmd.value = "";
  state.cmd = "";
  state.undo = [];
  els.undo.hidden = true;
  setEnv("all");
  permalink("", state.env);
  els.statusDot.className = "inline-block h-1.5 w-1.5 bg-ink-dim";
  els.statusText.textContent = "Ready when you are";
  els.newCommand.hidden = true;
  els.escHint.hidden = true;
  els.suggestion.hidden = true;
  els.suggestion.classList.remove("is-pending");
  transitionView(() => {
    delete document.documentElement.dataset.initialCommand;
    releaseRoute();
    els.synopsis.replaceChildren();
    els.cards.replaceChildren();
    els.connectors.replaceChildren();
    els.brackets.replaceChildren();
    connectorKey = "";
    els.examples.hidden = false;
    els.results.hidden = true;
  });
}

els.clear.addEventListener("click", () => {
  goHome();
  els.cmd.focus();
});

els.newCommand.addEventListener("click", () => {
  goHome();
  els.cmd.focus();
});



/* environment picker: a listbox, because a native select cannot carry a glyph */
function setEnv(id) {
  const items = [...els.envMenu.querySelectorAll("[data-env]")];
  const item = items.find((i) => i.dataset.env === id) ?? items[0];
  state.env = item.dataset.env;
  for (const i of items) i.setAttribute("aria-selected", String(i === item));
  els.envLabel.textContent = item.querySelector("[data-env-label]").textContent;
  els.envButton.querySelector("svg")?.replaceWith(item.querySelector("svg").cloneNode(true));
  return state.env;
}

function setEnvOpen(open) {
  els.envMenu.hidden = !open;
  els.envButton.setAttribute("aria-expanded", String(open));
}

els.envButton.addEventListener("click", () => setEnvOpen(els.envMenu.hidden));

els.envMenu.addEventListener("click", (event) => {
  const item = event.target.closest("[data-env]");
  if (!item) return;
  setEnvOpen(false);
  const previous = state.env;
  const id = setEnv(item.dataset.env);
  if (state.cmd) {
    // Switching the corpus re-explains the command, so the change is
    // undoable: the reader can go back to the environment they came from.
    state.undo.push({ cmd: state.cmd, env: previous });
    els.undo.hidden = false;
    explain(state.cmd, id);
  }
});

els.envButton.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  setEnvOpen(true);
  els.envMenu.querySelector('[aria-selected="true"]')?.focus();
});

els.envMenu.addEventListener("keydown", (event) => {
  const items = [...els.envMenu.querySelectorAll("[data-env]")];
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.target.closest("[data-env]")?.click();
    return;
  }
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  const step = event.key === "ArrowDown" ? 1 : -1;
  const next = items[(items.indexOf(document.activeElement) + step + items.length) % items.length];
  next?.focus();
});

addEventListener("click", (event) => {
  if (!els.envPicker.contains(event.target)) setEnvOpen(false);
});

addEventListener("keydown", (event) => {
  if (event.key === "Escape") setEnvOpen(false);
});

/* One handler for every example, whether it was the command text or the
   arrow beside it. */
function runExample(target) {
  // OS samples switch the corpus; tool samples keep the current one.
  const env = target.dataset.env ? setEnv(target.dataset.env) : state.env;
  els.cmd.value = target.dataset.cmd;
  explain(target.dataset.cmd, env).then(() => {
    if (state.cmd !== target.dataset.cmd || els.results.hidden) return;
    els.form.scrollIntoView({ behavior: reducedMotion() ? "instant" : "smooth", block: "start" });
  });
}

for (const link of document.querySelectorAll("[data-cmd]")) {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    runExample(link);
  });
}

/* The category tabs: one panel at a time, and the tablist stays a tablist. */
const catTabs = [...document.querySelectorAll(".cat-tab")];
const catPanels = [...document.querySelectorAll(".cat-panel")];
const catRow = document.querySelector(".cat-tabs");

function selectCat(tab) {
  for (const other of catTabs) other.setAttribute("aria-selected", String(other === tab));
  for (const panel of catPanels) panel.hidden = panel.dataset.cat !== tab.dataset.cat;
  // The row only ever rests on one of its two ends, so a chosen tab goes to
  // the nearer one: pick an early category and the row comes back to the
  // start with the categories before it in view, pick a late one and the row
  // goes to the end. The rects are compared to each other, because
  // offsetLeft is measured from the document, not from the row that scrolls.
  const row = catRow.getBoundingClientRect();
  const box = tab.getBoundingClientRect();
  const contentLeft = row.left - catRow.scrollLeft;
  const centre = box.left + box.width / 2 - contentLeft;
  const toEnd = centre > catRow.scrollWidth / 2;
  catRow.scrollTo({ left: toEnd ? catRow.scrollWidth : 0, behavior: "smooth" });
}

for (const tab of catTabs) {
  tab.addEventListener("click", () => selectCat(tab));
}

// A tablist moves with the arrow keys, which is also how a reader reaches
// the categories the row has scrolled out of sight.
catRow.addEventListener("keydown", (event) => {
  const index = catTabs.indexOf(document.activeElement);
  if (index < 0) return;
  let target = null;
  if (event.key === "ArrowRight") target = catTabs[(index + 1) % catTabs.length];
  else if (event.key === "ArrowLeft") target = catTabs[(index - 1 + catTabs.length) % catTabs.length];
  else if (event.key === "Home") target = catTabs[0];
  else if (event.key === "End") target = catTabs[catTabs.length - 1];
  if (!target) return;
  event.preventDefault();
  target.focus();
  selectCat(target);
});

/* The row scrolls when the categories outrun the column; each edge fades
   only while there is something more behind it. */
const catRowEnd = () => {
  const overflows = catRow.scrollWidth > catRow.clientWidth + 1;
  const atStart = catRow.scrollLeft <= 1;
  const atEnd = catRow.scrollLeft + catRow.clientWidth >= catRow.scrollWidth - 1;
  catRow.style.setProperty("--fade-left", !overflows || atStart ? "0px" : "30px");
  catRow.style.setProperty("--fade-right", !overflows || atEnd ? "0px" : "30px");
};
catRow.addEventListener("scroll", catRowEnd, { passive: true });
catRowEnd();

addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    els.cmd.focus();
    els.cmd.select();
  }
});

// The panel folds to the command it suggests, so the reader can keep the
// answer and lose the reasoning.
els.suggestionToggle.addEventListener("click", () => {
  const folded = els.suggestion.classList.toggle("is-collapsed");
  els.suggestionToggle.setAttribute("aria-expanded", String(!folded));
  els.suggestionToggle.title = folded ? "Show the reasoning" : "Fold the reasoning away";
  els.suggestionToggle.setAttribute("aria-label", els.suggestionToggle.title);
});

// And it can be dismissed altogether: the suggestion is an offer, not a bill.
els.suggestionDismiss.addEventListener("click", () => {
  els.suggestion.hidden = true;
  els.suggestion.classList.remove("is-pending");
  state.suggested = "";
});

// A second question: the field is still there, so the reader edits their
// words and asks again.
els.suggestionAgain.addEventListener("click", () => {
  setMode("suggest");
  els.cmd.focus();
  els.cmd.setSelectionRange(els.cmd.value.length, els.cmd.value.length);
});

els.suggestionExplain.addEventListener("click", () => {
  if (!state.suggested) return;
  setMode("explain");
  els.cmd.value = state.suggested;
  explain(state.suggested, state.env);
  els.cmd.scrollIntoView({ behavior: "smooth", block: "center" });
});

els.suggestionCopy.addEventListener("click", async () => {
  if (!state.suggested) return;
  try {
    await navigator.clipboard.writeText(state.suggested);
    els.suggestionCopy.textContent = "copied";
    setTimeout(() => { els.suggestionCopy.textContent = "copy"; }, 1200);
  } catch {
    els.suggestionCopy.textContent = "copy failed";
    setTimeout(() => { els.suggestionCopy.textContent = "copy"; }, 1200);
  }
});

els.undo.addEventListener("click", () => {
  const last = state.undo.pop();
  els.undo.hidden = state.undo.length === 0;
  if (!last) return;
  els.cmd.value = last.cmd;
  setEnv(last.env);
  explain(last.cmd, last.env);
});

const params = new URLSearchParams(location.search);
const initialEnv = params.get("env");
if (initialEnv) setEnv(initialEnv);
const initial = params.get("cmd");
if (initial) {
  els.cmd.value = initial;
  explain(initial, state.env);
}
