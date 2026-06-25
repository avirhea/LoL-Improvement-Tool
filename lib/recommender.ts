import { CHAMPIONS, DATA_FRESHNESS } from "./champions";
import type {
  ChampionProfile,
  ChampionTrait,
  DraftRequest,
  PlayerComfortData,
  Recommendation,
  RecommendationResponse,
  Role,
  ScoreComponents
} from "./types";

// ---------------------------------------------------------------------------
// Feature data — loaded once at module init from data/features.json when present
// ---------------------------------------------------------------------------

interface RoleStats { pickCount: number; winCount: number; winRate: number }
interface FeatureData {
  dataDragonVersion: string;
  patch: string;
  builtAt: string;
  matchCount: number;
  sampleWindowDays: number;
  byChampionRole: Record<string, Record<string, RoleStats>>;
}

function loadFeatures(): FeatureData | null {
  try {
    // Dynamic require keeps this server-side and avoids bundling the JSON into the client.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../data/features.json") as FeatureData;
  } catch {
    return null;
  }
}

const FEATURES: FeatureData | null = loadFeatures();

const roleWeights = {
  matchup: 0.2,
  teamFit: 0.2,
  enemyFit: 0.15,
  metaStrength: 0.15,
  roleFit: 0.2,
  playerComfort: 0.1
};

const anonymousWeights = {
  matchup: 0.24,
  teamFit: 0.24,
  enemyFit: 0.16,
  metaStrength: 0.16,
  roleFit: 0.2
};

const roleNeeds: Record<Role, ChampionTrait[]> = {
  top: ["frontline", "engage", "split", "scaling", "safeBlind"],
  jungle: ["engage", "early", "dive", "frontline", "utility"],
  mid: ["waveclear", "burst", "pick", "magic", "scaling"],
  bot: ["physical", "sustained", "scaling", "poke", "safeBlind"],
  support: ["engage", "peel", "utility", "pick", "frontline"]
};

const synergyNeedsByAllyTrait: Partial<Record<ChampionTrait, ChampionTrait[]>> = {
  scaling: ["frontline", "peel", "engage"],
  poke: ["poke", "waveclear", "peel"],
  dive: ["dive", "engage", "early"],
  engage: ["burst", "dive", "sustained"],
  frontline: ["scaling", "sustained", "magic", "physical"],
  physical: ["magic", "utility"],
  magic: ["physical", "frontline"],
  peel: ["scaling", "sustained"],
  pick: ["burst", "pick", "waveclear"]
};

const desiredAgainstEnemyTrait: Partial<Record<ChampionTrait, ChampionTrait[]>> = {
  dive: ["peel", "frontline", "safeBlind"],
  poke: ["engage", "dive", "frontline"],
  frontline: ["antiTank", "scaling", "sustained"],
  scaling: ["early", "pick", "dive"],
  split: ["engage", "waveclear"],
  burst: ["frontline", "peel"],
  physical: ["frontline", "magic"],
  magic: ["physical", "engage"],
  engage: ["peel", "frontline"]
};

export function recommendDraft(rawDraft: DraftRequest, playerData?: PlayerComfortData): RecommendationResponse {
  const draft = normalizeDraft(rawDraft);
  const unavailable = new Set([
    ...draft.alliedPicks.map(normalizeName),
    ...draft.enemyPicks.map(normalizeName),
    ...(draft.bans ?? []).map(normalizeName)
  ]);
  const championPool = new Set((draft.championPool ?? []).map(normalizeName));
  const allies = lookupChampions(draft.alliedPicks);
  const enemies = lookupChampions(draft.enemyPicks);
  const fallbackMode = allies.length + enemies.length < 3;

  const candidates = CHAMPIONS.filter((champion) => {
    if (!champion.roles.includes(draft.role)) return false;
    if (unavailable.has(normalizeName(champion.name))) return false;
    if (championPool.size > 0 && !championPool.has(normalizeName(champion.name))) {
      return false;
    }
    return true;
  });

  const recommendations = candidates
    .map((champion) => scoreChampion(champion, draft, allies, enemies, fallbackMode, playerData))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5);

  const freshness = FEATURES
    ? {
        dataDragonVersion: FEATURES.dataDragonVersion,
        statsPatch: FEATURES.patch,
        sampleWindowDays: FEATURES.sampleWindowDays,
        generatedAt: new Date().toISOString(),
        personalizationUsed: !!playerData,
        fallbackMode
      }
    : {
        ...DATA_FRESHNESS,
        generatedAt: new Date().toISOString(),
        personalizationUsed: !!playerData,
        fallbackMode
      };

  return {
    recommendations,
    freshness,
    draftNotes: buildDraftNotes(draft, allies, enemies, fallbackMode)
  };
}

function scoreChampion(
  champion: ChampionProfile,
  draft: DraftRequest,
  allies: ChampionProfile[],
  enemies: ChampionProfile[],
  fallbackMode: boolean,
  playerData?: PlayerComfortData
): Recommendation {
  const metaStrength = getRealMetaStrength(champion, draft.role);
  const components: ScoreComponents = {
    roleFit: clamp01(metaStrength + traitOverlap(champion.traits, roleNeeds[draft.role]) * 0.18),
    matchup: scoreMatchup(champion, enemies, fallbackMode),
    teamFit: scoreTeamFit(champion, allies, fallbackMode),
    enemyFit: scoreEnemyFit(champion, enemies, fallbackMode),
    metaStrength
  };

  if (playerData) {
    components.playerComfort = computePlayerComfort(champion, playerData);
  } else if (hasRiotId(draft)) {
    // Riot ID was supplied but player data couldn't be fetched — use seed estimate
    components.playerComfort = estimateSeedComfort(champion);
  }

  const totalScore = getTotalScore(components, !!components.playerComfort);

  return {
    champion: champion.name,
    title: champion.title,
    roles: champion.roles,
    totalScore: round(totalScore),
    components: roundComponents(components),
    confidence: getConfidence(draft, champion, fallbackMode),
    explanation: buildExplanation(champion, components, draft, allies, enemies, fallbackMode),
    risks: getRisks(champion, components, fallbackMode),
    tags: champion.traits
  };
}

function scoreMatchup(champion: ChampionProfile, enemies: ChampionProfile[], fallbackMode: boolean) {
  if (enemies.length === 0) return 0.58;
  const enemyTraits = uniqueTraits(enemies);
  const directAnswers = traitOverlap(champion.countersTraits, enemyTraits);
  const practicalAnswers = traitOverlap(champion.traits, enemyTraits.flatMap((trait) => desiredAgainstEnemyTrait[trait] ?? []));
  const base = fallbackMode ? 0.55 : 0.5;
  return clamp01(base + directAnswers * 0.22 + practicalAnswers * 0.2);
}

function scoreTeamFit(champion: ChampionProfile, allies: ChampionProfile[], fallbackMode: boolean) {
  if (allies.length === 0) return champion.traits.includes("safeBlind") ? 0.66 : 0.58;
  const allyTraits = uniqueTraits(allies);
  const desiredTraits = allyTraits.flatMap((trait) => synergyNeedsByAllyTrait[trait] ?? []);
  const synergy = traitOverlap(champion.traits, desiredTraits);
  const damageBalance = getDamageBalanceScore(champion, allies);
  const base = fallbackMode ? 0.56 : 0.5;
  return clamp01(base + synergy * 0.26 + damageBalance * 0.16);
}

function scoreEnemyFit(champion: ChampionProfile, enemies: ChampionProfile[], fallbackMode: boolean) {
  if (enemies.length === 0) return 0.57;
  const enemyTraits = uniqueTraits(enemies);
  const desiredTraits = enemyTraits.flatMap((trait) => desiredAgainstEnemyTrait[trait] ?? []);
  const answerScore = traitOverlap(champion.traits, desiredTraits);
  return clamp01((fallbackMode ? 0.54 : 0.48) + answerScore * 0.34);
}

function getDamageBalanceScore(champion: ChampionProfile, allies: ChampionProfile[]) {
  const physicalCount = allies.filter((ally) => ally.traits.includes("physical")).length;
  const magicCount = allies.filter((ally) => ally.traits.includes("magic")).length;

  if (physicalCount > magicCount + 1 && champion.traits.includes("magic")) return 1;
  if (magicCount > physicalCount + 1 && champion.traits.includes("physical")) return 1;
  if (champion.traits.includes("mixed")) return 0.8;
  return 0.45;
}

function getTotalScore(components: ScoreComponents, personalized: boolean) {
  if (personalized && components.playerComfort !== undefined) {
    return (
      components.matchup * roleWeights.matchup +
      components.teamFit * roleWeights.teamFit +
      components.enemyFit * roleWeights.enemyFit +
      components.metaStrength * roleWeights.metaStrength +
      components.roleFit * roleWeights.roleFit +
      components.playerComfort * roleWeights.playerComfort
    );
  }

  return (
    components.matchup * anonymousWeights.matchup +
    components.teamFit * anonymousWeights.teamFit +
    components.enemyFit * anonymousWeights.enemyFit +
    components.metaStrength * anonymousWeights.metaStrength +
    components.roleFit * anonymousWeights.roleFit
  );
}

function getConfidence(draft: DraftRequest, champion: ChampionProfile, fallbackMode: boolean) {
  const inputCount = draft.alliedPicks.length + draft.enemyPicks.length;
  if (fallbackMode || inputCount < 3 || champion.metaByRole[draft.role] === undefined) return "low";
  if (inputCount < 6 || !hasRiotId(draft)) return "medium";
  return "high";
}

function buildExplanation(
  champion: ChampionProfile,
  components: ScoreComponents,
  draft: DraftRequest,
  allies: ChampionProfile[],
  enemies: ChampionProfile[],
  fallbackMode: boolean
) {
  const strongestComponent = Object.entries(components)
    .filter(([, value]) => typeof value === "number")
    .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0];
  const hook = champion.explanationHooks[0];
  const context =
    strongestComponent === "teamFit" && allies.length > 0
      ? "fits the allied draft"
      : strongestComponent === "matchup" && enemies.length > 0
        ? "answers the enemy traits shown so far"
        : strongestComponent === "roleFit"
          ? `is a practical ${draft.role} option`
          : "keeps the draft flexible";
  const fallback = fallbackMode
    ? " Because the draft is still incomplete, this leans more on role fit and safe traits than matchup certainty."
    : "";
  const personalized = hasRiotId(draft)
    ? ""
    : "";

  return `${champion.name} ${hook} and ${context}.${fallback}${personalized}`;
}

function getRisks(champion: ChampionProfile, components: ScoreComponents, fallbackMode: boolean) {
  const risks = [...champion.riskNotes];
  if (components.teamFit < 0.58) {
    risks.push("Team-fit score is modest with the current allied picks.");
  }
  if (components.matchup < 0.58) {
    risks.push("Matchup confidence is limited from the visible enemy draft.");
  }
  if (fallbackMode) {
    risks.push("More ally and enemy picks would improve confidence.");
  }
  return risks.slice(0, 4);
}

function buildDraftNotes(
  draft: DraftRequest,
  allies: ChampionProfile[],
  enemies: ChampionProfile[],
  fallbackMode: boolean
) {
  const notes: string[] = [];
  if (fallbackMode) {
    notes.push("Sparse draft: recommendations favor role fit, flexible traits, and safer blind-pick qualities.");
  }
  if (allies.length > 0) {
    notes.push(`Detected allied traits: ${uniqueTraits(allies).slice(0, 5).join(", ")}.`);
  }
  if (enemies.length > 0) {
    notes.push(`Detected enemy traits: ${uniqueTraits(enemies).slice(0, 5).join(", ")}.`);
  }
  if (hasRiotId(draft)) {
    notes.push("Riot ID was provided and player comfort scores are included in recommendations.");
  }
  return notes;
}

function normalizeDraft(draft: DraftRequest): DraftRequest {
  return {
    role: draft.role,
    alliedPicks: cleanList(draft.alliedPicks),
    enemyPicks: cleanList(draft.enemyPicks),
    bans: cleanList(draft.bans ?? []),
    championPool: cleanList(draft.championPool ?? []),
    riotId: draft.riotId
  };
}

function cleanList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function lookupChampions(names: string[]) {
  const wanted = new Set(names.map(normalizeName));
  return CHAMPIONS.filter((champion) => wanted.has(normalizeName(champion.name)));
}

function uniqueTraits(champions: ChampionProfile[]) {
  return Array.from(new Set(champions.flatMap((champion) => champion.traits)));
}

function traitOverlap(source: ChampionTrait[], desired: ChampionTrait[]) {
  if (desired.length === 0) return 0;
  const sourceSet = new Set(source);
  const desiredSet = new Set(desired);
  const matches = Array.from(desiredSet).filter((trait) => sourceSet.has(trait)).length;
  return matches / Math.min(Math.max(desiredSet.size, 1), 5);
}

// Uses real win rate from aggregated match data when available; falls back to seeded heuristic.
function getRealMetaStrength(champion: ChampionProfile, role: Role): number {
  const stats = FEATURES?.byChampionRole[champion.name]?.[role];
  if (stats && stats.pickCount >= 10) {
    // Blend win rate toward 0.5 when sample is sparse (shrinkage)
    const weight = Math.min(stats.pickCount / 100, 1);
    return clamp01(stats.winRate * weight + 0.5 * (1 - weight));
  }
  return champion.metaByRole[role] ?? 0.55;
}

// Derives comfort from recent champion usage in the player's match history.
function computePlayerComfort(champion: ChampionProfile, playerData: PlayerComfortData): number {
  const games = playerData.championUsage[champion.name] ?? 0;
  const totalGames = Math.max(playerData.totalGames, 1);
  const usageRate = games / totalGames;
  // Blend usage signal with difficulty floor so unknown-but-easy champions aren't penalized heavily
  const difficultyBase = estimateSeedComfort(champion);
  return clamp01(difficultyBase * 0.4 + usageRate * 4 * 0.6);
}

function estimateSeedComfort(champion: ChampionProfile) {
  return clamp01(0.72 - (champion.difficulty - 1) * 0.09);
}

function hasRiotId(draft: DraftRequest) {
  return Boolean(draft.riotId?.gameName && draft.riotId?.tagLine && draft.riotId?.region);
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function roundComponents(components: ScoreComponents): ScoreComponents {
  return Object.fromEntries(
    Object.entries(components).map(([key, value]) => [key, round(value)])
  ) as ScoreComponents;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
