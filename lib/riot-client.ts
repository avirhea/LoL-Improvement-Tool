/**
 * Server-side Riot API client. Never import this in browser/client components.
 * Handles rate-limit retries using the Retry-After header.
 *
 * Routing:
 *   Regional (americas): Account-V1, Match-V5
 *   Platform (na1): Summoner-V4, League-V4
 */

const REGIONAL = "https://americas.api.riotgames.com";

function apiKey(): string {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new Error("RIOT_API_KEY environment variable is not set");
  return key;
}

async function riotFetch<T>(url: string, retries = 2): Promise<T> {
  const res = await fetch(url, {
    headers: { "X-Riot-Token": apiKey() },
    next: { revalidate: 0 }
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "6", 10);
    if (retries > 0) {
      await sleep(retryAfter * 1000);
      return riotFetch<T>(url, retries - 1);
    }
    throw new Error(`Riot API rate limit exceeded on ${url}`);
  }

  if (res.status === 404) {
    throw new RiotNotFoundError(`Not found: ${url}`);
  }

  if (!res.ok) {
    throw new Error(`Riot API ${res.status} on ${url}`);
  }

  return res.json() as Promise<T>;
}

export class RiotNotFoundError extends Error {}

// ---------------------------------------------------------------------------
// Account-V1
// ---------------------------------------------------------------------------

export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export function getAccountByRiotId(gameName: string, tagLine: string): Promise<RiotAccount> {
  return riotFetch<RiotAccount>(
    `${REGIONAL}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  );
}

// ---------------------------------------------------------------------------
// Match-V5
// ---------------------------------------------------------------------------

export interface MatchParticipant {
  puuid: string;
  championName: string;
  teamPosition: string; // "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY"
  win: boolean;
}

export interface RiotMatch {
  metadata: { matchId: string };
  info: {
    gameVersion: string;
    queueId: number;
    gameDuration: number;
    participants: MatchParticipant[];
  };
}

export function getRankedMatchIds(puuid: string, count = 20): Promise<string[]> {
  return riotFetch<string[]>(
    `${REGIONAL}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&type=ranked&count=${count}`
  );
}

export function getMatch(matchId: string): Promise<RiotMatch> {
  return riotFetch<RiotMatch>(`${REGIONAL}/lol/match/v5/matches/${matchId}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
