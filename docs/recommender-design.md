# LoL Draft Assistant Recommender Design

## Objective

Recommend practical champion picks for one player in a Summoner's Rift ranked draft. The model should balance general champion strength, matchup context, team composition, selected role, and optional player comfort.

The first implementation should be transparent and debuggable. The LLM explains recommendations, but deterministic scoring ranks candidates.

## Current Implementation

The current scorer lives in `lib/recommender.ts` and uses seeded champion profiles from `lib/champions.ts`.

Implemented now:

- Role-filtered candidate generation.
- Picked and banned champion exclusion.
- Champion pool filtering when supplied.
- Weighted additive scoring.
- Anonymous weight redistribution when no Riot ID is supplied.
- Placeholder player comfort when Riot ID fields are supplied.
- Template explanations, risk notes, confidence, draft notes, and freshness metadata.

Not implemented yet:

- Real role statistics from Riot match samples.
- Direct lane matchup inference.
- Player-history comfort from Riot APIs.
- RAG retrieval.
- LLM explanation generation.

## Inputs

Required:

- Player role.
- Allied champion picks, which may be empty.
- Enemy champion picks, which may be empty.

Optional:

- Banned champions.
- Champion pool constraints.
- Riot ID for personalization.
- Patch or region context if the app later supports multiple active data sets.

## Candidate Generation

1. Start from all champions eligible for the selected role.
2. Remove champions already picked by either team.
3. Remove banned champions.
4. If a champion pool is provided, filter to that pool.
5. Keep enough candidates to avoid over-pruning when role data is sparse.

## Score Components

### Role Fit

Measures whether a champion is a reasonable pick for the selected role. This can start from curated role tags and evolve into observed pick-rate and performance by role.

### Matchup

Measures expected lane or direct-opponent suitability when enemy role assignments are known or can be inferred. If matchup inference is weak, use low-confidence broad enemy-threat features rather than forcing a lane matchup.

### Team Fit

Measures how well the champion complements allied picks. Initial feature categories:

- Engage and follow-up.
- Frontline and durability.
- Crowd control.
- Damage mix.
- Scaling.
- Poke, dive, pick, split push, and teamfight identity.
- Synergy with known allied carries or enablers.

### Enemy Fit And Counterplay

Measures whether the champion gives the team tools against enemy composition traits. Initial categories:

- Anti-dive or peel.
- Range and waveclear.
- Tank shred.
- Backline access.
- Crowd-control resilience.
- Ability to punish low-mobility or fragile enemies.

### Meta Strength

Measures general role-specific strength for the current patch or sample window. This should use Riot match samples once enough data exists. Until then, use conservative curated or heuristic values with low confidence.

### Player Comfort

Optional component used only when Riot ID data is available. Signals may include recent champion usage, long-term usage, role frequency, and performance proxies. Player comfort should not override extreme draft mismatch, but it can break ties and favor practical picks.

Current prototype note: `playerComfort` is a placeholder derived from champion difficulty when Riot ID fields are present. Real player comfort requires Riot ID to PUUID lookup and player history ingestion.

## Scoring Formula

The first version should use a weighted additive score:

```text
total =
  roleFit * 0.20 +
  matchup * 0.20 +
  teamFit * 0.20 +
  enemyFit * 0.15 +
  metaStrength * 0.15 +
  playerComfort * 0.10
```

When no personalization is available, redistribute the player comfort weight across role fit, team fit, and matchup. All component scores should be normalized to `0.0-1.0`.

Weights should be configuration, not hard-coded deep inside ranking logic. Store the exact component scores returned to the user so recommendations can be inspected.

Current prototype note: these weights currently live as constants in `lib/recommender.ts`. Moving them into external configuration is a future cleanup.

## Confidence

Return `high`, `medium`, or `low` confidence based on:

- Completeness of draft input.
- Match sample counts.
- Patch freshness.
- Whether role and matchup inference are reliable.
- Whether personalization was requested and available.
- Whether the system used fallback heuristics.

Sparse data should reduce confidence and appear in explanation caveats.

## Fallback Behavior

The recommender must work without the LLM and without personalization.

Fallback rules:

- If enemy picks are missing, reduce matchup weight and favor role fit, safe blind-pick traits, and team fit.
- If allied picks are missing, reduce team-fit weight and favor role fit plus meta strength.
- If stats are sparse, use curated champion traits and lower confidence.
- If Riot APIs fail during personalization, omit `playerComfort` and return general recommendations.
- If the LLM provider fails, return deterministic scores with template-based explanations.

## Explanation Contract

The explanation generator receives structured inputs:

- Draft context.
- Candidate champion.
- Component score breakdown.
- Confidence and freshness.
- Retrieved champion/draft notes.
- Known caveats and sparse-data flags.

The LLM must output:

- One short explanation.
- Two to four risks or tradeoffs.
- No invented statistics.
- No hidden matchup claims unsupported by retrieved notes or structured features.
- No wording that says the user must pick a champion.

Example explanation:

```text
Ornn is a strong practical option here because he gives your team frontline and reliable engage while still scaling if lane is difficult. The main risk is that Darius can punish early mistakes, so this works best if you are comfortable farming safely and playing for teamfights.
```

## RAG Content

Retrieval should prioritize:

- Candidate champion notes.
- Enemy matchup notes when available.
- Allied synergy notes.
- Draft concept notes for the detected team identities.
- Recent patch notes or curated patch deltas when available.

Retrieved content should support explanations, not replace scoring.

## Evaluation

Offline evaluation:

- Backtest recommendations against held-out match samples.
- Measure whether recommended champions were viable by role and patch.
- Compare score components against observed outcomes with sample-count caveats.
- Track next-champion recovery for players with known histories.
- Run ablations for matchup, team fit, meta, and personalization components.

Human evaluation:

- Review recommendation explanations for clarity and usefulness.
- Check whether recommendations offer meaningful alternatives.
- Test with new/intermediate players for speed and comprehension during champ select.

Acceptance checks:

- Duplicate and banned champions are never recommended.
- Recommendations are stable for identical inputs.
- Missing inputs degrade gracefully.
- LLM failures do not block deterministic recommendations.
- Every response includes data freshness and confidence.
