"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertCircle, Brain, RefreshCw, Swords, WandSparkles } from "lucide-react";
import { CHAMPION_NAMES } from "@/lib/champions";
import type { DraftRequest, RecommendationResponse, Role } from "@/lib/types";

const roles: { value: Role; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "jungle", label: "Jungle" },
  { value: "mid", label: "Mid" },
  { value: "bot", label: "Bot" },
  { value: "support", label: "Support" }
];

export default function Home() {
  const [role, setRole] = useState<Role>("top");
  const [alliedPicks, setAlliedPicks] = useState("Jinx, Lulu");
  const [enemyPicks, setEnemyPicks] = useState("Darius, Sejuani");
  const [bans, setBans] = useState("Fiora");
  const [championPool, setChampionPool] = useState("");
  const [useRiotId, setUseRiotId] = useState(false);
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [region, setRegion] = useState("na1");
  const [response, setResponse] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const championCount = useMemo(() => CHAMPION_NAMES.length, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const payload: DraftRequest = {
      role,
      alliedPicks: parseList(alliedPicks),
      enemyPicks: parseList(enemyPicks),
      bans: parseList(bans),
      championPool: parseList(championPool),
      riotId: useRiotId
        ? {
            gameName,
            tagLine,
            region
          }
        : undefined
    };

    try {
      const result = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await result.json();

      if (!result.ok) {
        throw new Error(json.error ?? "Recommendation request failed.");
      }

      setResponse(json as RecommendationResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Recommendation request failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="intro">
        <div>
          <p className="eyebrow">LoL Draft Assistant</p>
          <h1>Pick advice for the parts of draft that are hard to feel in-game.</h1>
          <p className="lede">
            Enter the visible draft and get practical champion recommendations with score
            breakdowns, risks, confidence, and freshness metadata. This Phase 1 prototype uses a
            deterministic scorer so the LLM layer can be added later as a coach, not a source of
            truth.
          </p>
        </div>
        <div className="status-strip" aria-label="Prototype status">
          <span>
            <Swords size={16} /> Manual draft
          </span>
          <span>
            <Brain size={16} /> Deterministic scoring
          </span>
          <span>
            <WandSparkles size={16} /> LLM-ready explanations
          </span>
        </div>
      </section>

      <section className="workspace">
        <form className="draft-panel" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Draft Input</p>
              <h2>Current pick context</h2>
            </div>
            <span className="pill">{championCount} champions</span>
          </div>

          <label className="field">
            <span>Your role</span>
            <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
              {roles.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="field-grid">
            <label className="field">
              <span>Allied picks</span>
              <input
                value={alliedPicks}
                onChange={(event) => setAlliedPicks(event.target.value)}
                placeholder="Jinx, Lulu"
              />
            </label>
            <label className="field">
              <span>Enemy picks</span>
              <input
                value={enemyPicks}
                onChange={(event) => setEnemyPicks(event.target.value)}
                placeholder="Darius, Sejuani"
              />
            </label>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Bans</span>
              <input
                value={bans}
                onChange={(event) => setBans(event.target.value)}
                placeholder="Fiora"
              />
            </label>
            <label className="field">
              <span>Champion pool filter</span>
              <input
                value={championPool}
                onChange={(event) => setChampionPool(event.target.value)}
                placeholder="Ornn, Malphite, Gwen"
              />
            </label>
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={useRiotId}
              onChange={(event) => setUseRiotId(event.target.checked)}
            />
            <span>Include optional Riot ID fields</span>
          </label>

          {useRiotId ? (
            <div className="riot-grid">
              <label className="field">
                <span>Game name</span>
                <input value={gameName} onChange={(event) => setGameName(event.target.value)} />
              </label>
              <label className="field">
                <span>Tag line</span>
                <input value={tagLine} onChange={(event) => setTagLine(event.target.value)} />
              </label>
              <label className="field">
                <span>Region</span>
                <input value={region} onChange={(event) => setRegion(event.target.value)} />
              </label>
            </div>
          ) : null}

          {error ? (
            <div className="error" role="alert">
              <AlertCircle size={18} />
              {error}
            </div>
          ) : null}

          <button className="primary-button" type="submit" disabled={isLoading}>
            {isLoading ? <RefreshCw size={18} className="spin" /> : <Swords size={18} />}
            {isLoading ? "Scoring draft" : "Recommend picks"}
          </button>
        </form>

        <section className="results-panel" aria-live="polite">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Recommendations</p>
              <h2>Best practical options</h2>
            </div>
            {response ? <span className="pill">{response.freshness.statsPatch}</span> : null}
          </div>

          {response ? (
            <>
              <div className="draft-notes">
                {response.draftNotes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>

              <div className="recommendation-list">
                {response.recommendations.map((recommendation, index) => (
                  <article className="recommendation-card" key={recommendation.champion}>
                    <div className="card-topline">
                      <div>
                        <span className="rank">#{index + 1}</span>
                        <h3>{recommendation.champion}</h3>
                        <p>{recommendation.title}</p>
                      </div>
                      <div className="score">{Math.round(recommendation.totalScore * 100)}</div>
                    </div>
                    <p className="explanation">{recommendation.explanation}</p>
                    <ScoreBars components={recommendation.components} />
                    <div className="meta-row">
                      <span>{recommendation.confidence} confidence</span>
                      <span>{recommendation.tags.slice(0, 4).join(" / ")}</span>
                    </div>
                    <ul className="risks">
                      {recommendation.risks.map((risk) => (
                        <li key={risk}>{risk}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>

              <div className="freshness">
                <span>Data: {response.freshness.dataDragonVersion}</span>
                <span>Generated: {new Date(response.freshness.generatedAt).toLocaleString()}</span>
                <span>
                  {response.freshness.personalizationUsed
                    ? "Personalized by match history"
                    : "Anonymous recommendation"}
                </span>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Swords size={36} />
              <p>Submit the default draft or enter your own picks to see ranked options.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function ScoreBars({
  components
}: {
  components: Record<string, number | undefined>;
}) {
  return (
    <div className="score-bars">
      {Object.entries(components)
        .filter(([, value]) => value !== undefined)
        .map(([label, value]) => (
          <div className="bar-row" key={label}>
            <span>{formatLabel(label)}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
            </div>
            <strong>{Math.round((value ?? 0) * 100)}</strong>
          </div>
        ))}
    </div>
  );
}

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatLabel(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
