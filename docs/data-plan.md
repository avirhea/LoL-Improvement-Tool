# LoL Draft Assistant Data Plan

## Goals

The data layer should support practical draft recommendations without relying on unofficial third-party matchup statistics. It should combine Riot-provided static data, Riot API match samples, optional player history, and curated draft knowledge.

## Current Data State

The current prototype uses seeded static champion profiles in `lib/champions.ts`. These profiles include champion names, roles, tags/traits, rough role meta scores, risk notes, and explanation hooks for a small champion pool.

Current freshness values are intentionally labeled as prototype data:

- `dataDragonVersion`: `seeded-static-v0`
- `statsPatch`: `heuristic-pre-ingestion`
- `sampleWindowDays`: `0`

No Riot API, Data Dragon, match ingestion, database, or embedding index is implemented yet.

## Data Sources

### Riot Data Dragon

Use Data Dragon for:

- Champion names, ids, keys, titles, tags, stats, spells, and passive data.
- Champion images and loading assets.
- Patch/version metadata through the versions and realms files.

Data Dragon is patch-based and may not update immediately after a live patch. Recommendation responses should show the Data Dragon version used.

Next implementation step:

- Add a static sync script that downloads the current champion summary and individual champion files, then replaces or augments the seeded champion list.

### Riot APIs

Use Riot APIs for:

- Riot ID to PUUID lookup through Account-V1.
- Summoner profile lookup by PUUID where needed.
- Match history through Match-V5.
- Ranked/player context where available and useful.
- Long-term match sample collection for feature building.

Use platform routing for platform-specific endpoints such as `na1.api.riotgames.com`, and regional routing for endpoints such as Match-V5 and Account-V1, for example `americas.api.riotgames.com`.

### Curated Knowledge

Maintain human-readable champion and draft notes for retrieval:

- Champion identity and common role expectations.
- Draft strengths and weaknesses.
- Team-comp concepts such as engage, disengage, poke, dive, scaling, split push, frontline, damage mix, and crowd control.
- Common caveats for new/intermediate players.

Curated notes should be versioned and refreshed when patches materially change champions.

## Core Entities

- `Champion`: canonical Riot champion id, display name, aliases, tags, roles, assets, and patch version.
- `Patch`: Data Dragon version, effective date if known, and sync timestamps.
- `MatchSample`: match id, queue, patch, region, champion picks, roles, result, and selected aggregate-safe stats.
- `ChampionFeature`: role fit, matchup aggregates, meta strength, team-fit attributes, and sample counts.
- `PlayerProfile`: PUUID, region, champion history, recent roles, mastery-like signals, and freshness.
- `KnowledgeDocument`: curated champion or draft note, source, patch applicability, embedding id, and freshness.

## Match Sampling Strategy

The first data collection target is Summoner's Rift ranked games. Sampling should prioritize recent patches and enough role-labeled matches to support stable aggregate features.

Initial approach:

- Start with one platform region, likely `na1`, and one regional route, likely `americas`.
- Collect match ids from known seed players and expand through recent ranked histories.
- Filter to ranked Summoner's Rift queues.
- Parse participant champion, inferred/declared role, team composition, enemy lane opponent where reliable, result, and patch.
- Aggregate by patch and role.

The system should keep sample counts alongside every aggregate. Sparse aggregates should lower confidence rather than silently pretending to be reliable.

## Personalization Inputs

Personalization is optional. When Riot ID is provided:

1. Resolve `gameName` and `tagLine` to PUUID through Account-V1.
2. Fetch recent match history for that PUUID.
3. Build lightweight player comfort features:
   - recent champion usage
   - historical champion usage
   - role frequency
   - recent performance proxies where available
   - champion mastery-like confidence when available
4. Cache derived features with a freshness timestamp.

The recommender should never require personalization. If player data is missing, rate-limited, or unavailable, return general recommendations with `playerComfort` omitted.

Current prototype behavior:

- Riot ID fields can be entered in the UI.
- No Riot API lookup is performed.
- The recommender uses a placeholder comfort estimate based on champion difficulty and marks the response as personalized.
- This is a UI/API contract placeholder only and must be replaced before claiming real personalization.

## Refresh Jobs

### Static Champion Sync

Cadence: daily or on demand during development.

Steps:

- Fetch latest Data Dragon versions.
- Compare with stored version.
- Download champion summary and individual champion files.
- Update champion metadata and assets.
- Record sync timestamp and version.

### Match Ingestion

Cadence: scheduled in production, manual during early development.

Steps:

- Select seed PUUIDs.
- Fetch recent ranked match ids.
- Fetch match details.
- Deduplicate by match id.
- Store normalized samples.
- Track Riot API rate-limit responses and retry windows.

### Feature Build

Cadence: after ingestion or on a schedule.

Steps:

- Build role-specific champion pick/win/sample aggregates.
- Build matchup aggregates when lane/opponent inference is reliable.
- Build team-comp attributes from champion tags and observed outcomes.
- Store feature freshness and sample counts.

### Retrieval Refresh

Cadence: when curated docs or embedding provider changes.

Steps:

- Chunk curated notes.
- Generate embeddings through the provider abstraction.
- Store embedding metadata and source version.
- Rebuild or update vector index.

## Rate Limits And Failures

- Centralize Riot API calls in a server-side client.
- Respect `429` responses and retry headers.
- Cache stable Data Dragon responses aggressively.
- Cache player-derived features for a short window to avoid repeated Riot API calls.
- Preserve partial functionality when Riot APIs fail.
- Surface freshness and confidence to users instead of failing silently.

## Data Freshness In Responses

Every recommendation response should include:

- Data Dragon version.
- Stats patch or patch range.
- Match sample window.
- Last feature build timestamp.
- Whether personalization was used.
- Whether any fallback mode was active.

## Compliance Notes

- Do not expose Riot API keys in client code.
- Do not scrape unofficial third-party stats for v1.
- Do not create hidden-player analysis or game-session-specific hidden information.
- Register the app with Riot before serving players publicly, if required by Riot policy.
