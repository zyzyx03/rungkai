# Corpora are per Target environment

Each Target environment has its own Corpus built from that release's man pages,
and an Anchor resolves only inside the selected Corpus. `all` answers from the
best matching Corpus and labels the source on every Anchor.

macOS was dropped: Apple publishes no complete, redistributable man-page set,
so it would have shipped with silent holes. When a BSD Corpus is added, FreeBSD is the only
complete redistributable option (BSD-2-Clause), labelled FreeBSD, not macOS. Ubuntu 24.04 is the only
Corpus in v1.
