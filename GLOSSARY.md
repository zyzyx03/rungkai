# Rungkai

Rungkai is an AI-assisted command explainer: it breaks a shell one-liner into
its syntax and arguments, grounds each part in real documentation, and lets the
reader chat about the command or ask for it to be changed for their machine.

## Language

**Rungkai**:
This product — an explainer for shell commands. Not a shell, and not the command
being explained.
_Avoid_: shell, the tool

**Explainer**:
The read-only account of a one-liner: what each token is, what it does, and where
that claim comes from.
_Avoid_: help, documentation, docs

**One-liner**:
The unit Rungkai explains: a single line of shell input, which may contain
pipelines, redirections, substitutions, quoting and simple loops.
_Avoid_: snippet, script, command (when the whole line is meant)

**Tool**:
A program that a one-liner invokes and that Rungkai explains against its man
page.
_Avoid_: command, binary, program

**Invocation**:
One tool together with the arguments it is given; the unit that anchors attach
to.
_Avoid_: command, call

**Change**:
A new one-liner produced at the reader's request. It replaces the current one,
is re-anchored like any other, and the previous one stays one click away.
_Avoid_: rewrite, modification, edit, adaptation

**Gap**:
A Tool that has no page in the selected Corpus. Shown as a gap, never filled
with model prose.
_Avoid_: missing doc, error, unknown

**Anchor**:
The link between a span of the one-liner and the piece of documentation that
justifies what Rungkai says about it.
_Avoid_: citation, source, reference

**Corpus**:
The man pages for one Target environment, stored as plain documents. The only
thing Rungkai may anchor to.
_Avoid_: index, embeddings, knowledge base, dataset

**Index**:
A derived lookup over the Corpus that finds candidate passages for a model
request. Rebuildable from the Corpus; never a source of anchors.
_Avoid_: corpus, knowledge base, vector database

**Retrieval**:
Selecting passages from the Corpus to put in front of the model. Used by the
recommender only; the Explainer resolves anchors by direct lookup.
_Avoid_: RAG (as a word for the Corpus), search

**Target environment**:
The OS and version a reader picks from a fixed list (Ubuntu 22.04, Ubuntu 24.04,
macOS 15); it selects the corpus and so decides every anchor Rungkai can offer.
_Avoid_: profile, config, env, distro
