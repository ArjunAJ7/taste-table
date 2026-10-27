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

## Test it (judges)
1. `git clone https://github.com/ArjunAJ7/taste-table && cd taste-table`
2. `export QLOO_API_KEY=<your Qloo hackathon key>` (the server reads it from the environment only)
3. `npm start` (or `docker build -t taste-table . && docker run -e QLOO_API_KEY -p 3000:3000 taste-table`)
4. Open http://localhost:3000, add 2-4 people with a few favorite artists each, pick a goal (e.g. Movies), and press Find consensus.
Expected: ranked picks with a per-pick note naming the weakest match among the group.
