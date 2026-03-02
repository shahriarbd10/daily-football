import { useEffect, useState } from "react";

import { getDashboard, getMatchDetails } from "./api/client";
import { currentDhakaClock, formatDhakaDateTime, formatDhakaKickoff, shiftDhakaDate, todayDhaka } from "./lib/time";
import type { DashboardPayload, Match, MatchDetail } from "./types";

const scoreLabel = (value: number | null) => (value === null ? "-" : value);

const statusTone = (status: string) => {
  if (["LIVE", "IN_PLAY"].includes(status)) return "live";
  if (status === "PAUSED") return "paused";
  if (status === "FINISHED") return "done";
  return "upcoming";
};

const groupMatches = (matches: Match[]) =>
  matches.reduce<Record<string, Match[]>>((accumulator, match) => {
    if (!accumulator[match.competitionCode]) {
      accumulator[match.competitionCode] = [];
    }

    accumulator[match.competitionCode].push(match);
    return accumulator;
  }, {});

const numericValue = (value: string | number) => (typeof value === "number" ? value : Number.parseFloat(value) || 0);
const liveStatuses = ["LIVE", "IN_PLAY", "PAUSED"];
const finishedStatuses = ["FINISHED"];
const upcomingStatuses = ["SCHEDULED", "TIMED", "POSTPONED"];

const teamLabel = (name: string, shortName?: string) => shortName ?? name;

const crestFallback = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

function TeamCrest({ name, shortName, crest, size = "md" }: { name: string; shortName?: string; crest?: string; size?: "sm" | "md" | "lg" }) {
  return crest ? (
    <img className={`team-crest ${size}`} src={crest} alt={`${name} crest`} loading="lazy" />
  ) : (
    <div className={`team-crest fallback ${size}`} aria-label={`${name} crest fallback`}>
      {crestFallback(shortName ?? name)}
    </div>
  );
}

const getScorersByTeam = (detail: MatchDetail, team: "home" | "away") =>
  detail.incidents.filter((incident) => incident.type === "goal" && incident.team === team);

const sortMatches = (matches: Match[], mode: string) => {
  const list = [...matches];

  if (mode === "kickoff-desc") {
    return list.sort((left, right) => new Date(right.utcDate).getTime() - new Date(left.utcDate).getTime());
  }

  if (mode === "status") {
    const priority = (status: string) => {
      if (liveStatuses.includes(status)) return 0;
      if (upcomingStatuses.includes(status)) return 1;
      if (finishedStatuses.includes(status)) return 2;
      return 3;
    };

    return list.sort((left, right) => {
      const statusDelta = priority(left.status) - priority(right.status);
      if (statusDelta !== 0) return statusDelta;
      return new Date(left.utcDate).getTime() - new Date(right.utcDate).getTime();
    });
  }

  return list.sort((left, right) => new Date(left.utcDate).getTime() - new Date(right.utcDate).getTime());
};

function MatchRow({
  match,
  active,
  onSelect
}: {
  match: Match;
  active: boolean;
  onSelect: (matchId: string) => void;
}) {
  return (
    <button type="button" className={`fixture-card ${active ? "active" : ""}`} onClick={() => onSelect(match.providerMatchId)}>
      <div className="fixture-meta">
        <span>{formatDhakaKickoff(match.utcDate)}</span>
        <span className={`status ${statusTone(match.status)}`}>{match.minute ? `${match.minute}'` : match.status}</span>
      </div>
      <div className="teams">
        <div className="team-row">
          <span className="team-name">
            <TeamCrest name={match.homeTeam.name} shortName={match.homeTeam.shortName} crest={match.homeTeam.crest} size="sm" />
            {match.homeTeam.name}
          </span>
          <strong>{scoreLabel(match.fullTime.home)}</strong>
        </div>
        <div className="team-row">
          <span className="team-name">
            <TeamCrest name={match.awayTeam.name} shortName={match.awayTeam.shortName} crest={match.awayTeam.crest} size="sm" />
            {match.awayTeam.name}
          </span>
          <strong>{scoreLabel(match.fullTime.away)}</strong>
        </div>
      </div>
    </button>
  );
}

export default function App() {
  const [date, setDate] = useState(todayDhaka());
  const [selectedCompetition, setSelectedCompetition] = useState<string>();
  const [selectedMatchId, setSelectedMatchId] = useState<string>();
  const [sortMode, setSortMode] = useState("kickoff-asc");
  const [clock, setClock] = useState(currentDhakaClock());
  const [standingsExpanded, setStandingsExpanded] = useState(false);
  const [activeModal, setActiveModal] = useState<"today" | "next-up" | null>(null);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const timer = window.setInterval(() => setClock(currentDhakaClock()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const payload = await getDashboard(date, selectedCompetition);

        if (!active) {
          return;
        }

        setData(payload);
        setSelectedCompetition((current) => current ?? payload.standings.competitionCode);
        setSelectedMatchId((current) => current ?? payload.liveMatches[0]?.providerMatchId ?? payload.matches[0]?.providerMatchId);
        setError(undefined);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load data");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 60000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [date, selectedCompetition]);

  useEffect(() => {
    if (!selectedMatchId) {
      setDetail(null);
      return;
    }

    let active = true;

    const loadDetail = async () => {
      try {
        setDetailLoading(true);
        const payload = await getMatchDetails(selectedMatchId);

        if (!active) {
          return;
        }

        setDetail(payload);
      } catch (detailError) {
        if (active) {
          setError(detailError instanceof Error ? detailError.message : "Unable to load match details");
        }
      } finally {
        if (active) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      active = false;
    };
  }, [selectedMatchId]);

  const visibleMatches = selectedCompetition
    ? (data?.matches ?? []).filter((match) => match.competitionCode === selectedCompetition)
    : (data?.matches ?? []);
  const sortedMatches = sortMatches(visibleMatches, sortMode);
  const upcomingMatches = sortedMatches.filter((match) => upcomingStatuses.includes(match.status));
  const previousMatches = sortedMatches.filter((match) => finishedStatuses.includes(match.status));
  const todayLiveMatches = sortedMatches.filter((match) => liveStatuses.includes(match.status));
  const groupedUpcoming = groupMatches(upcomingMatches);
  const groupedPrevious = groupMatches(previousMatches);
  const groupedToday = groupMatches(todayLiveMatches);
  const featuredLive = data?.liveMatches[0];
  const nextThree = sortMatches(
    (selectedCompetition
      ? (data?.matches ?? []).filter((match) => match.competitionCode === selectedCompetition)
      : (data?.matches ?? [])
    ).filter((match) => upcomingStatuses.includes(match.status)),
    "kickoff-asc"
  ).slice(0, 3);
  const standingsRows = standingsExpanded ? data?.standings.standings ?? [] : data?.standings.standings.slice(0, 8) ?? [];

  return (
    <div className="shell">
      <div className="glow glow-one" />
      <div className="glow glow-two" />

      <header className="hero">
        <section className="hero-main">
          <p className="eyebrow">Bangladesh-localized live score hub</p>
          <h1>Football Freak</h1>
          <p className="hero-copy">
            A flexible match board for top leagues and major internationals with a lightweight SofaScore-style flow:
            quick scan first, deeper match detail on click.
          </p>

          <div className="hero-highlights">
            <article className="headline-card primary-tile">
              <span className="tile-label">Featured live</span>
              {featuredLive ? (
                <>
                  <strong>{featuredLive.competitionName}</strong>
                  <div className="headline-score" onClick={() => setSelectedMatchId(featuredLive.providerMatchId)} role="button" tabIndex={0}>
                    <span className="headline-team">
                      <TeamCrest
                        name={featuredLive.homeTeam.name}
                        shortName={featuredLive.homeTeam.shortName}
                        crest={featuredLive.homeTeam.crest}
                        size="sm"
                      />
                      {teamLabel(featuredLive.homeTeam.name, featuredLive.homeTeam.shortName)}
                    </span>
                    <b>
                      {scoreLabel(featuredLive.fullTime.home)} : {scoreLabel(featuredLive.fullTime.away)}
                    </b>
                    <span className="headline-team right">
                      {teamLabel(featuredLive.awayTeam.name, featuredLive.awayTeam.shortName)}
                      <TeamCrest
                        name={featuredLive.awayTeam.name}
                        shortName={featuredLive.awayTeam.shortName}
                        crest={featuredLive.awayTeam.crest}
                        size="sm"
                      />
                    </span>
                  </div>
                </>
              ) : (
                <p>No live match at the moment.</p>
              )}
            </article>

            <article className="headline-card">
              <span className="tile-label">Today in Dhaka</span>
              <button type="button" className="headline-action" onClick={() => setActiveModal("today")}>
                <strong>{data?.meta.date ?? date}</strong>
              </button>
              <p>{data?.matches.length ?? 0} listed matches across tracked competitions.</p>
              <p className="live-clock">Now: {clock}</p>
            </article>

            <article className="headline-card">
              <span className="tile-label">Next up</span>
              <button
                type="button"
                className="headline-action summary-trigger"
                onClick={() => setActiveModal("next-up")}
                disabled={nextThree.length === 0}
              >
                View all
              </button>
              {nextThree.length > 0 ? (
                nextThree.map((match) => (
                  <button
                    key={match.providerMatchId}
                    type="button"
                    className="next-link"
                    onClick={() => {
                      setSelectedMatchId(match.providerMatchId);
                      setActiveModal("next-up");
                    }}
                  >
                    <span>{teamLabel(match.homeTeam.name, match.homeTeam.shortName)} vs {teamLabel(match.awayTeam.name, match.awayTeam.shortName)}</span>
                    <span>{formatDhakaKickoff(match.utcDate)}</span>
                  </button>
                ))
              ) : (
                <p>No upcoming fixtures for {date}.</p>
              )}
            </article>
          </div>
        </section>

        <aside className="hero-side">
          <div className="hero-panel">
            <div className="meta-chip">Timezone: Asia/Dhaka</div>
            <div className="date-nav">
              <button type="button" className="nav-button" onClick={() => setDate((current) => shiftDhakaDate(current, -1))}>
                Prev day
              </button>
              <button type="button" className="nav-button" onClick={() => setDate(todayDhaka())}>
                Today
              </button>
              <button type="button" className="nav-button" onClick={() => setDate((current) => shiftDhakaDate(current, 1))}>
                Next day
              </button>
            </div>
            <label className="date-picker">
              <span>Match date</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <p className="meta-copy">Last refreshed: {data?.meta.lastUpdatedLabel ?? "Loading..."}</p>
          </div>

          <div className="sidebar-card compact spotlight">
            <p className="eyebrow">Product focus</p>
            <h3>Fast homepage, deeper match view</h3>
            <p>Click any match to open live context, incidents, and stat comparison without adding login complexity.</p>
          </div>
        </aside>
      </header>

      <main className="dashboard">
        <section className="board">
          <div className="section-head">
            <h2>Live pulse</h2>
            <span>{data?.liveMatches.length ?? 0} matches live</span>
          </div>

          <div className="live-ribbon">
            {(data?.liveMatches.length ?? 0) > 0 ? (
              data?.liveMatches.map((match) => (
                <button
                  type="button"
                  className={`live-ticker ${selectedMatchId === match.providerMatchId ? "selected" : ""}`}
                  key={match.providerMatchId}
                  onClick={() => setSelectedMatchId(match.providerMatchId)}
                >
                  <span>{match.competitionName}</span>
                  <strong className="ticker-scoreline">
                    <span className="ticker-team">
                      <TeamCrest name={match.homeTeam.name} shortName={match.homeTeam.shortName} crest={match.homeTeam.crest} size="sm" />
                      {teamLabel(match.homeTeam.name, match.homeTeam.shortName)}
                    </span>
                    <span>
                      {scoreLabel(match.fullTime.home)} - {scoreLabel(match.fullTime.away)}
                    </span>
                    <span className="ticker-team right">
                      {teamLabel(match.awayTeam.name, match.awayTeam.shortName)}
                      <TeamCrest name={match.awayTeam.name} shortName={match.awayTeam.shortName} crest={match.awayTeam.crest} size="sm" />
                    </span>
                  </strong>
                  <em>{match.minute ? `${match.minute}'` : match.status}</em>
                </button>
              ))
            ) : (
              <article className="empty-card">No live matches right now. Use the board below to browse fixtures and open details.</article>
            )}
          </div>

          <div className="section-head">
            <h2>Competitions</h2>
            <span>Filter leagues and sort the feed</span>
          </div>

          <div className="toolbar">
            <div className="tabs">
              <button
                type="button"
                className={selectedCompetition === undefined ? "tab active" : "tab"}
                onClick={() => setSelectedCompetition(undefined)}
              >
                All leagues
              </button>
              {data?.competitions.map((competition) => (
                <button
                  type="button"
                  key={competition.code}
                  className={competition.code === selectedCompetition ? "tab active" : "tab"}
                  onClick={() => setSelectedCompetition(competition.code)}
                >
                  {competition.name}
                </button>
              ))}
            </div>

            <label className="sort-control">
              <span>Sort</span>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                <option value="kickoff-asc">Kickoff: earliest</option>
                <option value="kickoff-desc">Kickoff: latest</option>
                <option value="status">Status priority</option>
              </select>
            </label>
          </div>

          <section className="match-section">
            <div className="section-head">
              <h2>Today's matches</h2>
              <span>{sortedMatches.length} matches on this date</span>
            </div>

            {Object.keys(groupedToday).length > 0 ? (
              <div className="competition-board">
                {Object.entries(groupedToday).map(([competitionCode, matches]) => (
                  <section className="competition-block" key={`today-${competitionCode}`}>
                    <div className="competition-head">
                      <div>
                        <h3>{matches[0]?.competitionName}</h3>
                        <span>{matches[0]?.areaName}</span>
                      </div>
                      <span>{matches.length} live/current</span>
                    </div>

                    <div className="fixture-stack">
                      {matches.map((match) => (
                        <MatchRow key={match.providerMatchId} match={match} active={selectedMatchId === match.providerMatchId} onSelect={setSelectedMatchId} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <article className="empty-card">No live or in-progress matches for the selected filters.</article>
            )}
          </section>

          <section className="match-section">
            <div className="section-head">
              <h2>Upcoming matches</h2>
              <span>{sortedMatches.filter((match) => upcomingStatuses.includes(match.status)).length} fixtures ahead</span>
            </div>

            {Object.keys(groupedUpcoming).length > 0 ? (
              <div className="competition-board">
                {Object.entries(groupedUpcoming).map(([competitionCode, matches]) => (
                  <section className="competition-block" key={`upcoming-${competitionCode}`}>
                    <div className="competition-head">
                      <div>
                        <h3>{matches[0]?.competitionName}</h3>
                        <span>{matches[0]?.areaName}</span>
                      </div>
                      <span>{matches.length} upcoming</span>
                    </div>

                    <div className="fixture-stack">
                      {matches.map((match) => (
                        <MatchRow key={match.providerMatchId} match={match} active={selectedMatchId === match.providerMatchId} onSelect={setSelectedMatchId} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <article className="empty-card">No upcoming matches for the selected filters.</article>
            )}
          </section>

          <section className="match-section">
            <div className="section-head">
              <h2>Previous matches</h2>
              <span>{sortedMatches.filter((match) => finishedStatuses.includes(match.status)).length} completed results</span>
            </div>

            {Object.keys(groupedPrevious).length > 0 ? (
              <div className="competition-board">
                {Object.entries(groupedPrevious).map(([competitionCode, matches]) => (
                  <section className="competition-block" key={`previous-${competitionCode}`}>
                    <div className="competition-head">
                      <div>
                        <h3>{matches[0]?.competitionName}</h3>
                        <span>{matches[0]?.areaName}</span>
                      </div>
                      <span>{matches.length} finished</span>
                    </div>

                    <div className="fixture-stack">
                      {matches.map((match) => (
                        <MatchRow key={match.providerMatchId} match={match} active={selectedMatchId === match.providerMatchId} onSelect={setSelectedMatchId} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <article className="empty-card">No previous results for the selected filters.</article>
            )}
          </section>
        </section>

        <aside className="detail-column">
          <section className="detail-panel">
            {detail ? (
              <>
                <div className="detail-top">
                  <div>
                    <p className="eyebrow">{detail.competitionName}</p>
                    <h2>{detail.stage ?? "Match details"}</h2>
                    <p className="meta-copy">
                      {detail.venue ?? "Venue TBA"} | {formatDhakaDateTime(detail.utcDate)}
                    </p>
                  </div>
                  <span className={`status ${statusTone(detail.status)}`}>{detail.minute ? `${detail.minute}'` : detail.status}</span>
                </div>

                <div className="detail-scorecard">
                  <div className="detail-team">
                    <TeamCrest name={detail.homeTeam.name} shortName={detail.homeTeam.shortName} crest={detail.homeTeam.crest} size="lg" />
                    <strong>{detail.homeTeam.name}</strong>
                    <span>{detail.homeTeam.shortName}</span>
                  </div>
                  <div className="detail-score">
                    <b>
                      {scoreLabel(detail.score.home)} : {scoreLabel(detail.score.away)}
                    </b>
                    <span>
                      HT {scoreLabel(detail.score.halfTimeHome)} - {scoreLabel(detail.score.halfTimeAway)}
                    </span>
                  </div>
                  <div className="detail-team align-right">
                    <TeamCrest name={detail.awayTeam.name} shortName={detail.awayTeam.shortName} crest={detail.awayTeam.crest} size="lg" />
                    <strong>{detail.awayTeam.name}</strong>
                    <span>{detail.awayTeam.shortName}</span>
                  </div>
                </div>

                <div className="scorers-card">
                  <div className="section-head">
                    <h3>Scorers</h3>
                    <span>Goal timeline</span>
                  </div>
                  <div className="scorers-grid">
                    <div className="scorer-column">
                      <span className="scorer-team-label">{detail.homeTeam.shortName ?? detail.homeTeam.name}</span>
                      {getScorersByTeam(detail, "home").length > 0 ? (
                        getScorersByTeam(detail, "home").map((incident, index) => (
                          <div className="scorer-line" key={`home-${incident.minute}-${index}`}>
                            <strong>{incident.player}</strong>
                            <span>{incident.minute}'</span>
                          </div>
                        ))
                      ) : (
                        <div className="scorer-line muted">No scorers</div>
                      )}
                    </div>
                    <div className="scorer-column align-right">
                      <span className="scorer-team-label">{detail.awayTeam.shortName ?? detail.awayTeam.name}</span>
                      {getScorersByTeam(detail, "away").length > 0 ? (
                        getScorersByTeam(detail, "away").map((incident, index) => (
                          <div className="scorer-line" key={`away-${incident.minute}-${index}`}>
                            <strong>{incident.player}</strong>
                            <span>{incident.minute}'</span>
                          </div>
                        ))
                      ) : (
                        <div className="scorer-line muted">No scorers</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="summary-card">
                  <p className="eyebrow">Match summary</p>
                  <p>{detail.summary}</p>
                </div>

                <div className="stats-card">
                  <div className="section-head">
                    <h3>Statistics</h3>
                    <span>Live comparison</span>
                  </div>
                  <div className="stats-list">
                    {detail.stats.map((stat) => {
                      const home = numericValue(stat.home);
                      const away = numericValue(stat.away);
                      const total = home + away;
                      const homeWidth = total > 0 ? `${(home / total) * 100}%` : "50%";

                      return (
                        <article className="stat-row" key={stat.label}>
                          <div className="stat-values">
                            <strong>{stat.home}</strong>
                            <span>{stat.label}</span>
                            <strong>{stat.away}</strong>
                          </div>
                          <div className="stat-track">
                            <div className="stat-home" style={{ width: homeWidth }} />
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>

                <div className="timeline-card">
                  <div className="section-head">
                    <h3>Timeline</h3>
                    <span>{detail.incidents.length} key events</span>
                  </div>
                  <div className="timeline-list">
                    {detail.incidents.map((incident, index) => (
                      <article className={`timeline-item ${incident.team}`} key={`${incident.minute}-${index}`}>
                        <span className="timeline-minute">{incident.minute === 0 ? "Info" : `${incident.minute}'`}</span>
                        <div>
                          <strong>{incident.player}</strong>
                          <p>{incident.detail}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <article className="empty-card">Choose a match to open its score detail, incidents, and stat profile.</article>
            )}
            {detailLoading && <div className="detail-loading">Loading match detail...</div>}
          </section>

          <section className="sidebar-card standings-panel">
            <div className="section-head">
              <h2>Standings</h2>
              <button type="button" className="fold-button" onClick={() => setStandingsExpanded((current) => !current)}>
                {standingsExpanded ? "Show less" : "Show all"}
              </button>
            </div>
            <p className="meta-copy standings-meta">{data?.standings.competitionName ?? "Loading..."}</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Team</th>
                    <th>Pts</th>
                    <th>GD</th>
                  </tr>
                </thead>
                <tbody>
                  {standingsRows.map((row) => (
                    <tr key={row.teamName}>
                      <td>{row.position}</td>
                      <td>{row.teamName}</td>
                      <td>{row.points}</td>
                      <td>{row.goalDifference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </aside>
      </main>

      {activeModal && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h2>{activeModal === "today" ? "Today in Dhaka" : "Next up"}</h2>
              <button type="button" className="fold-button" onClick={() => setActiveModal(null)}>
                Close
              </button>
            </div>

            {activeModal === "today" ? (
              <div className="modal-body">
                <p className="meta-copy">Current Bangladesh time: {clock}</p>
                <p className="meta-copy">Selected date: {date}</p>
                <div className="modal-grid">
                  <article className="modal-stat">
                    <strong>{sortedMatches.length}</strong>
                    <span>Total matches</span>
                  </article>
                  <article className="modal-stat">
                    <strong>{sortedMatches.filter((match) => liveStatuses.includes(match.status)).length}</strong>
                    <span>Live/current</span>
                  </article>
                  <article className="modal-stat">
                    <strong>{upcomingMatches.length}</strong>
                    <span>Upcoming</span>
                  </article>
                  <article className="modal-stat">
                    <strong>{previousMatches.length}</strong>
                    <span>Previous</span>
                  </article>
                </div>
              </div>
            ) : (
              <div className="modal-body">
                {nextThree.length > 0 ? (
                  <div className="modal-list">
                    {nextThree.map((match) => (
                      <button
                        type="button"
                        key={match.providerMatchId}
                        className="modal-match"
                        onClick={() => {
                          setSelectedMatchId(match.providerMatchId);
                          setActiveModal(null);
                        }}
                      >
                        <div>
                          <strong>{teamLabel(match.homeTeam.name, match.homeTeam.shortName)} vs {teamLabel(match.awayTeam.name, match.awayTeam.shortName)}</strong>
                          <p>{match.competitionName}</p>
                        </div>
                        <span>{formatDhakaDateTime(match.utcDate)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="meta-copy">No upcoming fixtures are available for {date} in Bangladesh time.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {loading && <div className="toast">Refreshing match data...</div>}
      {error && <div className="toast error">{error}</div>}
    </div>
  );
}
