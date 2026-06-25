import { NextResponse } from "next/server";
import { recommendDraft } from "@/lib/recommender";
import { getAccountByRiotId, getRankedMatchIds, getMatch, RiotNotFoundError } from "@/lib/riot-client";
import type { DraftRequest, PlayerComfortData, Role } from "@/lib/types";

const roles: Role[] = ["top", "jungle", "mid", "bot", "support"];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<DraftRequest>;
    const validationError = validateDraft(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const draft = body as DraftRequest;
    let playerData: PlayerComfortData | undefined;

    if (draft.riotId?.gameName && draft.riotId?.tagLine) {
      playerData = await resolvePlayerData(draft.riotId.gameName, draft.riotId.tagLine);
    }

    const response = recommendDraft(draft, playerData);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Invalid recommendation request." }, { status: 400 });
  }
}

// ---------------------------------------------------------------------------
// Player personalization
// ---------------------------------------------------------------------------

async function resolvePlayerData(
  gameName: string,
  tagLine: string
): Promise<PlayerComfortData | undefined> {
  try {
    const account = await getAccountByRiotId(gameName, tagLine);
    const matchIds = await getRankedMatchIds(account.puuid, 20);

    const championUsage: Record<string, number> = {};
    let fetched = 0;

    // Fetch up to 10 matches to stay within dev key rate limits per request
    for (const matchId of matchIds.slice(0, 10)) {
      try {
        const match = await getMatch(matchId);
        const self = match.info.participants.find((p) => p.puuid === account.puuid);
        if (self?.championName) {
          championUsage[self.championName] = (championUsage[self.championName] ?? 0) + 1;
        }
        fetched++;
      } catch {
        // Individual match failures don't abort personalization
      }
    }

    if (fetched === 0) return undefined;

    return { championUsage, totalGames: fetched };
  } catch (err) {
    if (err instanceof RiotNotFoundError) {
      // Riot ID doesn't exist — degrade silently
      return undefined;
    }
    // Other errors (rate limit, network) — degrade silently
    console.error("Personalization failed, returning general recommendations:", err);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateDraft(body: Partial<DraftRequest>) {
  if (!body.role || !roles.includes(body.role)) {
    return "A valid role is required.";
  }

  const picked = [...(body.alliedPicks ?? []), ...(body.enemyPicks ?? [])]
    .map(normalizeName)
    .filter(Boolean);
  const uniquePicked = new Set(picked);

  if (picked.length !== uniquePicked.size) {
    return "The same champion cannot appear more than once in the draft.";
  }

  const bans = new Set((body.bans ?? []).map(normalizeName).filter(Boolean));
  const bannedPick = picked.find((pick) => bans.has(pick));

  if (bannedPick) {
    return "A champion cannot be both picked and banned.";
  }

  return null;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
