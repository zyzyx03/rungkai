# The server stores no commands and no history

There are no accounts, no conversation storage and no database. A permalink
carries the one-liner and Target environment in the URL, and the only
server-side state is a global daily budget counter in a Durable Object.

Pasted commands routinely contain tokens, hostnames and paths, and this product
cannot promise to redact them. Not retaining them is a promise we can keep;
the Durable Object holds money, not content.
