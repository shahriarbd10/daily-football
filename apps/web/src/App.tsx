import { useEffect, useState } from "react";

import { getDashboard, getMatchDetails, getStandings } from "./api/client";
import { currentDhakaClock, formatDhakaDateTime, shiftDhakaDate, todayDhaka } from "./lib/time";
import type { DashboardPayload, Match, MatchDetail } from "./types";

const liveStatuses = ["LIVE", "IN_PLAY", "PAUSED"];
const finishedStatuses = ["FINISHED"];
const upcomingStatuses = ["SCHEDULED", "TIMED", "POSTPONED"];

const scoreLabel = (value: number | null) => (value === null ? "-" : value);
const teamLabel = (name: string, shortName?: string) => shortName ?? name;
const numericValue = (value: string | number) => (typeof value === "number" ? value : Number.parseFloat(value) || 0);
const statusTone = (status: string) => (liveStatuses.includes(status) ? "live" : status === "PAUSED" ? "paused" : status === "FINISHED" ? "done" : "upcoming");
const crestFallback = (name: string) =>
  name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();

const sortMatches = (matches: Match[], mode: string) => {
  const list = [...matches];
  if (mode === "kickoff-desc") return list.sort((l, r) => new Date(r.utcDate).getTime() - new Date(l.utcDate).getTime());
  if (mode === "status") {
    const priority = (status: string) => (liveStatuses.includes(status) ? 0 : upcomingStatuses.includes(status) ? 1 : finishedStatuses.includes(status) ? 2 : 3);
    return list.sort((l, r) => priority(l.status) - priority(r.status) || new Date(l.utcDate).getTime() - new Date(r.utcDate).getTime());
  }
  return list.sort((l, r) => new Date(l.utcDate).getTime() - new Date(r.utcDate).getTime());
};

function TeamCrest({ name, shortName, crest, size = "md" }: { name: string; shortName?: string; crest?: string; size?: "sm" | "md" | "lg" }) {
  return crest ? (
    <img className={`team-crest ${size}`} src={crest} alt={`${name} crest`} loading="lazy" />
  ) : (
    <div className={`team-crest fallback ${size}`} aria-label={`${name} crest fallback`}>{crestFallback(shortName ?? name)}</div>
  );
}

function MatchRow({
  match,
  active,
  onSelect,
  compact = false
}: {
  match: Match;
  active: boolean;
  onSelect: (matchId: string) => void;
  compact?: boolean;
}) {
  return (
    <button type="button" className={`match-row ${compact ? "compact" : ""} ${active ? "active" : ""}`} onClick={() => onSelect(match.providerMatchId)}>
      <div className="match-row-main">
        <div className="match-row-teams">
          <div className="team-line"><TeamCrest name={match.homeTeam.name} shortName={match.homeTeam.shortName} crest={match.homeTeam.crest} size="sm" /><span>{match.homeTeam.name}</span></div>
          <div className="team-line"><TeamCrest name={match.awayTeam.name} shortName={match.awayTeam.shortName} crest={match.awayTeam.crest} size="sm" /><span>{match.awayTeam.name}</span></div>
        </div>
        <div className="match-row-score"><strong>{scoreLabel(match.fullTime.home)}</strong><strong>{scoreLabel(match.fullTime.away)}</strong></div>
      </div>
      <div className="match-row-meta">
        <span>{match.competitionName}</span>
        <span>{formatDhakaDateTime(match.utcDate)}</span>
        <span className={`status ${statusTone(match.status)}`}>{match.minute ? `${match.minute}'` : match.status}</span>
      </div>
    </button>
  );
}

function MatchSection({ title, matches, selectedMatchId, onSelect, emptyLabel }: { title: string; matches: Match[]; selectedMatchId?: string; onSelect: (matchId: string) => void; emptyLabel: string }) {
  return (
    <section className="content-card stack-card">
      <div className="section-head"><div><p className="eyebrow">{title}</p><h3>{matches.length} matches</h3></div></div>
      {matches.length > 0 ? <div className="match-list">{matches.map((match) => <MatchRow key={`${title}-${match.providerMatchId}`} match={match} active={selectedMatchId === match.providerMatchId} onSelect={onSelect} compact />)}</div> : <div className="empty-state">{emptyLabel}</div>}
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
  const [detailTab, setDetailTab] = useState<"overview" | "stats" | "timeline">("overview");
  const [data, setData] = useState<{ previous: DashboardPayload; current: DashboardPayload; next: DashboardPayload } | null>(null);
  const [standings, setStandings] = useState<DashboardPayload["standings"] | null>(null);
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
        const [previous, current, next] = await Promise.all([getDashboard(shiftDhakaDate(date, -1)), getDashboard(date), getDashboard(shiftDhakaDate(date, 1))]);
        if (!active) return;
        setData({ previous, current, next });
        setStandings(current.standings);
        setStandingsCompetition((currentCompetition) => currentCompetition ?? current.standings.competitionCode);
        setSelectedMatchId((currentMatchId) => currentMatchId ?? current.liveMatches[0]?.providerMatchId ?? current.matches[0]?.providerMatchId ?? previous.matches[0]?.providerMatchId ?? next.matches[0]?.providerMatchId);
        setError(undefined);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load data");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 180000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [date]);

  useEffect(() => {
    if (!standingsCompetition || standings?.competitionCode === standingsCompetition) return;
    let active = true;
    const loadStandings = async () => {
      try {
        const payload = await getStandings(standingsCompetition);
        if (!active) return;
        setStandings(payload);
        setError(undefined);
      } catch (standingsError) {
        if (active) setError(standingsError instanceof Error ? standingsError.message : "Unable to load standings");
      }
    };
    void loadStandings();
    return () => {
      active = false;
    };
  }, [standingsCompetition, standings?.competitionCode]);

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
        if (!active) return;
        setDetail(payload);
        setError(undefined);
      } catch (detailError) {
        if (active) setError(detailError instanceof Error ? detailError.message : "Unable to load match details");
      } finally {
        if (active) setDetailLoading(false);
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
  const filterCompetition = (matches: Match[]) => (selectedCompetition ? matches.filter((match) => match.competitionCode === selectedCompetition) : matches);
  const previousMatches = sortMatches(filterCompetition(previousData?.matches ?? []).filter((match) => finishedStatuses.includes(match.status)), "kickoff-desc");
  const currentMatches = sortMatches(filterCompetition(currentData?.matches ?? []), sortMode);
  const nextMatches = sortMatches(filterCompetition(nextData?.matches ?? []).filter((match) => upcomingStatuses.includes(match.status)), "kickoff-asc");
  const liveMatches = filterCompetition(currentData?.liveMatches ?? []);
  const nextThree = sortMatches([...currentMatches.filter((match) => upcomingStatuses.includes(match.status)), ...nextMatches], "kickoff-asc").slice(0, 4);
  const standingsRows = standingsExpanded ? standings?.standings ?? [] : standings?.standings.slice(0, 10) ?? [];
  const selectedCompetitionName = currentData?.competitions.find((competition) => competition.code === selectedCompetition)?.name ?? "All leagues";
  const heroMatch = currentMatches.find((match) => match.providerMatchId === selectedMatchId) ?? liveMatches[0] ?? currentMatches[0] ?? previousMatches[0] ?? nextMatches[0];

  useEffect(() => {
    const availableMatches = [...currentMatches, ...previousMatches, ...nextMatches];
    if (availableMatches.length === 0) return;
    if (!availableMatches.some((match) => match.providerMatchId === selectedMatchId)) setSelectedMatchId(availableMatches[0]?.providerMatchId);
  }, [selectedCompetition, selectedMatchId, currentMatches, previousMatches, nextMatches]);

  return (
    <div className="app-shell">
      <div className="bg-orb orb-left" />
      <div className="bg-orb orb-right" />
      <div className="app-frame">
        <header className="app-topbar">
          <div><p className="eyebrow">Bangladesh live score hub</p><h1>Football Freak</h1></div>
          <div className="topbar-meta"><span>{clock}</span><span>Asia/Dhaka</span></div>
        </header>

        <section className="hero-grid">
          <article className="hero-card">
            <div className="hero-card-top">
              <div><p className="eyebrow">Featured match</p><h2>{heroMatch?.competitionName ?? "No featured match"}</h2></div>
              {heroMatch && <span className={`status ${statusTone(heroMatch.status)}`}>{heroMatch.minute ? `${heroMatch.minute}'` : heroMatch.status}</span>}
            </div>
            {heroMatch ? (
              <>
                <div className="hero-scoreline">
                  <div className="hero-team"><TeamCrest name={heroMatch.homeTeam.name} shortName={heroMatch.homeTeam.shortName} crest={heroMatch.homeTeam.crest} size="lg" /><strong>{teamLabel(heroMatch.homeTeam.name, heroMatch.homeTeam.shortName)}</strong></div>
                  <div className="hero-score-box"><b>{scoreLabel(heroMatch.fullTime.home)} <span>:</span> {scoreLabel(heroMatch.fullTime.away)}</b><small>{formatDhakaDateTime(heroMatch.utcDate)}</small></div>
                  <div className="hero-team"><TeamCrest name={heroMatch.awayTeam.name} shortName={heroMatch.awayTeam.shortName} crest={heroMatch.awayTeam.crest} size="lg" /><strong>{teamLabel(heroMatch.awayTeam.name, heroMatch.awayTeam.shortName)}</strong></div>
                </div>
                <div className="hero-actions">
                  <button type="button" className="primary-button" onClick={() => setSelectedMatchId(heroMatch.providerMatchId)}>Open match center</button>
                  <button type="button" className="ghost-button" onClick={() => setActiveModal("next-up")}>Next fixtures</button>
                </div>
              </>
            ) : <div className="empty-state">No match found for the selected date window.</div>}
          </article>

          <aside className="side-summary">
            <article className="summary-card">
              <div className="section-head"><div><p className="eyebrow">Date rail</p><h3>Quick jump</h3></div></div>
              <div className="date-rail">
                <button type="button" className="date-chip" onClick={() => setDate((current) => shiftDhakaDate(current, -1))}><span>Prev</span><strong>{shiftDhakaDate(date, -1).slice(8)}</strong></button>
                <button type="button" className={`date-chip ${date === todayDhaka() ? "active" : ""}`} onClick={() => setDate(todayDhaka())}><span>Today</span><strong>{todayDhaka().slice(8)}</strong></button>
                <button type="button" className="date-chip" onClick={() => setDate((current) => shiftDhakaDate(current, 1))}><span>Next</span><strong>{shiftDhakaDate(date, 1).slice(8)}</strong></button>
              </div>
              <label className="calendar-field"><span>Calendar</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            </article>

            <article className="summary-card">
              <div className="section-head"><div><p className="eyebrow">Live board</p><h3>{liveMatches.length} in play</h3></div><button type="button" className="link-button" onClick={() => setActiveModal("window")}>View window</button></div>
              <div className="summary-stats">
                <div><span>Selected day</span><strong>{currentMatches.length}</strong></div>
                <div><span>Upcoming</span><strong>{nextThree.length}</strong></div>
                <div><span>Provider</span><strong>football-data</strong></div>
              </div>
            </article>
          </aside>
        </section>

        <section className="control-strip content-card">
          <div className="section-head">
            <div><p className="eyebrow">Competitions</p><h3>{selectedCompetitionName}</h3></div>
            <label className="sort-inline"><span>Sort</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value)}><option value="kickoff-asc">Kickoff earliest</option><option value="kickoff-desc">Kickoff latest</option><option value="status">Status priority</option></select></label>
          </div>
          <div className="league-scroller">
            <button type="button" className={selectedCompetition === undefined ? "league-pill active" : "league-pill"} onClick={() => setSelectedCompetition(undefined)}>All leagues</button>
            {currentData?.competitions.map((competition) => (
              <button type="button" key={competition.code} className={selectedCompetition === competition.code ? "league-pill active" : "league-pill"} onClick={() => { setSelectedCompetition(competition.code); setStandingsCompetition(competition.code); }}>
                {competition.name}
              </button>
            ))}
          </div>
        </section>

        <main className="app-grid">
          <section className="feed-column">
            <section className="content-card">
              <div className="section-head"><div><p className="eyebrow">Live matches</p><h3>Pulse board</h3></div></div>
              {liveMatches.length > 0 ? (
                <div className="live-carousel">
                  {liveMatches.map((match) => (
                    <button type="button" key={match.providerMatchId} className={`live-card ${selectedMatchId === match.providerMatchId ? "active" : ""}`} onClick={() => setSelectedMatchId(match.providerMatchId)}>
                      <span>{match.competitionName}</span>
                      <div className="live-score"><strong>{teamLabel(match.homeTeam.name, match.homeTeam.shortName)}</strong><b>{scoreLabel(match.fullTime.home)} - {scoreLabel(match.fullTime.away)}</b><strong>{teamLabel(match.awayTeam.name, match.awayTeam.shortName)}</strong></div>
                      <em>{match.minute ? `${match.minute}'` : match.status}</em>
                    </button>
                  ))}
                </div>
              ) : <div className="empty-state">No live matches now. Browse the scheduled and finished sections below.</div>}
            </section>

            <div className="stack-grid">
              <MatchSection title={`Today in Dhaka • ${date}`} matches={currentMatches} selectedMatchId={selectedMatchId} onSelect={setSelectedMatchId} emptyLabel="No matches found on the selected Bangladesh date." />
              <MatchSection title={`Upcoming • ${shiftDhakaDate(date, 1)}`} matches={nextMatches} selectedMatchId={selectedMatchId} onSelect={setSelectedMatchId} emptyLabel="No upcoming matches found for the next Bangladesh day." />
              <MatchSection title={`Previous • ${shiftDhakaDate(date, -1)}`} matches={previousMatches} selectedMatchId={selectedMatchId} onSelect={setSelectedMatchId} emptyLabel="No completed matches found for the previous Bangladesh day." />
            </div>
          </section>

          <aside className="center-column">
            <section className="content-card match-center">
              {detail ? (
                <>
                  <div className="match-center-top"><div><p className="eyebrow">{detail.competitionName}</p><h2>{detail.stage ?? "Match details"}</h2><p className="subtle-copy">{detail.venue ?? "Venue TBA"} • {formatDhakaDateTime(detail.utcDate)}</p></div><span className={`status ${statusTone(detail.status)}`}>{detail.minute ? `${detail.minute}'` : detail.status}</span></div>
                  <div className="center-scoreboard">
                    <div className="center-team"><TeamCrest name={detail.homeTeam.name} shortName={detail.homeTeam.shortName} crest={detail.homeTeam.crest} size="lg" /><strong>{detail.homeTeam.name}</strong><span>{detail.homeTeam.shortName}</span></div>
                    <div className="center-score"><b>{scoreLabel(detail.score.home)} <span>:</span> {scoreLabel(detail.score.away)}</b><small>HT {scoreLabel(detail.score.halfTimeHome)} - {scoreLabel(detail.score.halfTimeAway)}</small></div>
                    <div className="center-team"><TeamCrest name={detail.awayTeam.name} shortName={detail.awayTeam.shortName} crest={detail.awayTeam.crest} size="lg" /><strong>{detail.awayTeam.name}</strong><span>{detail.awayTeam.shortName}</span></div>
                  </div>
                  <div className="detail-tabs">
                    <button type="button" className={detailTab === "overview" ? "detail-tab active" : "detail-tab"} onClick={() => setDetailTab("overview")}>Overview</button>
                    <button type="button" className={detailTab === "stats" ? "detail-tab active" : "detail-tab"} onClick={() => setDetailTab("stats")}>Stats</button>
                    <button type="button" className={detailTab === "timeline" ? "detail-tab active" : "detail-tab"} onClick={() => setDetailTab("timeline")}>Timeline</button>
                  </div>
                  {detailTab === "overview" && <div className="detail-pane"><section className="mini-panel"><div className="section-head"><div><p className="eyebrow">Summary</p><h3>Match note</h3></div></div><p className="subtle-copy">{detail.summary}</p></section><section className="mini-panel"><div className="section-head"><div><p className="eyebrow">Goal sheet</p><h3>Scorers</h3></div></div><div className="scorer-columns"><div className="scorer-column"><span className="mini-label">{detail.homeTeam.shortName ?? detail.homeTeam.name}</span>{detail.incidents.filter((incident) => incident.type === "goal" && incident.team === "home").length > 0 ? detail.incidents.filter((incident) => incident.type === "goal" && incident.team === "home").map((incident, index) => <div className="scorer-chip" key={`home-${incident.minute}-${index}`}><strong>{incident.player}</strong><span>{incident.minute}'</span></div>) : <div className="scorer-chip muted">No scorers</div>}</div><div className="scorer-column"><span className="mini-label">{detail.awayTeam.shortName ?? detail.awayTeam.name}</span>{detail.incidents.filter((incident) => incident.type === "goal" && incident.team === "away").length > 0 ? detail.incidents.filter((incident) => incident.type === "goal" && incident.team === "away").map((incident, index) => <div className="scorer-chip" key={`away-${incident.minute}-${index}`}><strong>{incident.player}</strong><span>{incident.minute}'</span></div>) : <div className="scorer-chip muted">No scorers</div>}</div></div></section></div>}
                  {detailTab === "stats" && <div className="detail-pane"><section className="mini-panel"><div className="section-head"><div><p className="eyebrow">Statistics</p><h3>Head to head</h3></div></div><div className="stat-stack">{detail.stats.map((stat) => { const home = numericValue(stat.home); const away = numericValue(stat.away); const total = home + away; const homeWidth = total > 0 ? `${(home / total) * 100}%` : "50%"; const awayWidth = total > 0 ? `${(away / total) * 100}%` : "50%"; return <article className="stat-card" key={stat.label}><div className="stat-values"><strong>{stat.home}</strong><span>{stat.label}</span><strong>{stat.away}</strong></div><div className="dual-bar"><div className="dual-bar-home" style={{ width: homeWidth }} /><div className="dual-bar-away" style={{ width: awayWidth }} /></div></article>; })}</div></section></div>}
                  {detailTab === "timeline" && <div className="detail-pane"><section className="mini-panel"><div className="section-head"><div><p className="eyebrow">Timeline</p><h3>{detail.incidents.length} events</h3></div></div>{detail.incidents.length > 0 ? <div className="timeline-feed">{detail.incidents.map((incident, index) => <article className={`timeline-item ${incident.team}`} key={`${incident.minute}-${index}`}><span>{incident.minute === 0 ? "Info" : `${incident.minute}'`}</span><div><strong>{incident.player}</strong><p>{incident.detail}</p></div></article>)}</div> : <div className="empty-state">No detailed event feed is available for this match yet.</div>}</section></div>}
                </>
              ) : <div className="empty-state">Choose a match to open the match center.</div>}
              {detailLoading && <div className="subtle-copy">Loading match center...</div>}
            </section>

            <section className="content-card">
              <div className="section-head"><div><p className="eyebrow">Standings</p><h3>{standings?.competitionName ?? "Loading..."}</h3></div><button type="button" className="link-button" onClick={() => setStandingsExpanded((current) => !current)}>{standingsExpanded ? "Show less" : "Show all"}</button></div>
              <div className="table-wrap"><table><thead><tr><th>#</th><th>Team</th><th>Pts</th><th>GD</th></tr></thead><tbody>{standingsRows.map((row) => <tr key={row.teamName}><td>{row.position}</td><td>{row.teamName}</td><td>{row.points}</td><td>{row.goalDifference}</td></tr>)}</tbody></table></div>
            </section>
          </aside>
        </main>
      </div>

      {activeModal && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="section-head"><div><p className="eyebrow">{activeModal === "window" ? "Date window" : "Next up"}</p><h3>{activeModal === "window" ? "Bangladesh three-day spread" : "Closest upcoming fixtures"}</h3></div><button type="button" className="ghost-button" onClick={() => setActiveModal(null)}>Close</button></div>
            {activeModal === "window" ? (
              <div className="modal-grid">
                <article className="modal-metric"><span>Previous</span><strong>{previousMatches.length}</strong><small>{shiftDhakaDate(date, -1)}</small></article>
                <article className="modal-metric"><span>Selected</span><strong>{currentMatches.length}</strong><small>{date}</small></article>
                <article className="modal-metric"><span>Next</span><strong>{nextMatches.length}</strong><small>{shiftDhakaDate(date, 1)}</small></article>
                <article className="modal-metric"><span>Live</span><strong>{liveMatches.length}</strong><small>{clock}</small></article>
              </div>
            ) : (
              <div className="match-list">{nextThree.length > 0 ? nextThree.map((match) => <MatchRow key={`upcoming-${match.providerMatchId}`} match={match} active={selectedMatchId === match.providerMatchId} onSelect={(matchId) => { setSelectedMatchId(matchId); setActiveModal(null); }} />) : <div className="empty-state">No upcoming fixtures are available around the selected Bangladesh date.</div>}</div>
            )}
          </div>
        </div>
      )}

      {loading && <div className="toast">Refreshing live data...</div>}
      {error && <div className="toast error">{error}</div>}
    </div>
  );
}
