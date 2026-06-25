# LoL Draft Assistant

A League of Legends draft recommendation tool for new and intermediate Summoner's Rift ranked players. Enter the visible draft state and get ranked champion recommendations with score breakdowns, risks, confidence levels, and data freshness metadata.

## Current State

**Implemented:**

- Next.js web app with manual draft input (role, allied picks, enemy picks, bans, champion pool filter).
- `POST /api/recommendations` route with request validation.
- Deterministic TypeScript scoring engine: role fit, matchup, team fit, enemy fit, meta strength, and player comfort.
- Full champion roster (173 champions) synced from Riot Data Dragon.
- Real player-history personalization via Riot ID — resolves Riot ID to PUUID, fetches recent ranked matches, and uses champion usage to score player comfort.
- Match ingestion scripts to collect ranked Summoner's Rift samples and build aggregate feature data.
- Score breakdowns, explanations, risks, confidence, draft notes, and freshness metadata in every response.


## Run Locally

Install dependencies:

```powershell
npm install
```

Create `.env.local` in the project root:

```
RIOT_API_KEY=your-riot-api-key-here
```

Start the dev server:

```powershell
npm run dev
```

Open `http://localhost:3000`.

> **Note:** On Windows, if `npm` is blocked by PowerShell execution policy, use `npm.cmd` instead.

## Data Scripts

### Sync champion roster from Data Dragon

Fetches all 173+ champions from the current patch and rewrites `lib/champions.ts`. Run whenever a new patch ships.

```powershell
npm run sync:champions
```

### Collect match samples

Accepts one or more Riot IDs. Fetches their recent ranked match history and saves normalized samples to `data/matches/`. Safe to re-run — already-saved matches are skipped.

```powershell
npm run ingest -- "PlayerName#NA1" "AnotherPlayer#NA1"
```

### Build aggregate features

Reads `data/matches/` and writes `data/features.json` with per-champion, per-role win rates. The recommender loads this at startup and uses real win rates as meta strength scores.

```powershell
npm run build:features
```

> Riot development API keys rotate every 24 hours. Update `RIOT_API_KEY` in `.env.local` if you see 403 errors.

## Validation

```powershell
npm run typecheck
npm run lint
npm run test:recommender
npm run build
```

## Personalization

Check "Include optional Riot ID fields" in the UI and enter a game name and tag line. The API resolves the Riot ID to a PUUID, fetches the player's last 10 ranked matches, and includes a real `playerComfort` score in each recommendation based on recent champion usage. If the Riot API is unavailable, the response degrades to anonymous recommendations without an error.

## Documentation

- [Product spec](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Data plan](docs/data-plan.md)
- [Recommender design](docs/recommender-design.md)
- [Roadmap](docs/roadmap.md)

---

> LoL Draft Assistant is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
