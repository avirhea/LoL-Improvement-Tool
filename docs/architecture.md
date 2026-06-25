# LoL Draft Assistant Architecture

## System Shape

The current prototype is a Next.js web application with an App Router API route for recommendation scoring. The planned production shape is a Next.js frontend plus a Python ML/data layer. The frontend owns draft entry and recommendation presentation. Backend services own Riot API access, recommendation scoring, data freshness, retrieval, and future LLM calls.

Secrets, Riot API keys, and LLM provider keys must remain server-side.

## Current Implementation

Implemented now:

- `app/page.tsx`: manual draft input and recommendation result UI.
- `app/api/recommendations/route.ts`: recommendation API and basic request validation.
- `lib/recommender.ts`: deterministic TypeScript scoring engine.
- `lib/champions.ts`: seeded champion trait profiles and prototype freshness metadata.
- `scripts/test-recommender.ts`: smoke test for the scorer.

The current API does not call Riot APIs, Data Dragon, a database, a vector store, or an LLM provider.

## Components

### Next.js Web App

Responsibilities:

- Manual draft input UI for role, allied picks, enemy picks, optional bans, optional Riot ID, and optional champion pool constraints.
- Recommendation result UI with ranked champions, score breakdowns, explanations, risks, confidence, and freshness.
- Client-side validation for valid roles, duplicate champions, and banned/picked conflicts.
- Calls only the backend API. It must not call Riot APIs directly.

### API Service

Responsibilities:

- Validate draft requests.
- Resolve optional Riot ID to PUUID using Riot APIs.
- Fetch or read cached player signals when personalization is requested.
- Run deterministic recommendation scoring.
- Retrieve relevant champion and draft notes.
- Call the provider-agnostic LLM interface to produce explanation text.
- Return recommendation responses with component scores and freshness metadata.

In the current prototype, these responsibilities live in the Next.js API route and TypeScript recommender. Moving Riot ingestion, feature building, retrieval, and model-facing code into a Python service remains a planned architecture step once real data pipelines begin.

### Data Jobs

Responsibilities:

- Sync champion/static data from Data Dragon.
- Collect match samples from Riot APIs for Summoner's Rift ranked queues.
- Build matchup, team-fit, role-fit, and meta-strength features.
- Refresh retrieval documents and embeddings for champion/draft notes.
- Track data freshness by patch, ingestion time, and sample window.

### Storage

The current prototype has no database or vector store; it reads seeded champion data from TypeScript modules. The future production data layer should use a relational database for structured entities and a vector index for retrieval. A local development setup can start with Postgres plus pgvector or a lightweight equivalent, as long as the application code keeps storage access behind repository interfaces.

Core data domains:

- Champion metadata and role eligibility.
- Patch/version metadata.
- Match samples and aggregate features.
- Optional player profile signals keyed by PUUID.
- Curated champion and draft knowledge documents.
- Embeddings and retrieval metadata.

## API Boundary

The frontend should call a single recommendation endpoint for the MVP:

`POST /api/recommendations`

Request:

```json
{
  "role": "top",
  "alliedPicks": ["Jinx", "Lulu"],
  "enemyPicks": ["Darius", "Sejuani"],
  "bans": ["Fiora"],
  "championPool": ["Ornn", "Malphite", "Gwen"],
  "riotId": {
    "gameName": "ExampleName",
    "tagLine": "NA1",
    "region": "na1"
  }
}
```

Response:

```json
{
  "recommendations": [
    {
      "champion": "Ornn",
      "title": "The Fire below the Mountain",
      "roles": ["top"],
      "totalScore": 0.82,
      "components": {
        "matchup": 0.72,
        "teamFit": 0.91,
        "enemyFit": 0.68,
        "metaStrength": 0.76,
        "roleFit": 0.95,
        "playerComfort": 0.66
      },
      "confidence": "medium",
      "explanation": "Ornn gives your team frontline and engage while staying useful if lane is difficult.",
      "risks": ["Can be pressured early by lane bullies", "Requires team follow-up on engages"],
      "tags": ["engage", "frontline", "scaling", "safeBlind"]
    }
  ],
  "freshness": {
    "dataDragonVersion": "seeded-static-v0",
    "statsPatch": "heuristic-pre-ingestion",
    "sampleWindowDays": 0,
    "generatedAt": "2026-06-25T00:00:00Z",
    "personalizationUsed": false,
    "fallbackMode": false
  },
  "draftNotes": ["Detected allied traits: scaling, physical, peel, utility, magic."]
}
```

The backend may omit `playerComfort` when no Riot ID is provided or personalization data is unavailable.

## Recommendation Flow

1. Normalize and validate draft input.
2. Exclude already picked or banned champions.
3. Generate eligible candidates for the selected role.
4. Load current prototype features from seeded champion traits. Later, load global features for matchup, team fit, meta strength, and role fit.
5. Add placeholder player comfort if Riot ID fields are present. Later, add real player comfort features if Riot ID data is available.
6. Score and rank candidates deterministically.
7. Generate template explanations and risks. Later, retrieve relevant champion and draft notes for the top candidates.
8. Later, generate concise explanations through the LLM interface.
9. Return ranked recommendations with score components, risks, confidence, and freshness.

The deterministic ranking result should be available without the LLM so the system can be tested, debugged, and degraded gracefully.

## LLM And RAG Layer

The LLM layer should be provider-agnostic:

- `EmbeddingProvider`: turns curated notes into vectors.
- `Retriever`: returns relevant notes for a draft context and candidate champion.
- `CompletionProvider`: generates explanation text from structured scoring output and retrieved notes.

The LLM must not invent champion statistics. Prompts should provide structured scores, selected retrieved notes, and a strict output shape. If retrieval is weak or stale, explanations should use cautious language and rely on the deterministic score breakdown.

## Security And Privacy

- Riot API keys and LLM credentials live only in backend environment variables.
- The browser never receives raw API keys or privileged tokens.
- PUUID should be treated as stable player-identifying data.
- Store only the minimum player data needed for personalization.
- Allow anonymous usage without account linking.
- Log draft requests carefully; avoid storing Riot IDs in verbose application logs.

## Development Milestones

1. Done: documentation and repo scaffolding.
2. Done: manual draft UI using seeded champion data.
3. Done: deterministic recommendation endpoint with heuristic fallback features.
4. Next: Data Dragon sync and full champion roster.
5. Next: Riot API ingestion jobs and aggregate feature generation.
6. Next: optional Riot ID personalization backed by player history.
7. Later: RAG-backed explanation generation.
