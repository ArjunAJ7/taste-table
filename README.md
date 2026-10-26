# Taste Table

Group taste-consensus agent built on Qloo's taste graph (Qloo Agentic Hackathon).

Each person lists a few favorite artists. The server resolves them to Qloo entities (`/search`), asks Qloo for per-person recommendations seeded by those favorites (`/v2/insights`), and ranks candidates with a maximin rule: a pick is only as good as the least-happy person's affinity. Each pick explains who is the weakest match.

## Run
    export QLOO_API_KEY=...   # event-issued key; never commit it
    node server.js            # Node 18+, no dependencies

Only favorite names are sent to Qloo, never personal data. Results are aggregate affinities, not facts about a person. Qloo responses are cached in memory only, never stored in this repo.

## Limits
Affinities come from artist seeds only. Places need a city. Results do not establish what any individual will enjoy.

License: MIT
