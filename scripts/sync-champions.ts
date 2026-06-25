/**
 * Syncs champion data from Data Dragon and rewrites lib/champions.ts.
 *
 * Usage: npm run sync:champions
 *
 * Preserves hand-curated fields (traits, countersTraits, metaByRole, riskNotes,
 * explanationHooks) for champions that already have overrides. Champions not in
 * the override table get sensible defaults derived from their Data Dragon tags.
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Data Dragon types
// ---------------------------------------------------------------------------

interface DDChampionInfo {
  attack: number;
  defense: number;
  magic: number;
  difficulty: number;
}

interface DDChampionEntry {
  id: string;
  key: string;
  name: string;
  title: string;
  tags: string[];
  info: DDChampionInfo;
}

interface DDChampionData {
  version: string;
  data: Record<string, DDChampionEntry>;
}

// ---------------------------------------------------------------------------
// Our types (inlined to avoid importing from lib during the build)
// ---------------------------------------------------------------------------

type Role = "top" | "jungle" | "mid" | "bot" | "support";

type ChampionTrait =
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

interface ChampionOverride {
  roles?: Role[];
  traits?: ChampionTrait[];
  difficulty?: 1 | 2 | 3;
  metaByRole?: Partial<Record<Role, number>>;
  countersTraits?: ChampionTrait[];
  riskNotes?: string[];
  explanationHooks?: string[];
}

// ---------------------------------------------------------------------------
// Hand-curated overrides for the 27 seeded champions.
// Only fields that need to differ from the auto-derived defaults go here.
// ---------------------------------------------------------------------------

const OVERRIDES: Record<string, ChampionOverride> = {
  aatrox: {
    roles: ["top"],
    traits: ["frontline", "sustained", "early", "physical"],
    difficulty: 2,
    metaByRole: { top: 0.72 },
    countersTraits: ["frontline"],
    riskNotes: ["Needs spell accuracy to win trades", "Can struggle into heavy disengage"],
    explanationHooks: ["adds durable skirmishing and lane agency"],
  },
  ahri: {
    roles: ["mid"],
    traits: ["pick", "burst", "magic", "safeBlind"],
    difficulty: 2,
    metaByRole: { mid: 0.78 },
    countersTraits: ["dive"],
    riskNotes: ["Lower sustained damage than hard carries", "Needs charm threat to create picks"],
    explanationHooks: ["offers safe mid pressure and pick setup"],
  },
  annie: {
    roles: ["mid", "support"],
    traits: ["burst", "engage", "magic", "utility"],
    difficulty: 1,
    metaByRole: { mid: 0.7, support: 0.56 },
    countersTraits: ["dive"],
    riskNotes: ["Short range before flash or setup", "Predictable engage windows"],
    explanationHooks: ["brings simple, reliable engage and burst"],
  },
  ashe: {
    roles: ["bot", "support"],
    traits: ["utility", "pick", "physical", "safeBlind"],
    difficulty: 1,
    metaByRole: { bot: 0.74, support: 0.62 },
    countersTraits: ["dive"],
    riskNotes: ["Immobile and punishable without peel", "Needs spacing discipline"],
    explanationHooks: ["gives long-range engage and steady utility"],
  },
  caitlyn: {
    roles: ["bot"],
    traits: ["poke", "early", "physical", "safeBlind"],
    difficulty: 2,
    metaByRole: { bot: 0.76 },
    countersTraits: ["scaling"],
    riskNotes: ["Can fall flat if early pressure is wasted", "Needs trap setup around objectives"],
    explanationHooks: ["creates lane priority and siege pressure"],
  },
  darius: {
    roles: ["top"],
    traits: ["frontline", "early", "physical", "sustained"],
    difficulty: 2,
    metaByRole: { top: 0.68 },
    countersTraits: ["frontline"],
    riskNotes: ["Limited mobility into ranged or disengage comps", "Can be kited in teamfights"],
    explanationHooks: ["punishes melee lanes and snowballs early fights"],
  },
  ezreal: {
    roles: ["bot"],
    traits: ["poke", "safeBlind", "physical", "scaling"],
    difficulty: 2,
    metaByRole: { bot: 0.77 },
    countersTraits: ["poke"],
    riskNotes: ["Skillshot dependent", "Can lack early all-in damage"],
    explanationHooks: ["is a safe blind marksman with flexible poke"],
  },
  fiora: {
    roles: ["top"],
    traits: ["split", "physical", "scaling", "antiTank"],
    difficulty: 3,
    metaByRole: { top: 0.73 },
    countersTraits: ["frontline"],
    riskNotes: ["Low teamfight engage", "Requires side-lane execution"],
    explanationHooks: ["answers tanks and creates split-push pressure"],
  },
  garen: {
    roles: ["top"],
    traits: ["frontline", "early", "physical", "safeBlind"],
    difficulty: 1,
    metaByRole: { top: 0.71 },
    countersTraits: ["burst"],
    riskNotes: ["Limited engage range", "Can be kited by mobile carries"],
    explanationHooks: ["is straightforward, durable, and forgiving in lane"],
  },
  gwen: {
    roles: ["top"],
    traits: ["magic", "scaling", "antiTank", "sustained"],
    difficulty: 3,
    metaByRole: { top: 0.7 },
    countersTraits: ["frontline"],
    riskNotes: ["Weak before key levels and items", "Can be hard for newer players to pilot"],
    explanationHooks: ["adds magic damage and scaling anti-tank threat"],
  },
  jinx: {
    roles: ["bot"],
    traits: ["scaling", "physical", "sustained"],
    difficulty: 2,
    metaByRole: { bot: 0.82 },
    countersTraits: ["frontline"],
    riskNotes: ["Needs peel and reset setup", "Vulnerable to dive"],
    explanationHooks: ["gives your team a late-game carry win condition"],
  },
  leona: {
    roles: ["support"],
    traits: ["engage", "frontline", "early", "utility"],
    difficulty: 1,
    metaByRole: { support: 0.75 },
    countersTraits: ["poke"],
    riskNotes: ["Commit-heavy engages can backfire", "Weak when forced to disengage repeatedly"],
    explanationHooks: ["adds hard engage and early kill pressure"],
  },
  lulu: {
    roles: ["support"],
    traits: ["peel", "utility", "scaling", "magic"],
    difficulty: 2,
    metaByRole: { support: 0.74 },
    countersTraits: ["dive"],
    riskNotes: ["Low engage pressure", "Needs a carry worth protecting"],
    explanationHooks: ["protects carries and blunts enemy dive"],
  },
  lux: {
    roles: ["mid", "support"],
    traits: ["poke", "pick", "magic", "waveclear"],
    difficulty: 1,
    metaByRole: { mid: 0.66, support: 0.68 },
    countersTraits: ["frontline"],
    riskNotes: ["Immobile into hard engage", "Can be punished if binding misses"],
    explanationHooks: ["adds poke, waveclear, and long-range pick threat"],
  },
  malphite: {
    roles: ["top"],
    traits: ["engage", "frontline", "utility", "safeBlind"],
    difficulty: 1,
    metaByRole: { top: 0.76 },
    countersTraits: ["physical", "dive"],
    riskNotes: ["Magic-heavy enemies reduce his defensive value", "Limited pressure before ultimate"],
    explanationHooks: ["gives reliable engage and armor-heavy frontline"],
  },
  maokai: {
    roles: ["jungle", "support", "top"],
    traits: ["engage", "frontline", "peel", "utility"],
    difficulty: 1,
    metaByRole: { jungle: 0.74, support: 0.73, top: 0.6 },
    countersTraits: ["dive"],
    riskNotes: ["Lower carry damage", "Can be invaded by high-tempo junglers"],
    explanationHooks: ["adds flexible engage, peel, and objective control"],
  },
  missfortune: {
    roles: ["bot"],
    traits: ["early", "physical", "burst", "utility"],
    difficulty: 1,
    metaByRole: { bot: 0.73 },
    countersTraits: ["frontline"],
    riskNotes: ["Ultimate can be interrupted", "Immobile against dive"],
    explanationHooks: ["adds easy lane pressure and teamfight burst"],
  },
  nami: {
    roles: ["support"],
    traits: ["peel", "utility", "pick", "magic"],
    difficulty: 2,
    metaByRole: { support: 0.7 },
    countersTraits: ["dive"],
    riskNotes: ["Bubble is difficult to land raw", "Squishy if caught first"],
    explanationHooks: ["adds lane sustain, peel, and pick setup"],
  },
  nocturne: {
    roles: ["jungle"],
    traits: ["dive", "pick", "physical", "early"],
    difficulty: 2,
    metaByRole: { jungle: 0.75 },
    countersTraits: ["poke"],
    riskNotes: ["Can overcommit without follow-up", "Needs ultimate timing around objectives"],
    explanationHooks: ["punishes isolated carries and forces side-lane pressure"],
  },
  orianna: {
    roles: ["mid"],
    traits: ["waveclear", "scaling", "magic", "utility"],
    difficulty: 3,
    metaByRole: { mid: 0.74 },
    countersTraits: ["frontline"],
    riskNotes: ["Needs positioning and ball control", "Can be pressured by early roamers"],
    explanationHooks: ["adds scaling control mage damage and teamfight setup"],
  },
  ornn: {
    roles: ["top"],
    traits: ["engage", "frontline", "scaling", "safeBlind"],
    difficulty: 2,
    metaByRole: { top: 0.8 },
    countersTraits: ["dive", "physical"],
    riskNotes: ["Can be bullied before items", "Needs team follow-up on engages"],
    explanationHooks: ["adds frontline, engage, and scaling utility"],
  },
  sejuani: {
    roles: ["jungle"],
    traits: ["engage", "frontline", "utility", "peel"],
    difficulty: 2,
    metaByRole: { jungle: 0.72 },
    countersTraits: ["dive"],
    riskNotes: ["Lower damage without allies nearby", "Pairs best with melee teammates"],
    explanationHooks: ["brings durable engage and crowd control"],
  },
  thresh: {
    roles: ["support"],
    traits: ["pick", "peel", "utility", "safeBlind"],
    difficulty: 3,
    metaByRole: { support: 0.76 },
    countersTraits: ["dive"],
    riskNotes: ["High execution burden", "Hooks are less reliable into minion-heavy lanes"],
    explanationHooks: ["offers flexible pick tools and defensive peel"],
  },
  vi: {
    roles: ["jungle"],
    traits: ["dive", "engage", "physical", "early"],
    difficulty: 1,
    metaByRole: { jungle: 0.74 },
    countersTraits: ["poke"],
    riskNotes: ["Ultimate can put her deep into the enemy team", "Needs follow-up damage"],
    explanationHooks: ["gives simple lockdown and reliable engage"],
  },
  yasuo: {
    roles: ["mid", "top"],
    traits: ["dive", "physical", "scaling", "sustained"],
    difficulty: 3,
    metaByRole: { mid: 0.64, top: 0.58 },
    countersTraits: ["poke"],
    riskNotes: ["High execution burden", "Can make the team too physical-damage heavy"],
    explanationHooks: ["adds melee carry threat when the draft can enable him"],
  },
  zac: {
    roles: ["jungle"],
    traits: ["engage", "frontline", "dive", "magic"],
    difficulty: 2,
    metaByRole: { jungle: 0.77 },
    countersTraits: ["poke"],
    riskNotes: ["Early invades can slow him down", "Engage angles need vision control"],
    explanationHooks: ["adds long-range engage and magic frontline"],
  },
  zed: {
    roles: ["mid"],
    traits: ["burst", "physical", "pick", "early"],
    difficulty: 3,
    metaByRole: { mid: 0.66 },
    countersTraits: ["poke"],
    riskNotes: ["Can leave team damage too physical", "Falls off if early picks do not land"],
    explanationHooks: ["threatens fragile backliners and side-lane picks"],
  },
};

// ---------------------------------------------------------------------------
// Tag → role mapping
// ---------------------------------------------------------------------------

function rolesFromTags(tags: string[]): Role[] {
  const roles: Role[] = [];
  for (const tag of tags) {
    switch (tag) {
      case "Fighter":
        roles.push("top", "jungle");
        break;
      case "Tank":
        roles.push("top", "jungle", "support");
        break;
      case "Mage":
        roles.push("mid", "support");
        break;
      case "Assassin":
        roles.push("mid", "jungle");
        break;
      case "Marksman":
        roles.push("bot");
        break;
      case "Support":
        roles.push("support");
        break;
    }
  }
  // deduplicate while preserving order
  return [...new Set(roles)];
}

// ---------------------------------------------------------------------------
// Tag → trait mapping
// ---------------------------------------------------------------------------

function traitsFromTags(tags: string[], info: DDChampionInfo): ChampionTrait[] {
  const traits = new Set<ChampionTrait>();

  for (const tag of tags) {
    switch (tag) {
      case "Fighter":
        traits.add("frontline");
        traits.add("sustained");
        traits.add("physical");
        break;
      case "Tank":
        traits.add("frontline");
        traits.add("engage");
        traits.add("utility");
        break;
      case "Mage":
        traits.add("magic");
        traits.add("waveclear");
        break;
      case "Assassin":
        traits.add("burst");
        traits.add("pick");
        traits.add("physical");
        break;
      case "Marksman":
        traits.add("physical");
        traits.add("safeBlind");
        break;
      case "Support":
        traits.add("utility");
        traits.add("peel");
        break;
    }
  }

  // Extra signals from stats
  if (info.magic >= 7) traits.add("magic");
  if (info.attack >= 8) traits.add("physical");

  return [...traits];
}

// ---------------------------------------------------------------------------
// Tag → countersTraits defaults
// ---------------------------------------------------------------------------

function countersFromTags(tags: string[]): ChampionTrait[] {
  const counters = new Set<ChampionTrait>();
  for (const tag of tags) {
    switch (tag) {
      case "Fighter":
      case "Tank":
        counters.add("frontline");
        break;
      case "Mage":
        counters.add("dive");
        break;
      case "Assassin":
        counters.add("poke");
        break;
      case "Marksman":
        counters.add("scaling");
        break;
      case "Support":
        counters.add("dive");
        break;
    }
  }
  return [...counters];
}

// ---------------------------------------------------------------------------
// Difficulty mapping: Data Dragon 1-10 → our 1-3
// ---------------------------------------------------------------------------

function mapDifficulty(dd: number): 1 | 2 | 3 {
  if (dd <= 3) return 1;
  if (dd <= 6) return 2;
  return 3;
}

// ---------------------------------------------------------------------------
// Default metaByRole: 0.65 across all detected roles
// ---------------------------------------------------------------------------

function defaultMetaByRole(roles: Role[]): Partial<Record<Role, number>> {
  const meta: Partial<Record<Role, number>> = {};
  for (const role of roles) meta[role] = 0.65;
  return meta;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Fetching Data Dragon versions...");
  const versionsRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  if (!versionsRes.ok) throw new Error(`versions.json fetch failed: ${versionsRes.status}`);
  const versions: string[] = await versionsRes.json();
  const version = versions[0];
  console.log(`Latest version: ${version}`);

  console.log("Fetching champion summary...");
  const champRes = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  );
  if (!champRes.ok) throw new Error(`champion.json fetch failed: ${champRes.status}`);
  const champData: DDChampionData = await champRes.json();

  const entries = Object.values(champData.data).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  console.log(`Found ${entries.length} champions.`);

  const lines: string[] = [];
  lines.push(`import type { ChampionProfile } from "./types";`);
  lines.push(``);
  lines.push(`// Auto-generated by scripts/sync-champions.ts — do not edit by hand.`);
  lines.push(`// Hand-curated overrides for individual champions live in scripts/sync-champions.ts.`);
  lines.push(``);
  lines.push(`export const DATA_FRESHNESS = {`);
  lines.push(`  dataDragonVersion: ${JSON.stringify(version)},`);
  lines.push(`  statsPatch: "heuristic-pre-ingestion",`);
  lines.push(`  sampleWindowDays: 0`);
  lines.push(`};`);
  lines.push(``);
  lines.push(`export const CHAMPIONS: ChampionProfile[] = [`);

  for (const entry of entries) {
    // Data Dragon uses PascalCase ids like "MissFortune"; our overrides use lowercase.
    const overrideKey = entry.id.toLowerCase();
    const override = OVERRIDES[overrideKey] ?? {};

    const roles = override.roles ?? rolesFromTags(entry.tags);
    const traits = override.traits ?? traitsFromTags(entry.tags, entry.info);
    const difficulty = override.difficulty ?? mapDifficulty(entry.info.difficulty);
    const metaByRole = override.metaByRole ?? defaultMetaByRole(roles);
    const countersTraits = override.countersTraits ?? countersFromTags(entry.tags);
    const riskNotes = override.riskNotes ?? ["Check patch notes for current strength"];
    const explanationHooks = override.explanationHooks ?? [`brings ${traits.slice(0, 2).join(" and ")} to the draft`];

    lines.push(`  {`);
    lines.push(`    id: ${JSON.stringify(overrideKey)},`);
    lines.push(`    name: ${JSON.stringify(entry.name)},`);
    lines.push(`    title: ${JSON.stringify(entry.title)},`);
    lines.push(`    roles: ${JSON.stringify(roles)},`);
    lines.push(`    traits: ${JSON.stringify(traits)},`);
    lines.push(`    difficulty: ${difficulty},`);
    lines.push(`    metaByRole: ${JSON.stringify(metaByRole)},`);
    lines.push(`    countersTraits: ${JSON.stringify(countersTraits)},`);
    lines.push(`    riskNotes: ${JSON.stringify(riskNotes)},`);
    lines.push(`    explanationHooks: ${JSON.stringify(explanationHooks)},`);
    lines.push(`  },`);
  }

  lines.push(`];`);
  lines.push(``);
  lines.push(`export const CHAMPION_NAMES = CHAMPIONS.map((c) => c.name).sort();`);
  lines.push(``);

  const outPath = path.resolve(process.cwd(), "lib", "champions.ts");
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${entries.length} champions to lib/champions.ts (version ${version}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
