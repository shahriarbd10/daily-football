import { useEffect, useState } from "react";

import { getDashboard, getMatchDetails } from "./api/client";
import { currentDhakaClock, formatDhakaDateTime, formatDhakaKickoff, shiftDhakaDate, todayDhaka } from "./lib/time";
import type { DashboardPayload, Match, MatchDetail } from "./types";

const liveStatuses = ["LIVE", "IN_PLAY", "PAUSED"];
const finishedStatuses = ["FINISHED"];
const upcomingStatuses = ["SCHEDULED", "TIMED", "POSTPONED"];

const scoreLabel = (value: number | null) => (value === null ? "-" : value);
const teamLabel = (name: string, shortName?: string) => shortName ?? name;
const numericValue = (value: string | number) => (typeof value === "number" ? value : Number.parseFloat(value) || 0);

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

const crestFallback = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

function TeamCrest({
  name,
  shortName,
  crest,
  size = "md"
}: {
  name: string;
  shortName?: string;
  crest?: string;
  size?: "sm" | "md" | "lg";
}) {
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
      if (statusDelta !== 0) {
        return statusDelta;
      }

      return new Date(left.utcDate).getTime() - new Date(right.utcDate).getTime();
    });
  }

  return list.sort((left, right) => new Date(left.utcDate).getTime() - new Date(right.utcDate).getTime());
};

function MatchCard({
  match,
  active,
  onSelect
}: {
  match: Match;
  active: boolean;
  onSelect: (matchId: string) => void;
}) {
  return (
    <button type="button" className={`match-card ${active ? "active" : ""}`} onClick={() => onSelect(match.providerMatchId)}>
      <div className="match-card-top">
        <span>{formatDhakaKickoff(match.utcDate)}</span>
        <span className={`status ${statusTone(match.status)}`}>{match.minute ? `${match.minute}'` : match.status}</span>
      </div>

      <div className="match-card-body">
        <div className="match-team-row">
          <div className="match-team-meta">
            <TeamCrest name={match.homeTeam.name} shortName={match.homeTeam.shortName} crest={match.homeTeam.crest} size="sm" />
            <span>{match.homeTeam.name}</span>
          </div>
          <strong>{scoreLabel(match.fullTime.home)}</strong>
        </div>

        <div className="match-team-row">
          <div className="match-team-meta">
            <TeamCrest name={match.awayTeam.name} shortName={match.awayTeam.shortName} crest={match.awayTeam.crest} size="sm" />
            <span>{match.awayTeam.name}</span>
          </div>
          <strong>{scoreLabel(match.fullTime.away)}</strong>
        </div>
      </div>
    </button>
  );
}

function CompetitionGroup({
  title,
  subtitle,
  groups,
  selectedMatchId,
  onSelect,
  emptyLabel
}: {
  title: string;
  subtitle: string;
  groups: Record<string, Match[]>;
  selectedMatchId?: string;
  onSelect: (matchId: string) => void;
  emptyLabel: string;
}) {
  return (
    <section className="day-section">
      <div className="section-title-row">
        <div>
          <p className="section-kicker">{title}</p>
          <h2>{subtitle}</h2>
        </div>
      </div>

      {Object.keys(groups).length > 0 ? (
        <div className="group-grid">
          {Object.entries(groups).map(([competitionCode, matches]) => (
            <article className="competition-panel" key={`${title}-${competitionCode}`}>
              <div className="competition-panel-head">
                <div>
                  <h3>{matches[0]?.competitionName}</h3>
                  <p>{matches[0]?.areaName}</p>
                </div>
                <span>{matches.length} matches</span>
              </div>

              <div className="competition-match-list">
                {matches.map((match) => (
                  <MatchCard key={match.providerMatchId} match={match} active={selectedMatchId === match.providerMatchId} onSelect={onSelect} />
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <article className="empty-panel">{emptyLabel}</article>
      )}
    </section>
  );
}

export default function App() {
  const [date, setDate] = useState(todayDhaka());
  const [selectedCompetition, setSelectedCompetition] = useState<string>();
  const [standingsCompetition, setStandingsCompetition] = useState<string>();
  const [selectedMatchId, setSelectedMatchId] = useState<string>();
  const [sortMode, setSortMode] = useState("kickoff-asc");
  const [clock, setClock] = useState(currentDhakaClock());
  const [standingsExpanded, setStandingsExpanded] = useState(false);
  const [activeModal, setActiveModal] = useState<"window" | "next-up" | null>(null);
  const [data, setData] = useState<{
    previous: DashboardPayload;
    current: DashboardPayload;
    next: DashboardPayload;
  } | null>(null);
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
        const previousDate = shiftDhakaDate(date, -1);
        const nextDate = shiftDhakaDate(date, 1);
        const [previous, current, next] = await Promise.all([
          getDashboard(previousDate, standingsCompetition),
          getDashboard(date, standingsCompetition),
          getDashboard(nextDate, standingsCompetition)
        ]);

        if (!active) {
          return;
        }

        setData({ previous, current, next });
        setStandingsCompetition((currentCompetition) => currentCompetition ?? current.standings.competitionCode);
        setSelectedMatchId(
          (currentMatchId) =>
            currentMatchId ??
            current.liveMatches[0]?.providerMatchId ??
            current.matches[0]?.providerMatchId ??
            previous.matches[0]?.providerMatchId ??
            next.matches[0]?.providerMatchId
        );
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
    const timer = window.setInterval(() => void load(), 180000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [date, standingsCompetition]);

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

  const currentData = data?.current ?? null;
  const previousData = data?.previous ?? null;
  const nextData = data?.next ?? null;

  const filterCompetition = (matches: Match[]) =>
    selectedCompetition ? matches.filter((match) => match.competitionCode === selectedCompetition) : matches;

  const previousMatches = sortMatches(filterCompetition(previousData?.matches ?? []), "kickoff-desc");
  const currentMatches = sortMatches(filterCompetition(currentData?.matches ?? []), sortMode);
  const nextMatches = sortMatches(filterCompetition(nextData?.matches ?? []), "kickoff-asc");
  const groupedPrevious = groupMatches(previousMatches);
  const groupedCurrent = groupMatches(currentMatches);
  const groupedNext = groupMatches(nextMatches);
  const featuredLive = currentData?.liveMatches[0];
  const nextThree = sortMatches(
    [
      ...currentMatches.filter((match) => upcomingStatuses.includes(match.status)),
      ...nextMatches.filter((match) => upcomingStatuses.includes(match.status))
    ],
    "kickoff-asc"
  ).slice(0, 4);
  const standingsRows = standingsExpanded
    ? currentData?.standings.standings ?? []
    : currentData?.standings.standings.slice(0, 8) ?? [];

  return (
    <div className="shell live-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <header className="top-hero">
        <div className="hero-copy-block panel">
          <div className="hero-meta-row">
            <span className="hero-badge">Live data board</span>
            <span className="hero-clock">{clock}</span>
          </div>

          <h1>Football Freak</h1>
          <p className="hero-summary">
            Live football browsing in Bangladesh time with previous-day results, current-day fixtures, next-day upcoming matches, and a dedicated match center.
          </p>

          <div className="hero-metric-grid">
            <button type="button" className="metric-card" onClick={() => setActiveModal("window")}>
              <span className="metric-label">Selected date</span>
              <strong>{currentData?.meta.date ?? date}</strong>
              <small>{currentMatches.length} matches</small>
            </button>

            <button type="button" className="metric-card" onClick={() => setActiveModal("next-up")} disabled={nextThree.length === 0}>
              <span className="metric-label">Next up</span>
              <strong>{nextThree.length > 0 ? `${teamLabel(nextThree[0].homeTeam.name, nextThree[0].homeTeam.shortName)} vs ${teamLabel(nextThree[0].awayTeam.name, nextThree[0].awayTeam.shortName)}` : "No upcoming match"}</strong>
              <small>{nextThree.length > 0 ? formatDhakaDateTime(nextThree[0].utcDate) : "No fixtures nearby"}</small>
            </button>

            <article className="metric-card static">
              <span className="metric-label">Live pulse</span>
              <strong>{currentData?.liveMatches.length ?? 0}</strong>
              <small>matches in play now</small>
            </article>
          </div>
        </div>

        <aside className="control-block panel">
          <div className="control-head">
            <h2>Date control</h2>
            <span>Asia/Dhaka</span>
          </div>

          <div className="date-actions">
            <button type="button" className="soft-button" onClick={() => setDate((current) => shiftDhakaDate(current, -1))}>
              Prev day
            </button>
            <button type="button" className="soft-button" onClick={() => setDate(todayDhaka())}>
              Today
            </button>
            <button type="button" className="soft-button" onClick={() => setDate((current) => shiftDhakaDate(current, 1))}>
              Next day
            </button>
          </div>

          <label className="date-picker">
            <span>Calendar</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>

          <label className="sort-control">
            <span>Sort matches</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
              <option value="kickoff-asc">Kickoff: earliest</option>
              <option value="kickoff-desc">Kickoff: latest</option>
              <option value="status">Status priority</option>
            </select>
          </label>

          <p className="panel-footnote">Last refreshed: {currentData?.meta.lastUpdatedLabel ?? "Loading..."}</p>
        </aside>
      </header>

      <main className="live-layout">
        <section className="browse-column">
          <section className="panel filter-panel">
            <div className="section-title-row">
              <div>
                <p className="section-kicker">Competitions</p>
                <h2>Browse all leagues</h2>
              </div>
              <span className="section-caption">Filtering the match board does not restrict the default load anymore.</span>
            </div>

            <div className="tab-row">
              <button type="button" className={selectedCompetition === undefined ? "tab-chip active" : "tab-chip"} onClick={() => setSelectedCompetition(undefined)}>
                All leagues
              </button>
              {currentData?.competitions.map((competition) => (
                <button
                  type="button"
                  key={competition.code}
                  className={competition.code === selectedCompetition ? "tab-chip active" : "tab-chip"}
                  onClick={() => {
                    setSelectedCompetition(competition.code);
                    setStandingsCompetition(competition.code);
                  }}
                >
                  {competition.name}
                </button>
              ))}
            </div>
          </section>

          <section className="panel live-strip-panel">
            <div className="section-title-row">
              <div>
                <p className="section-kicker">Live pulse</p>
                <h2>{currentData?.liveMatches.length ?? 0} matches in play</h2>
              </div>
            </div>

            <div className="live-strip">
              {(currentData?.liveMatches.length ?? 0) > 0 ? (
                currentData?.liveMatches.map((match) => (
                  <button
                    type="button"
                    className={`live-tile ${selectedMatchId === match.providerMatchId ? "selected" : ""}`}
                    key={match.providerMatchId}
                    onClick={() => setSelectedMatchId(match.providerMatchId)}
                  >
                    <span>{match.competitionName}</span>
                    <strong>
                      {teamLabel(match.homeTeam.name, match.homeTeam.shortName)} {scoreLabel(match.fullTime.home)} - {scoreLabel(match.fullTime.away)} {teamLabel(match.awayTeam.name, match.awayTeam.shortName)}
                    </strong>
                    <em>{match.minute ? `${match.minute}'` : match.status}</em>
                  </button>
                ))
              ) : (
                <article className="empty-panel">No live matches right now. Use the three date sections below to browse real schedules and results.</article>
              )}
            </div>
          </section>

          <CompetitionGroup
            title="Previous day"
            subtitle={`${previousMatches.length} matches around ${shiftDhakaDate(date, -1)}`}
            groups={groupedPrevious}
            selectedMatchId={selectedMatchId}
            onSelect={setSelectedMatchId}
            emptyLabel="No matches found for the previous Bangladesh day."
          />

          <CompetitionGroup
            title="Selected day"
            subtitle={`${currentMatches.length} matches on ${date}`}
            groups={groupedCurrent}
            selectedMatchId={selectedMatchId}
            onSelect={setSelectedMatchId}
            emptyLabel="No matches found on the selected Bangladesh date."
          />

          <CompetitionGroup
            title="Next day"
            subtitle={`${nextMatches.length} matches around ${shiftDhakaDate(date, 1)}`}
            groups={groupedNext}
            selectedMatchId={selectedMatchId}
            onSelect={setSelectedMatchId}
            emptyLabel="No matches found for the next Bangladesh day."
          />
        </section>

        <aside className="detail-column">
          <section className="panel detail-panel">
            {detail ? (
              <>
                <div className="detail-head">
                  <div>
                    <p className="section-kicker">{detail.competitionName}</p>
                    <h2>{detail.stage ?? "Match center"}</h2>
                    <p className="panel-footnote">
                      {detail.venue ?? "Venue TBA"} | {formatDhakaDateTime(detail.utcDate)}
                    </p>
                  </div>
                  <span className={`status ${statusTone(detail.status)}`}>{detail.minute ? `${detail.minute}'` : detail.status}</span>
                </div>

                <div className="score-hero">
                  <div className="score-team">
                    <TeamCrest name={detail.homeTeam.name} shortName={detail.homeTeam.shortName} crest={detail.homeTeam.crest} size="lg" />
                    <strong>{detail.homeTeam.name}</strong>
                    <span>{detail.homeTeam.shortName}</span>
                  </div>

                  <div className="score-core">
                    <b>
                      {scoreLabel(detail.score.home)} : {scoreLabel(detail.score.away)}
                    </b>
                    <small>
                      HT {scoreLabel(detail.score.halfTimeHome)} - {scoreLabel(detail.score.halfTimeAway)}
                    </small>
                  </div>

                  <div className="score-team align-right">
                    <TeamCrest name={detail.awayTeam.name} shortName={detail.awayTeam.shortName} crest={detail.awayTeam.crest} size="lg" />
                    <strong>{detail.awayTeam.name}</strong>
                    <span>{detail.awayTeam.shortName}</span>
                  </div>
                </div>

                <div className="detail-grid">
                  <section className="detail-card">
                    <div className="section-title-row compact">
                      <div>
                        <p className="section-kicker">Scorers</p>
                        <h3>Goal sheet</h3>
                      </div>
                    </div>

                    <div className="scorer-grid">
                      <div className="scorer-column">
                        <span className="scorer-label">{detail.homeTeam.shortName ?? detail.homeTeam.name}</span>
                        {getScorersByTeam(detail, "home").length > 0 ? (
                          getScorersByTeam(detail, "home").map((incident, index) => (
                            <div className="scorer-row" key={`home-${incident.minute}-${index}`}>
                              <strong>{incident.player}</strong>
                              <span>{incident.minute}'</span>
                            </div>
                          ))
                        ) : (
                          <div className="scorer-row muted">No scorers</div>
                        )}
                      </div>

                      <div className="scorer-column align-right">
                        <span className="scorer-label">{detail.awayTeam.shortName ?? detail.awayTeam.name}</span>
                        {getScorersByTeam(detail, "away").length > 0 ? (
                          getScorersByTeam(detail, "away").map((incident, index) => (
                            <div className="scorer-row" key={`away-${incident.minute}-${index}`}>
                              <strong>{incident.player}</strong>
                              <span>{incident.minute}'</span>
                            </div>
                          ))
                        ) : (
                          <div className="scorer-row muted">No scorers</div>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="detail-card">
                    <div className="section-title-row compact">
                      <div>
                        <p className="section-kicker">Summary</p>
                        <h3>Match note</h3>
                      </div>
                    </div>
                    <p className="detail-copy">{detail.summary}</p>
                  </section>

                  <section className="detail-card">
                    <div className="section-title-row compact">
                      <div>
                        <p className="section-kicker">Statistics</p>
                        <h3>Side by side</h3>
                      </div>
                    </div>

                    <div className="stats-list">
                      {detail.stats.map((stat) => {
                        const home = numericValue(stat.home);
                        const away = numericValue(stat.away);
                        const total = home + away;
                        const homeWidth = total > 0 ? `${(home / total) * 100}%` : "50%";

                        return (
                          <article className="stat-row" key={stat.label}>
                            <div className="stat-head">
                              <strong>{stat.home}</strong>
                              <span>{stat.label}</span>
                              <strong>{stat.away}</strong>
                            </div>
                            <div className="stat-track">
                              <div className="stat-bar" style={{ width: homeWidth }} />
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>

                  <section className="detail-card">
                    <div className="section-title-row compact">
                      <div>
                        <p className="section-kicker">Timeline</p>
                        <h3>{detail.incidents.length} events</h3>
                      </div>
                    </div>

                    <div className="timeline-list">
                      {detail.incidents.length > 0 ? (
                        detail.incidents.map((incident, index) => (
                          <article className={`timeline-row ${incident.team}`} key={`${incident.minute}-${index}`}>
                            <span className="timeline-minute">{incident.minute === 0 ? "Info" : `${incident.minute}'`}</span>
                            <div>
                              <strong>{incident.player}</strong>
                              <p>{incident.detail}</p>
                            </div>
                          </article>
                        ))
                      ) : (
                        <article className="empty-panel compact">No detailed event feed is available for this match.</article>
                      )}
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <article className="empty-panel">Choose any match from the board to open the live match center.</article>
            )}

            {detailLoading && <div className="panel-footnote">Loading match detail...</div>}
          </section>

          <section className="panel standings-panel">
            <div className="section-title-row">
              <div>
                <p className="section-kicker">Standings</p>
                <h2>{currentData?.standings.competitionName ?? "Loading..."}</h2>
              </div>
              <button type="button" className="soft-button" onClick={() => setStandingsExpanded((current) => !current)}>
                {standingsExpanded ? "Show less" : "Show all"}
              </button>
            </div>

            <div className="table-shell">
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
            <div className="section-title-row">
              <div>
                <p className="section-kicker">{activeModal === "window" ? "Date window" : "Upcoming"}</p>
                <h2>{activeModal === "window" ? "Three-day overview" : "Next up around selected date"}</h2>
              </div>
              <button type="button" className="soft-button" onClick={() => setActiveModal(null)}>
                Close
              </button>
            </div>

            {activeModal === "window" ? (
              <div className="modal-metric-grid">
                <article className="metric-card static">
                  <span className="metric-label">Previous day</span>
                  <strong>{previousMatches.length}</strong>
                  <small>{shiftDhakaDate(date, -1)}</small>
                </article>
                <article className="metric-card static">
                  <span className="metric-label">Selected day</span>
                  <strong>{currentMatches.length}</strong>
                  <small>{date}</small>
                </article>
                <article className="metric-card static">
                  <span className="metric-label">Next day</span>
                  <strong>{nextMatches.length}</strong>
                  <small>{shiftDhakaDate(date, 1)}</small>
                </article>
                <article className="metric-card static">
                  <span className="metric-label">Live now</span>
                  <strong>{currentData?.liveMatches.length ?? 0}</strong>
                  <small>{clock}</small>
                </article>
              </div>
            ) : (
              <div className="modal-upcoming-list">
                {nextThree.length > 0 ? (
                  nextThree.map((match) => (
                    <button
                      type="button"
                      className="upcoming-row"
                      key={match.providerMatchId}
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
                  ))
                ) : (
                  <p className="panel-footnote">No upcoming fixtures are available around the selected Bangladesh date.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {loading && <div className="toast">Refreshing live data...</div>}
      {error && <div className="toast error">{error}</div>}
    </div>
  );
}
