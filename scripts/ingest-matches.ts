/**
 * Collects ranked Summoner's Rift match samples for a set of seed players
 * and saves normalized records to data/matches/{matchId}.json.
 *
 * Usage:
 *   npm run ingest -- "PlayerName#NA1" "AnotherPlayer#NA1"
 *
 * Seeds can be Riot IDs ("Name#TAG") or raw PUUIDs.
 * Already-saved matches are skipped (safe to re-run).
 *
 * Development API keys rotate every 24 hours. Re-set RIOT_API_KEY in .env.local
 * before running if you get 403 errors.
 */

import "./load-env";
import * as fs from "fs";
import * as path from "path";
import {
  getAccountByRiotId,
  getRankedMatchIds,
  getMatch,
  RiotNotFoundError
} from "../lib/riot-client";

// ---------------------------------------------------------------------------
// Normalized match sample stored to disk
// ---------------------------------------------------------------------------

interface MatchSample {
  matchId: string;
  patch: string;
  queueId: number;
  gameDuration: number;
  participants: {
    championName: string;
    teamPosition: string;
    win: boolean;
  }[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MATCHES_DIR = path.resolve(process.cwd(), "data", "matches");
const MATCHES_PER_SEED = 20;
const REQUEST_DELAY_MS = 120; // ~8 req/s — well within dev key limits

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function matchPath(matchId: string): string {
  return path.join(MATCHES_DIR, `${matchId}.json`);
}

function patchFromVersion(gameVersion: string): string {
  // gameVersion looks like "14.13.123.456" — keep "14.13"
  const parts = gameVersion.split(".");
  return `${parts[0]}.${parts[1]}`;
}

async function resolvePuuid(seed: string): Promise<string | null> {
  if (seed.includes("#")) {
    const [gameName, tagLine] = seed.split("#");
    try {
      const account = await getAccountByRiotId(gameName, tagLine);
      return account.puuid;
    } catch (err) {
      if (err instanceof RiotNotFoundError) {
        console.warn(`  Riot ID not found: ${seed}`);
        return null;
      }
      throw err;
    }
  }
  // assume it's already a PUUID
  return seed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const seeds = process.argv.slice(2);
  if (seeds.length === 0) {
    console.error("Usage: npm run ingest -- \"PlayerName#NA1\" [\"Player2#NA1\" ...]");
    process.exit(1);
  }

  fs.mkdirSync(MATCHES_DIR, { recursive: true });

  let totalSaved = 0;
  let totalSkipped = 0;

  for (const seed of seeds) {
    console.log(`\nProcessing seed: ${seed}`);

    const puuid = await resolvePuuid(seed);
    if (!puuid) continue;
    console.log(`  PUUID: ${puuid.slice(0, 16)}...`);

    await sleep(REQUEST_DELAY_MS);

    let matchIds: string[];
    try {
      matchIds = await getRankedMatchIds(puuid, MATCHES_PER_SEED);
    } catch (err) {
      console.error(`  Failed to fetch match list: ${err}`);
      continue;
    }
    console.log(`  Found ${matchIds.length} ranked match IDs`);

    for (const matchId of matchIds) {
      if (fs.existsSync(matchPath(matchId))) {
        totalSkipped++;
        continue;
      }

      await sleep(REQUEST_DELAY_MS);

      let match;
      try {
        match = await getMatch(matchId);
      } catch (err) {
        console.warn(`  Skipping ${matchId}: ${err}`);
        continue;
      }

      const sample: MatchSample = {
        matchId,
        patch: patchFromVersion(match.info.gameVersion),
        queueId: match.info.queueId,
        gameDuration: match.info.gameDuration,
        participants: match.info.participants.map((p) => ({
          championName: p.championName,
          teamPosition: p.teamPosition,
          win: p.win
        }))
      };

      fs.writeFileSync(matchPath(matchId), JSON.stringify(sample, null, 2), "utf8");
      totalSaved++;
      process.stdout.write(".");
    }

    process.stdout.write("\n");
  }

  console.log(`\nDone. Saved: ${totalSaved}, skipped (already stored): ${totalSkipped}`);
  console.log(`Run "npm run build:features" to rebuild data/features.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
