import { recommendDraft } from "../lib/recommender";

const response = recommendDraft({
  role: "top",
  alliedPicks: ["Jinx", "Lulu"],
  enemyPicks: ["Darius", "Sejuani"],
  bans: ["Fiora"]
});

if (response.recommendations.length < 3) {
  throw new Error("Expected at least 3 recommendations.");
}

const unavailable = new Set(["jinx", "lulu", "darius", "sejuani", "fiora"]);
const invalidRecommendation = response.recommendations.find((recommendation) =>
  unavailable.has(recommendation.champion.toLowerCase().replace(/[^a-z0-9]/g, ""))
);

if (invalidRecommendation) {
  throw new Error(`Unavailable champion was recommended: ${invalidRecommendation.champion}`);
}

for (const recommendation of response.recommendations) {
  if (!recommendation.explanation || recommendation.risks.length === 0) {
    throw new Error(`Recommendation missing explanation or risks: ${recommendation.champion}`);
  }
}

console.log(
  JSON.stringify(
    {
      count: response.recommendations.length,
      topPick: response.recommendations[0]?.champion,
      freshness: response.freshness
    },
    null,
    2
  )
);
