# No vector database: candidate-restricted embeddings

Vectorize's Free plan bills queried dimensions as `(vectors in index + queries)
× dimensions`, so a man-page Corpus is usable for roughly a handful of queries
per month. Instead, `bge-small-en-v1.5` embeddings are stored beside each Corpus
page in R2, and each turn embeds the question and runs cosine only over the
pages of the tools named in the current one-liner.

The candidate set is the right retrieval unit anyway: a follow-up question is
about this command, not the 50,000 chunks of the whole Corpus. If a future
feature needs cross-Corpus semantic search, this decision is the one to revisit.
