# Anchored explanations, not model memory

Rungkai parses a one-liner and matches each invocation and argument to an entry
in a documentation Corpus; the model writes prose and answers follow-ups, but it
never supplies the base explanation. We chose this over retrieval-plus-freeform
chat because the audience checks flags, and an unanchored answer is
indistinguishable from a guess. A Change is re-parsed and re-anchored before it
is shown, so model output re-enters the same verification as user input.
