# LoL Draft Assistant Roadmap

## v0: Documentation And Prototype Foundation

Goal: establish a shared product and technical direction before building.

Status: complete.

Deliverables:

- Product spec.
- Architecture doc.
- Data plan.
- Recommender design.
- Roadmap.
- Initial repo scaffold for Next.js web app.
- Initial decision record that a Python ML/data service remains the planned shape for Riot ingestion, feature building, and future ML/RAG work.

Exit criteria:

- MVP user flow is clear.
- Draft input and recommendation response shapes are documented.
- Data source assumptions and Riot policy constraints are explicit.
- The recommender can be implemented without relying on the LLM for ranking.

## v1: Manual Draft Recommender

Goal: provide useful anonymous recommendations from manually entered draft state.

Status: prototype implemented, data-quality work remains.

Deliverables:

- Next.js draft input UI.
- Seeded champion data for the first prototype.
- Backend recommendation endpoint.
- Deterministic scoring with role fit, team fit, matchup, enemy fit, and early meta/fallback features.
- Template-based explanations.
- Data freshness display.

Exit criteria:

- User can enter role, allied picks, enemy picks, and bans.
- App returns 3-5 champion recommendations.
- Recommendations include component scores, confidence, risks, and freshness.
- Duplicate, picked, or banned champions are not recommended.
- System still works when draft input is incomplete.

Remaining v1 work:

- Replace seeded champion profiles with Data Dragon sync and full roster coverage.
- Improve champion aliases and validation against canonical champion ids.
- Add more realistic role and meta defaults before Riot match aggregation exists.
- Add UI polish from hands-on testing in real draft examples.

## v1.5: Optional Personalization

Goal: improve practical recommendations when the user provides Riot ID.

Status: not implemented. Current Riot ID fields are a UI/API placeholder only.

Deliverables:

- Server-side Riot ID to PUUID lookup.
- Player history ingestion and cached player comfort features.
- Recommendation scoring that includes optional player comfort.
- UI treatment that clearly shows whether personalization was used.
- Privacy-conscious logging and storage defaults.

Exit criteria:

- Anonymous usage remains fully supported.
- Personalized usage changes recommendations when player comfort is relevant.
- Riot API failures degrade to general recommendations.
- No Riot API keys or privileged calls appear in client code.

## v2: RAG-Backed Draft Coach

Goal: make explanations richer and more adaptive while keeping scoring grounded.

Status: not implemented.

Deliverables:

- Curated champion and draft knowledge base.
- Embedding/index refresh job.
- Provider-agnostic retrieval and completion interfaces.
- Explanation generation using structured scores plus retrieved notes.
- Follow-up prompts for ambiguous drafts or player preferences.

Exit criteria:

- Explanations cite draft-specific reasons and caveats.
- LLM output follows a strict recommendation explanation contract.
- Ranking remains deterministic and testable without the LLM.
- RAG fallback uses template explanations when retrieval or provider calls fail.

## v3: Evaluation And Coaching Depth

Goal: improve recommendation quality and help players learn from draft patterns.

Status: not implemented.

Potential deliverables:

- Offline backtesting dashboard.
- Player-facing draft review mode.
- Champion pool planning.
- Role-specific coaching notes.
- Patch-change impact summaries.
- Team-comp identity detection.
- Safer multi-turn "draft coach" conversation that asks clarifying questions only when helpful.

## Deferred Ideas

- Live champ-select integration.
- Desktop overlay.
- Team-wide coordinated draft planning.
- Clash-specific draft prep.
- ARAM, Arena, or non-Summoner's Rift modes.
- Use of third-party stats providers.
- Monetization or account system beyond what is needed for optional Riot ID personalization.
