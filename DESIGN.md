---
name: Tokyo Night man-page
colors:
  paper: '#16171f'
  paper-2: '#1a1b26'
  paper-3: '#202233'
  ink: '#eef0f6'
  ink-muted: '#a9b1d6'
  ink-dim: '#7f88ad'
  ink-soft: '#8b93b8'
  rule: '#292b3a'
  blue: '#7aa2f7'
  purple: '#bb9af7'
  cyan: '#38bdf8'
  green: '#9ece6a'
  orange: '#ff9e64'
  signal: '#f7768e'
  glass: 'rgba(41, 46, 66, 0.62)'
  glass-raised: 'rgba(41, 46, 66, 0.72)'
  neon: '#38bdf8'
  neon-frame: 'rgba(56, 189, 248, 0.28)'
  neon-frame-focus: 'rgba(56, 189, 248, 0.75)'
  shadow: 'rgba(0, 0, 0, 0.95)'
typography:
  display:
    fontFamily: Orbitron
    fontWeight: '700'
    letterSpacing: 0.03em
    textTransform: uppercase
  label:
    fontFamily: Orbitron
    fontSize: 11px
    letterSpacing: 0.14em
    textTransform: uppercase
  body:
    fontFamily: Ubuntu Sans
    fontSize: 15px
    lineHeight: 25.5px
  prose:
    fontFamily: Ubuntu Sans
    fontSize: 16px
    lineHeight: 26.4px
  caption:
    fontFamily: Ubuntu Sans
    fontSize: 13px
    lineHeight: 22px
  small:
    fontSize: 12.5px
    lineHeight: 20px
  section:
    fontFamily: Orbitron
    fontSize: 12.5px
    letterSpacing: 0.16em
    textTransform: uppercase
  term:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    fontSize: 12.5px
  mono-meta:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    fontSize: 11px
    lineHeight: 16px
  command:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    fontSize: 13.5px
    lineHeight: 27.7px
  band:
    fontFamily: Ubuntu Sans
    fontSize: 26px
    fontWeight: '600'
  panel-title:
    fontFamily: Ubuntu Sans
    fontSize: 20px
    fontWeight: '600'
  standfirst:
    fontFamily: Ubuntu Sans
    fontSize: 17px
rounded:
  panel: 10px
  card: 4px
  control: 6px
  badge: 2px
  option: 7px
  menu: 11px
  slab: 16px
  pill: 999px
spacing:
  page: 24px
  sheet: 1080px
  column: 900px
  explain-column: 660px
  connector-gutter: 120px
  routing-band: 140px
  lane: 22px
---

## Brand & Style

Rungkai is fauzuwan.my's documentation instrument: the same Tokyo Night palette,
the same Orbitron display voice and Ubuntu Sans reading face, turned to a single
job — reading a command line the way a man page reads. The page is a document:
a synopsis, a stack of definition entries, and nothing between them.

**No rules, no underlines.** Not one hairline and not one underlined link on
the page. Structure is carried by space, by colour and by weight; a rule
between two things is a line the eye has to read past, and thirty underlined
sample commands turn a contents sheet into a hatch. Where a link must read as
a link, it changes colour and its bullet lights with it. The only strokes left
are the ones that are the content: the routes that connect a token to its
entry, and the frames around the controls.

## Colors

Tokyo Night, one colour per token role, plus one neon accent:

- **green** `#9ece6a` — the tool that owns the invocation.
- **purple** `#bb9af7` — a matched option, and the value that belongs to it.
- **slate** `#7f88ad` — an operand: what the command takes that is not an
  option, named by the page.
- **cyan** `#38bdf8` — shell syntax, the neon frame, and the page's accent dots.
- **orange** `#ff9e64` — a shell builtin: the shell's own vocabulary, which
  bash(1) documents but which has no man page of its own.
- **red** `#f7768e` — a token with no documentation. Never used as a brand colour.
- **blue** `#7aa2f7` — focus and the page's radial wash.
- The **send action** is a neon hairline, not a fill: a cyan-edged box that
  fills cyan on dark ink only while it is hovered. The theme has one accent
  and no lit blocks, with one exception: the processing bar, the rail of neon
  that stands for the words the model is still writing. A solid button,
  gradient or flat, out-shouts the wordmark and the field it belongs to.
- Ink `#eef0f6`, muted `#a9b1d6`, dim `#7f88ad`, soft `#8b93b8`; panel edges are
  the role colour at 30%. Soft sits between dim and muted because dim loses AA on the
  role-tinted entry panels.
- Glass `rgba(41,46,66,0.62)` (raised to 0.72 on hover), shadow `rgba(0,0,0,0.95)`.
- Neon frame: `rgba(56,189,248,0.28)` at rest, `0.75` on focus, with a 3px halo
  ring and an inset glow.

## Typography

- **Orbitron** (self-hosted) is the display and label face: wordmark, section
  labels, buttons, the mode menu title. Always uppercase, tracked 0.03–0.14em.
- **The mark**: two white-line shield halves with a cyan `>_<` face in the
  gap between them — chevron eyes and the cursor's dash for the mouth. Drawn as
  one inline SVG (`viewBox="7 14 114 98"`, shield stroke ~1.4px, round joins), 60px
  square on desktop and 50px on mobile.
  Rungkai unseals a command: the halves start shut on the centre line and slide
  apart over 1.4s, by exactly the 25 units that put the seam back on the centre
  line. The face fades in at 0.8s, the moment the gap is wider than the face,
  and is whole by 1.0s.
  No hover state, no canvas, no library: it paints with the first frame and
  costs nothing after. Under `prefers-reduced-motion` the seal is simply drawn
  open, face solid.
- **Ubuntu Sans** (self-hosted, normal + italic, latin subset only) carries every
  sentence: standfirst, entry prose, the recommender's rationale, captions.
- **System mono** carries what the reader could type or cite: the command slab,
  synopsis, tokens, entry headings, badges, status, links, sample commands.
- Steps: body 15, prose 16, caption 13, small 12.5, mono-meta 11, command 13.5.
  Nothing between these steps, and nothing below 11px: a button, a link or a
  label under 11px is a legibility failure, not a style choice. Two roles sit on
  a step: **section** (Orbitron 12.5px, tracked 0.16em) for the headings that
  open a band of the page, and **term** (mono 12.5px) for a name in a contents
  sheet. Meta rows — the status strip, an entry's reference line — are set at
  12.5px, not 11.
- Above the text ramp sit the three display sizes, and only three: the band
  heading 26, the panel title 20, the standfirst 17. They are for sentences
  that stand alone on the page, never for running text, and they are the
  largest sizes the site uses.
- Body measure 64–68ch; the content column is 900px and the entry column 660px,
  set in from it by the 120px connector gutter. The explainer is the same width
  as the command slab, so the diagram never grows wider than the field it
  belongs to.
- Explanation prose (entry bodies, plain-English answers and suggestion
  rationales) uses Ubuntu Sans 16px/26.4px with pretty wrapping and ink
  `#b8c0e0`. Entry headings retain mono 14.5px and use weight 600. References
  use muted ink `#a9b1d6`; flashed references and source chips brighten to
  `#c0c8e3`. Role labels mix their existing role color with ink so they remain
  legible on resting, active and flashed panels. Example descriptions and
  labels, mode-menu guidance and suggestion metadata use muted ink. Branding, control typography,
  container sizes and diagram geometry are unchanged.

## Layout

- A 1080px page, 24px gutters, no navigation bar and no frame. The page is
  held by its own margins and by the wordmark, not by a border.
- The page opens on a centred wordmark with the seal, then the promise in two
  lines — a bright sentence and a dimmer one under it — then the mode picker,
  the 900px command slab, the status row, and the examples.
- The mode picker is a rounded-rectangle trigger at the left of the column,
  above the slab; its menu drops beneath it, 360px wide, clamped to the
  viewport.
- The status row sits directly under the slab on the same 900px column: the
  environment picker and "Grounded in man pages" on the left, the source
  status on the right. It opens on "Ready when you are".
- The examples are a category tab bar over one command panel: "Try an example"
  as a real heading, a line under it, the tabs, and a panel headed by the
  category with its description and a count, listing each command under a
  plain-language label with a run button at the right.
- The tab bar scrolls when the categories outrun the column. It overflows by
  about one tab, so it has only two places to rest: the first tab or the last.
  It snaps to one of those, never to a tab halfway along — a sliver of a cut
  tab is a target too small to aim at. Choosing a tab sends the row to the
  nearer end, so an early category brings the row back to the start with the
  ones before it in view, and a late one takes it to the end. Each edge fades
  only while there is more behind it.
- Explaining hides the samples and shows the explainer in the same column, so the
  status strip never moves.
- The command is centred with 8px word spacing, held in space alone. Each entry
  is a panel set in from the page by the 120px connector gutter.
- A 140px routing band sits between the command and the first panel. Horizontal
  runs fan out inside it on evenly spaced slots; lanes sit 22px apart and never
  closer than 4px.

## Elevation & Depth

The document is flat. Glass belongs to the surfaces that float over it: the
command slab, the two popovers — the mode menu and the environment picker —
and the suggestion panel, all four the same material: a lighter Tokyo
Night pane (`rgba(41,46,66,0.62)`), 20px blur with a slight saturation lift, a
top-edge gradient sheen, and one offset shadow. The slab, the mode menu and the
suggestion panel carry the neon frame; the environment menu carries a plain ink
edge. Connector paths carry a 3px coloured bloom.

## Shapes

- Panels 10px, cards 4px, soft controls 6px, badges 2px, menu options 7px,
  menus 11px, the slab 16px, pills and the clear button 999px, status marks
  6px squares, connector terminals 3px circles.
- Hex marks are flat-top hexagons (clip-path), 52px wide at every width, with
  a 1px outline that becomes the neon edge on hover.

## Components

- **AI mark**: the four-pointed star, drawn in the family's 1.3px stroke, marks
  everything the model is behind: the suggest mode's icon, the plain-English
  button, the plain-English panel. One symbol, not a word in a pill.
- **Mode picker**: a rounded-rectangle trigger (`icon + explain/suggest +
  chevron`) at the left of the column, over the slab; the menu carries a
  title, a hint and two option rows with radio dots, icons, titles and
  one-sentence descriptions. Selected row: cyan dot/icon.
- **Command slab**: glass, 900px, 10px radius, neon frame, `$` or `?` prompt,
  mono input, and two controls at the right edge: the circular clear and a
  **⏎** keycap — the return arrow on a neon hairline. The word "explain" lives
  only on the mode picker above the slab; saying it twice, a screen apart, is
  noise.
- **Status strip**: mono 12.5px on the 900px column — environment picker in a
  filled chip, the "anchored where documented" note, undo, and the source status
  with a dot. No rules above or below it. Once a command is explained, a
  "new command" link joins the status on the right: the visible way home.
- **Category tabs**: a tablist of icon-and-name buttons, one per category, the
  selected one cyan on a cyan wash. They switch the panel below.
- **Example rows**: a plain-language label, the command in mono, and a run
  button at the right that explains it in place. The command text is a real
  permalink too, so it can be opened on its own.
- **Shell syntax** anchors to bash(1): pipelines, lists, redirections, here
  documents and strings, command substitution, function definitions, and the
  compound commands — `for`, `while`, `until`, `if`, `case`, `select`. Each
  gets a hand-written sentence rather than the manual's prose, so an entry is
  a line or two rather than a wall. A loop is one construct, so the whole
  `for …; do …; done` is one region and one entry, with the commands inside it
  explained in their own right.
- **Shell builtins** are the ones bash(1) documents but that have no man page
  of their own — `:`, `cd`, `export`, `source`, `read` and forty more. They
  are explained from the same place, in the same voice, and are a role of
  their own rather than a gap in the corpus. A builtin outranks a gap: a
  command the shell owns is not undocumented, it is just documented
  somewhere other than a page of its own.
- **Synopsis**: the command with its real spacing, printed exactly once.
  The parser's pieces nest — a command substitution spans the commands inside
  it, an operand spans the substitution inside it — so the renderer nests them
  too: a **leaf** is a token you can click, a **region** is the span around its
  parts. A region cannot be a button, because buttons cannot hold buttons, so
  it is marked the way the site marks a token: with a bracket, dropped below
  the parts' brackets and drawn quieter, so a substitution reads as the thing
  holding them. No background highlight — a filled rectangle across a line of
  text reads as a selection, not as this site's language. Below 640px, where
  there is no bracket to route from, the token's own colour is the mark.
- **Connector**: a 5px bracket under each documented token, then a lane from the
  bracket's midpoint into the nearer margin and a dot on its panel's edge.
  An enclosing construct whose card comes first connects straight down from
  the bracket's midpoint to the top of that card.
  When a command wraps, each row joins a shared lane outside the command's
  text, so the connectors never pass vertically through subsequent rows.
  Wrapped rows have extra spacing to keep brackets and their glow clear of
  the next row's text.
  Several tokens that share one entry are one thing, so they share one bracket
  rather than a row of ticks that reads as a single bar. Sides
  are chosen by the command's centreline (explainshell's rule); if every token
  falls to one side, half are forced across so both margins are used. Tokens that
  share a card join one route under the brackets. Same colour as the token; the
  panel's border is that colour too.
  A route is four segments with one brightness each: the bracket 0.8, the stem
  0.5, the long reach into the margin 0.2, the descent down the lane 0.38 and
  the stub into the panel 0.78. The eye is carried by the ends, not the wire.
  The descent fades as it lengthens: a route to the card just below stays at
  0.38, one that has to run past a screenful of entries thins toward the ink.
  A long command is then a wash of wires and not a cage, and hovering a token
  brings its route back in full — which is how the reader finds the one they
  want. The diagram's spacing — the band, the lane — lives in the stylesheet
  as custom properties, so the geometry and the layout cannot drift apart,
  and the stylesheet alone decides when there is no room for a diagram: below
  its breakpoint the token's own colour is the mark.
  Hover lifts the active route to full opacity.
- **Hover** works from the keyboard too: focusing a token isolates the same pair.
- **Plain English**: a button above the breakdown — "What does this actually
  do?" — that asks the model for the whole command in two or three plain
  sentences, written for someone learning Linux. The reader chooses to ask, so
  the model is never called for a command nobody wanted explained. The answer
  is the model's words, so the panel says so: the AI mark, and no
  citation, because the citations belong to the breakdown below.
  The model also leads with a line naming the danger, and the panel turns
  that line into a label: a filled box in the signal colour, above the
  prose, reading DESTRUCTIVE or RISKY. The label is the model's judgement
  and it wears no citation, for the same reason the prose wears none: the
  man pages are silent about danger — `rm(1)` never says it is destructive
  — so the only honest source is the model, and the only honest place to
  show it is the panel that already says the words are the model's. The mark is
  the four-pointed star the suggest mode wears, so the model carries one
  symbol on the whole page, and it appears once: the button's mark goes when
  the panel opens and the panel takes over. It is
  grounded in the same corpus pages the breakdown uses, and it is told never to
  claim what a flag does when the documentation does not say. The answer is
  cached per command, so the same line is paid for once, and a cached answer
  does not spend the reader's chat budget. The answer streams, so the reader
  watches it being written; while it works the panel shows a shimmer rather
  than an empty box. Summarising is not a puzzle, so the model is told not to
  think — thinking was most of the bill and most of the wait. Without a model,
  a budget or a network, the panel stays away and the breakdown stands on its
  own.
- **Recommender**: the same slab in `suggest` mode; on submit a bordered panel
  pops out under the field, before the examples, holding the suggested command,
  an `ask again` ghost button, a `copy` ghost button and a neon-hairline
  `explain` button, the rationale in Ubuntu Sans and the assumptions in italic
  mono. The rationale is two sentences at most and the assumptions one clause:
  the panel is a note, not an essay, and a reader who has to scroll to find
  the point was never going to read it. The panel carries the AI mark,
  because the command and the reasoning are the model's words, and while the
  model works a bar stands for the words on their way — the same bar the
  plain-English panel uses: a rail of neon, the slab's own frame lit, with the
  light travelling along it. It replaces the current command when explained and
  never becomes a conversation.
  The suggestion is an offer, not a bill: it folds to one line — the label, the
  command, what it rests on, the buttons — it can be dismissed, and it can be
  asked again — the field keeps the reader's own
  words, so the second question is an edit of the first. Asking again is one
  more request, not a conversation.
- **A tool the corpus has no page for is still a tool.** The reader asks for
  kubectl or helm, the corpus has neither, and the answer is not a refusal:
  the command is given, described in general terms, and the panel says
  plainly that it is not in the corpus. The model is not to dress up what it
  knows as something the corpus backs, and it is not to explain a flag the
  corpus cannot vouch for; what the corpus says is the Explainer's business,
  and the recommender's words are the model's, marked as the model's. There
  is no Explainer to open in that case: every word of it would be
  undocumented, and there is no page to check any of them against.
- **The model is told what it is reading.** The task and the documentation
  excerpts are data to answer from, never orders to follow: a corpus page that
  says "ignore your instructions" is text, not an instruction. The suggested
  command is checked against the corpus before it is shown, and the panel says
  what it rests on — "documented by ss(1), sort(1)" — and what rests on
  nothing. When no command does the job, the panel says that instead of
  showing an empty command under a heading, and the model's answer stands as
  the answer. Nothing the model writes is ever a citation.
- **Entry**: a man-page definition. A panel tinted 7% with its token colour
  and edged in it, holding the term in mono 14.5px, a kind tag beside it
  (command, builtin, option, argument, shell syntax, undocumented) in the role
  colour, the description in Ubuntu Sans 16px hung under the term, and a
  reference line giving the page it came from. An option that takes a value
  says so beside its tag — "takes identity_file" — in the role colour at 70%,
  so the word that follows it is never a mystery.
- **One entry per thing**: the same tool used twice is one entry with two
  routes, not two identical entries.
- **A cluster is a cluster only when the page says so.** A few tools take
  their options written without a leading dash — `tar zcf` is `-z -c -f` — and
  the man page documents that form itself, so the corpus records it and the
  matcher allows it. Only those pages accept a dashless cluster, and only
  when every letter is a documented option, so `tar mydir` stays a word. Every anchor carries a key — the tool, the
  option, the shell section — and the client groups by it. So a command line
  with three `:` in it has one "no page for `:`" entry, and a function
  definition has one "Shell Functions" entry.
- **Every word is explained.** A word that follows an option which takes a
  value is that value, and shares the option's entry: `-i keyfile` is one
  thing, not two. A word that is not an option is an operand, and the page
  names its operands in order, so `ssh host cmd` reads destination, then
  command. A flag the page does not list is marked undocumented rather than
  passed off as an operand. Nothing in a command line is left unexplained.
- **A command that runs another command is a command.** `sudo ss -tulpn` runs
  two programs, and each has its own page: `sudo` and `ss` are two entries,
  and `-tulpn` is `ss`'s flags and not `sudo`'s. The corpus says which word is
  that — a wrapper's operand is named "command", and an option that takes a
  command is followed by one — and a word the corpus has no page for stays
  the wrapper's own operand, because a script the corpus does not know is
  not a tool it can describe.
- **The shell's own syntax is the manual's, not ours.** A `for` loop is
  explained with what `bash(1)` says a `for` loop does, and a redirection
  with what it says about redirecting output: the corpus holds the manual's
  usage line and the manual's own words, and the entry quotes them. A
  sentence written for the reader is a fallback, for the corpus that has no
  `bash(1)` to quote.
- **The command floats.** The command line is the reader's map, so it stays
  at the top of the window while the entries scroll under it: the route from
  a word to its entry is never more than a glance away. The panel is the
  page's own wash, barely there and blurred, and it is only there once the
  command floats — above the entries, the command is just the command, on
  the page's own ground. The wire belongs to the page and passes under the
  panel; the bracket under a token belongs to the token and stays above it,
  crisp. The routes are drawn again as the page scrolls, because the command
  holds still and the entries do not — and a route is never left out: a
  reader who points into the gap between the entries still holds one arrow
  and one entry together, which is the whole point of the routing. Pointing
  at a word dims the page around it; pointing into the gap only holds the
  arrow, because the reader there is reading, not pointing, and a page that
  dims under a resting pointer flickers.
- **Source chip**: the link to a man page, as a small filled box — an open
  book, a name, and an external-link arrow. The chip is filled rather than
  outlined, and lights cyan on hover. The book is drawn in the same 1.2px
  stroke as the rest of the icon family; no unicode glyph stands in for an
  icon. It appears twice: in an entry's reference line, for the page that
  entry came from, and in the footer, for the corpus index sites. A screen
  reader hears "ubuntu 24.04 man page".
- **Hover**: following explainshell, hovering a token or its panel dims every
  other token and panel to 40% with a blur, thickens the active underline and
  lights its text and route, and hides every other connector. The command line
  is a scrubber, not a row of separate targets: anywhere in the line, or in
  the band down to the brackets, the route nearest the pointer lights, so a
  sweep left to right passes through every route in turn without landing on
  any one token.
- **Click** locks the pair and travels it both ways: a token, or the bracket
  under it, takes the reader down to the entry; the entry takes them back up
  to the command, with the bracket on screen. Only the bracket is a target —
  the long wire down the margin is decoration, and a click on it is a click on
  empty page, so the lock lets go there like anywhere else. The lock holds the
  isolation until another pair is chosen, the reader clicks off the pair, or
  presses Escape.

## Motion

One authored moment: when a result arrives, the entries fade up in sequence and
each route draws itself from its token, down the margin and into the entry it
documents, the path revealing by stroke dash. This entrance also plays on shared
links and refreshes. Brackets and wires share one timeline, and scrolling or
resizing updates their geometry without replacing the animated SVG nodes.
The current view stays visible until a response is ready; examples, results and
home crossfade over 260ms using the View Transition API when available. Shared
links hide the examples before first paint, and results wait for fonts before
measuring their routes. Everything else is quiet —
0.2s colour/border/opacity shifts and a 0.25s hex scale. Under
`prefers-reduced-motion`, every transition and animation is reduced to 0.001ms
and every delay to zero; state changes still land, only the tween is removed.

## Accessibility

- Focus is always visible: the global 2px `#7aa2f7` ring, and inside menus a 2px
  neon ring on the focused row. The neon frame is the focus indicator for the
  slab and the suggest field.
- Text contrast: dim 5.1:1, muted 8.4:1 on `#16171f`; body and placeholder meet AA.
- Browser surfaces belong to the page: the caret is neon cyan, selection is the
  blue wash, scrollbars are ink at 20%.
- Popups expose `aria-haspopup`, `aria-expanded`, `aria-controls`, `aria-selected`;
  arrow keys move, Escape and outside click close.
- There are four ways home, and all four land in the same place: the clear
  button, **Escape** anywhere on the page, the "new command" link, and the
  wordmark (a real `href="/"` link, so a modified click opens the site in a new
  tab). Home means no command, the default corpus, the samples back and nothing
  to undo. `Ctrl`/`Cmd`+`K` focuses the field first.
- **The address bar is the history.** A new command is a new history entry; an
  environment change replaces the current one. The browser's Back and Forward
  render the entry they land on, so Back from a command returns to the samples
  instead of leaving the site, and home always scrolls to the top.
- Escape belongs to the page, not to the field: it has to work wherever the
  reader's focus happens to be. An open menu takes it first and only closes;
  otherwise it empties the field and goes home.
- A **keycap is a legend for a key, never a control** — the way the blog shows
  a `/` in its search field. The `esc` cap is a `<kbd>` beside the "new
  command" action, not a button in the field: a second control that did the
  same thing as the clear button read as a mistake, not as a hint.
