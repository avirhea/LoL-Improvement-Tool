/**
 * Aggregates match samples from data/matches/ into data/features.json.
 *
 * Usage: npm run build:features
 *
 * Output shape:
 *   byChampionRole[championName][role] = { pickCount, winCount, winRate }
 *
 * The recommender loads this file at startup and uses winRate as metaStrength
 * when real data is available, falling back to the seeded heuristic values.
 */

import "./load-env";
import * as fs from "fs";
import * as path from "path";
import { DATA_FRESHNESS } from "../lib/champions";

const MATCHES_DIR = path.resolve(process.cwd(), "data", "matches");
const FEATURES_PATH = path.resolve(process.cwd(), "data", "features.json");

// Maps Riot's teamPosition strings to our Role values
const POSITION_TO_ROLE: Record<string, string> = {
  TOP: "top",
  JUNGLE: "jungle",
  MIDDLE: "mid",
  BOTTOM: "bot",
  UTILITY: "support"
};

interface RoleStats {
  pickCount: number;
  winCount: number;
  winRate: number;
}

interface Features {
  dataDragonVersion: string;
  patch: string;
  builtAt: string;
  matchCount: number;
  sampleWindowDays: number;
  byChampionRole: Record<string, Record<string, RoleStats>>;
}

function main() {
  if (!fs.existsSync(MATCHES_DIR)) {
    console.error(`No data/matches/ directory found. Run "npm run ingest" first.`);
    process.exit(1);
  }

  const files = fs.readdirSync(MATCHES_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.error("No match files found in data/matches/. Run npm run ingest first.");
    process.exit(1);
  }

  console.log(`Aggregating ${files.length} match files...`);

  const tally: Record<string, Record<string, { pick: number; win: number }>> = {};
  const patches = new Set<string>();
  let earliest = Infinity;
  let latest = 0;

  for (const file of files) {
    const raw = fs.readFileSync(path.join(MATCHES_DIR, file), "utf8");
    const match = JSON.parse(raw);

    patches.add(match.patch);

    // Use gameDuration as a proxy for timestamp ordering if needed later.
    // For window calculation we'll just count distinct patches.

    for (const p of match.participants) {
      const role = POSITION_TO_ROLE[p.teamPosition];
      if (!role || !p.championName) continue;

      tally[p.championName] ??= {};
      tally[p.championName][role] ??= { pick: 0, win: 0 };
      tally[p.championName][role].pick++;
      if (p.win) tally[p.championName][role].win++;
    }
  }

  const byChampionRole: Record<string, Record<string, RoleStats>> = {};
  for (const [champ, roles] of Object.entries(tally)) {
    byChampionRole[champ] = {};
    for (const [role, { pick, win }] of Object.entries(roles)) {
      byChampionRole[champ][role] = {
        pickCount: pick,
        winCount: win,
        winRate: pick > 0 ? Math.round((win / pick) * 1000) / 1000 : 0.5
      };
    }
  }

  const patchList = [...patches].sort();
  const features: Features = {
    dataDragonVersion: DATA_FRESHNESS.dataDragonVersion,
    patch: patchList[patchList.length - 1] ?? "unknown",
    builtAt: new Date().toISOString(),
    matchCount: files.length,
    sampleWindowDays: patchList.length * 14, // rough estimate: ~2 weeks per patch
    byChampionRole
  };

  fs.mkdirSync(path.dirname(FEATURES_PATH), { recursive: true });
  fs.writeFileSync(FEATURES_PATH, JSON.stringify(features, null, 2), "utf8");

  const champCount = Object.keys(byChampionRole).length;
  console.log(`Built features for ${champCount} champions across ${files.length} matches.`);
  console.log(`Patches: ${patchList.join(", ")}`);
  console.log(`Wrote data/features.json`);
}

main();
