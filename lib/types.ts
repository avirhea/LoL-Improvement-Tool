export type Role = "top" | "jungle" | "mid" | "bot" | "support";

export type Confidence = "high" | "medium" | "low";

export type DraftRequest = {
  role: Role;
  alliedPicks: string[];
  enemyPicks: string[];
  bans?: string[];
  championPool?: string[];
  riotId?: {
    gameName: string;
    tagLine: string;
    region: string;
  };
};

export type ScoreComponents = {
  matchup: number;
  teamFit: number;
  enemyFit: number;
  metaStrength: number;
  roleFit: number;
  playerComfort?: number;
};

export type Recommendation = {
  champion: string;
  title: string;
  roles: Role[];
  totalScore: number;
  components: ScoreComponents;
  confidence: Confidence;
  explanation: string;
  risks: string[];
  tags: string[];
};

export type RecommendationResponse = {
  recommendations: Recommendation[];
  freshness: {
    dataDragonVersion: string;
    statsPatch: string;
    sampleWindowDays: number;
    generatedAt: string;
    personalizationUsed: boolean;
    fallbackMode: boolean;
  };
  draftNotes: string[];
};

export type ChampionTrait =
  | "engage"
  | "frontline"
  | "peel"
  | "poke"
  | "dive"
  | "scaling"
  | "early"
  | "pick"
  | "split"
  | "waveclear"
  | "burst"
  | "sustained"
  | "magic"
  | "physical"
  | "mixed"
  | "utility"
  | "antiTank"
  | "safeBlind";

export type PlayerComfortData = {
  championUsage: Record<string, number>; // championName → recent game count
  totalGames: number;
};

export type ChampionProfile = {
  id: string;
  name: string;
  title: string;
  roles: Role[];
  traits: ChampionTrait[];
  difficulty: 1 | 2 | 3;
  metaByRole: Partial<Record<Role, number>>;
  countersTraits: ChampionTrait[];
  riskNotes: string[];
  explanationHooks: string[];
};
