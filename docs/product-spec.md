# LoL Draft Assistant Product Spec

## Purpose

LoL Draft Assistant helps new and intermediate League of Legends players make better champion picks in Summoner's Rift ranked draft. The first version focuses on feedback that is hard to see during play: draft fit, matchup pressure, team identity, and whether a pick is practical for the player.

The tool should recommend options, explain tradeoffs, and leave the final decision with the player. It should not present a single mandatory answer or imply guaranteed outcomes.

## Target Users

- New and intermediate ranked players who understand basic roles and champions but struggle to evaluate draft quality.
- Players who want a fast recommendation during champ select.
- Players reviewing draft decisions after a match.
- Players who may not want to connect a Riot account, but can benefit from general recommendations.

## MVP Workflow

1. The user opens the web app and selects their role.
2. The user enters known allied picks, enemy picks, and optional bans.
3. The user may enter a Riot ID for personalization, but this is never required.
4. The app returns 3-5 recommended champions.
5. Each recommendation includes a short explanation, score breakdown, confidence level, risks, and data freshness.
6. The user can adjust draft inputs and immediately compare updated recommendations.

## Current Prototype Status

The current repo contains a Phase 1 prototype of the manual draft recommender. It uses a Next.js web UI, a Next.js API route, seeded champion trait data, and a deterministic TypeScript scoring engine.

Implemented:

- Manual role, allied pick, enemy pick, ban, champion pool, and optional Riot ID fields.
- Ranked recommendations with score breakdowns, explanations, risks, confidence, draft notes, and freshness metadata.
- Duplicate picked champion and picked/banned champion validation in the API.
- Placeholder player comfort scoring when Riot ID fields are supplied.

Not implemented yet:

- Riot ID to PUUID lookup.
- Player match-history personalization.
- Data Dragon sync or full champion roster.
- Riot match ingestion and real meta/matchup aggregates.
- LLM/RAG generated explanations.

## Recommendation UX

Each recommended champion should show:

- Champion name, role fit, and optional champion image.
- Total score on a normalized scale.
- Component scores for matchup, team fit, meta strength, role fit, and player comfort when available.
- A concise "why this pick" explanation.
- Risks and caveats, such as weak early lane, low engage, magic-heavy team damage, or low personalization confidence.
- Data freshness, including patch/static data version and stat sample window.

The interface should prefer readable ranked options over an opaque "best pick" answer. For the MVP, explanations should be short enough to scan in champ select.

## Example User Flows

### Anonymous Top-Lane Pick

A top-lane player selects top as their role. Their team has Jinx and Lulu, the enemy has Darius and Sejuani, and no Riot ID is entered. The app recommends champions that can survive or contest the lane, add teamfight value, and avoid making the team composition too fragile.

Success looks like:

- The user gets recommendations without account setup.
- The tool explains lane risk against Darius and teamfight synergy with Jinx/Lulu.
- The response notes that player comfort is not included.

### Personalized Mid-Lane Pick

A mid-lane player enters a Riot ID and drafts around known allied and enemy picks. The app includes recent champion history and mastery signals in the ranking.

Success looks like:

- The app resolves Riot ID to PUUID server-side.
- The model boosts champions the player has demonstrated comfort on when they remain draft-appropriate.
- The explanation separates "good for this draft" from "good for you."

### Incomplete Draft Fallback

A player only knows their role and one enemy pick. The app still returns recommendations, but with lower confidence.

Success looks like:

- The tool does not fail because of missing picks.
- Sparse-input recommendations rely more heavily on role fit, general meta strength, and safe blind-pick qualities.
- The response clearly marks confidence as lower and states what missing information would improve the result.

## Success Criteria

For the current manual prototype:

- Users can enter a partial draft manually.
- The app returns 3-5 viable recommendations for the selected role.
- Every recommendation includes component scores and a human-readable explanation.
- The app shows patch and data freshness for every recommendation response.
- The recommendation pipeline is testable without calling an LLM.

For the next personalized release:

- Optional Riot ID personalization improves or changes recommendations without being required.
- The app resolves Riot ID to PUUID server-side and degrades to anonymous recommendations if Riot APIs fail.

## Non-Goals

- No real-time game overlay in v1.
- No automatic champ-select client integration in v1.
- No use of unofficial third-party matchup statistics in v1.
- No ARAM, Arena, Clash-specific, or professional-play draft optimization in v1.
- No claim that the app predicts exact match outcomes or hidden MMR.
- No recommendations that remove player choice or present a decision as mandatory.

## Riot Policy Considerations

The product should be framed as a training and decision-support tool. It should highlight multiple good choices and explain tradeoffs rather than dictate decisions. Riot API keys must never be exposed in the browser, and player identity flows should use Riot ID and PUUID-based APIs where applicable.

The app must include Riot's required legal boilerplate in a visible location before public release:

> [Product Name] is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

## Sources

- [Riot League of Legends Developer Docs](https://developer.riotgames.com/docs/lol)
- [Riot Developer API Reference](https://developer.riotgames.com/apis)
