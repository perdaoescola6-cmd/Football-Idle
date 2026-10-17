"use client";
import { useState } from "react";
import type {
  CardEdition,
  FootballEvent,
  FootballMatch,
} from "../../../../packages/contracts/brasfoot";
import {
  matchStatistics,
  participantReport,
} from "../../../../packages/contracts/match-report";
const eventLabels: Record<FootballEvent["type"], string> = {
  KICKOFF: "INÍCIO",
  PASS: "PASSE",
  DRIBBLE: "CONDUÇÃO",
  SHOT: "CHUTE",
  GOAL: "GOL",
  SAVE: "DEFESA",
  SUBSTITUTION: "TROCA",
  FULLTIME: "FIM",
};
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("");
}
function formationPoints(formation: string, side: number) {
  const rows = [1, ...formation.split("-").map(Number)],
    points: { x: number; y: number }[] = [];
  rows.forEach((count, row) => {
    for (let i = 0; i < count; i++)
      points.push({
        x:
          side === 0
            ? 6 + (row * 40) / (rows.length - 1)
            : 94 - (row * 40) / (rows.length - 1),
        y: ((i + 1) * 100) / (count + 1),
      });
  });
  return points;
}
export function MatchDetail({
  match,
  live,
  minute,
  onPlayer,
}: {
  match: FootballMatch;
  live: boolean;
  minute: number;
  onPlayer: (card: CardEdition) => void;
}) {
  const [view, setView] = useState<"SUMMARY" | "LINEUPS" | "FIELD">("SUMMARY"),
    [allEvents, setAllEvents] = useState(false),
    [side, setSide] = useState<"HOME" | "AWAY">(
      match.homeAI && !match.awayAI ? "AWAY" : "HOME",
    );
  const cut = live ? Math.max(0, Math.min(90, Math.floor(minute))) : 90,
    events = match.events.filter((e) => e.minute <= cut),
    stats = matchStatistics(events),
    score = live
      ? [stats.home.goals, stats.away.goals]
      : (match.score ?? [stats.home.goals, stats.away.goals]),
    rows = participantReport(match, cut),
    last = events.at(-1);
  const rated = rows
      .filter((r) => r.rating !== null)
      .sort(
        (a, b) =>
          b.rating! - a.rating! ||
          b.goals - a.goals ||
          b.minutes - a.minutes ||
          a.card.player.localeCompare(b.card.player),
      ),
    best = !live ? rated[0] : undefined;
  const player = (id?: string) =>
    rows.find((r) => r.card.id === id)?.card ??
    [...match.home, ...match.away].find((c) => c.id === id);
  const log = events
    .filter((e) => allEvents || !["PASS", "DRIBBLE"].includes(e.type))
    .slice()
    .reverse();
  const lineups = (
    <div className="matchdesk-teams">
      {(["HOME", "AWAY"] as const).map((team) => (
        <div key={team}>
          <h3>{team === "HOME" ? match.homeName : match.awayName}</h3>
          <table>
            <thead>
              <tr>
                <th>Atleta</th>
                <th>Função</th>
                <th>Min.</th>
                <th>Cond.</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => r.side === team)
                .map((r) => (
                  <tr key={r.card.id}>
                    <td>
                      <button
                        className="v2-name-link"
                        onClick={() => onPlayer(r.card)}
                      >
                        {r.card.player}
                      </button>
                      {match.captainId === r.card.id ? (
                        <abbr
                          className="matchdesk-captain"
                          title="Capitão inicial"
                        >
                          C
                        </abbr>
                      ) : null}
                      <small>
                        {r.from > 0 ? ` ↑ ${r.from}′` : ""}
                        {r.to !== undefined ? ` ↓ ${r.to}′` : ""}
                        {r.goals ? ` · ⚽ ${r.goals}` : ""}
                        {r.assists ? ` · ${r.assists} assistência(s)` : ""}
                      </small>
                    </td>
                    <td>{r.card.role ?? r.card.position}</td>
                    <td>{Math.floor(r.minutes)}′</td>
                    <td
                      className={
                        r.energy !== null && r.energy < 55
                          ? "manager-tired"
                          : ""
                      }
                    >
                      {r.energy === null ? "—" : `${r.energy}%`}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
  return (
    <section
      className="matchdesk"
      aria-label={`Detalhes de ${match.homeName} contra ${match.awayName}`}
    >
      <header className="matchdesk-board">
        <div className="matchdesk-status">
          <span>
            {live
              ? match.pausedAt !== undefined
                ? "Ⅱ PAUSADO"
                : "● AO VIVO"
              : "APITO FINAL"}
          </span>
          <span>{cut}′ / 90′</span>
        </div>
        <div className="matchdesk-score">
          <div>
            <span className="matchdesk-crest home">
              {initials(match.homeName)}
            </span>
            <strong>{match.homeName}</strong>
          </div>
          <b aria-label={`Placar ${score[0]} a ${score[1]}`}>
            {score[0]}
            <i>:</i>
            {score[1]}
          </b>
          <div>
            <span className="matchdesk-crest away">
              {initials(match.awayName)}
            </span>
            <strong>{match.awayName}</strong>
          </div>
        </div>
        <progress max={90} value={cut} aria-label="Progresso da partida" />
        <p className="matchdesk-latest" role="status">
          {last?.narration ?? "As equipes aguardam o apito inicial."}
        </p>
      </header>
      <nav className="matchdesk-tabs" aria-label="Visualização da partida">
        {(
          [
            ["SUMMARY", "Súmula"],
            ["LINEUPS", "Escalações"],
            ["FIELD", "Campo tático"],
          ] as const
        ).map(([id, name]) => (
          <button
            key={id}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {name}
          </button>
        ))}
      </nav>
      {view === "FIELD" ? (
        <section className="fb-panel">
          <div
            className="matchdesk-field"
            aria-label="Diagrama estático das formações"
          >
            <div className="matchdesk-half" />
            <div className="matchdesk-circle" />
            {[match.home, match.away].map((team, index) => {
              const points = formationPoints(
                (index === 0 ? match.homeAI : match.awayAI)
                  ? "4-4-2"
                  : match.formation,
                index,
              );
              return team.map((card, i) => (
                <button
                  key={index + ":" + card.id}
                  className={`matchdesk-marker team-${index} ${i === 0 ? "keeper" : ""}`}
                  style={{ left: `${points[i].x}%`, top: `${points[i].y}%` }}
                  title={`${card.player} · ${card.role ?? card.position}`}
                  aria-label={`Ver ${card.player} no campo tático`}
                  onClick={() => onPlayer(card)}
                >
                  {i + 1}
                </button>
              ));
            })}
          </div>
          <p className="v2-note">
            Formação esquemática, sem animação ou acompanhamento físico da bola.
            Números identificam os slots da escalação. Clique para abrir a
            ficha.
          </p>
        </section>
      ) : null}
      {view === "LINEUPS" ? (
        <section className="fb-panel">
          <h3>Escalações e substituições</h3>
          {lineups}
          <p className="v2-note">
            ↑ Entrada · ↓ Saída · condição no momento da saída para
            substituídos. O cansaço é recuperado no próximo jogo.
          </p>
        </section>
      ) : null}
      {view === "SUMMARY" ? (
        <>
          {!live && best ? (
            <section className="fb-panel matchdesk-awards">
              <div>
                <span className="eyebrow">MELHOR EM CAMPO</span>
                <button
                  className="v2-name-link"
                  onClick={() => onPlayer(best.card)}
                >
                  {best.card.player}
                </button>
                <span className="matchdesk-grade high">
                  {best.rating!.toFixed(1)}
                </span>
              </div>
              {match.reward !== undefined ? (
                <div>
                  <span>Coins da partida</span>
                  <strong>+{match.reward.toLocaleString("pt-BR")}</strong>
                </div>
              ) : null}
            </section>
          ) : null}
          <section className="fb-panel">
            <h3>Estatísticas da partida</h3>
            <div className="matchdesk-stats">
              {(
                [
                  ["Posse estimada por passes (%)", "possession"],
                  ["Finalizações", "shots"],
                  ["No alvo", "shotsOnTarget"],
                  ["Defesas", "saves"],
                  ["Passes completos", "passes"],
                ] as const
              ).map(([label, key]) => {
                const h = stats.home[key],
                  a = stats.away[key],
                  ratio = h + a ? (h / (h + a)) * 100 : 50;
                return (
                  <div key={key}>
                    <div>
                      <b>{h}</b>
                      <span>{label}</span>
                      <b>{a}</b>
                    </div>
                    <div
                      className="matchdesk-statbar"
                      aria-label={`${label}: ${h} a ${a}`}
                    >
                      <i style={{ width: `${ratio}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="v2-note">
              Contagens dos lances confirmados. Posse é uma estimativa por
              passes; xG, faltas e cartões ainda não são calculados neste motor.
            </p>
          </section>
          {!live ? (
            <section className="fb-panel">
              <div className="matchdesk-section-heading">
                <h3>Notas dos atletas</h3>
                <div className="matchdesk-tabs">
                  {(["HOME", "AWAY"] as const).map((t) => (
                    <button
                      key={t}
                      aria-pressed={side === t}
                      onClick={() => setSide(t)}
                    >
                      {t === "HOME" ? match.homeName : match.awayName}
                    </button>
                  ))}
                </div>
              </div>
              <div className="matchdesk-ratings">
                {rows
                  .filter((r) => r.side === side)
                  .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
                  .map((r) => (
                    <div key={r.card.id}>
                      <button
                        className="v2-name-link"
                        onClick={() => onPlayer(r.card)}
                      >
                        {r.card.player}
                        <small>
                          {Math.floor(r.minutes)}′{" "}
                          {r.goals ? ` · ⚽ ${r.goals}` : ""}
                          {r.assists ? ` · ${r.assists} assistência(s)` : ""}
                          {r.saves ? ` · ${r.saves} defesa(s)` : ""}
                        </small>
                      </button>
                      <span>
                        {r.energy === null ? "" : `cond. ${r.energy}`}
                      </span>
                      <b
                        className={`matchdesk-grade ${r.rating !== null && r.rating >= 7.5 ? "high" : r.rating !== null && r.rating < 6 ? "low" : ""}`}
                      >
                        {r.rating === null ? "—" : r.rating.toFixed(1)}
                      </b>
                    </div>
                  ))}
              </div>
              <p className="v2-note">
                Notas experimentais de 1 a 10, com a mesma fórmula usada no
                histórico esportivo. Não alteram recompensas. Notas não
                disponíveis para partidas antigas sem dados completos.
              </p>
            </section>
          ) : null}
        </>
      ) : null}
      <section className="fb-panel">
        <div className="matchdesk-section-heading">
          <h3>Lance a lance</h3>
          <button
            className="v2-name-link"
            aria-pressed={allEvents}
            onClick={() => setAllEvents(!allEvents)}
          >
            {allEvents ? "Mostrar destaques" : "Incluir passes e conduções"}
          </button>
        </div>
        <ol className="matchdesk-log" aria-label="Narração da partida">
          {log.map((event, index) => {
            const actor = player(event.actorId),
              assist = player(event.assistId);
            return (
              <li
                className={`event-${event.type.toLowerCase()} side-${event.side.toLowerCase()}`}
                key={
                  match.id + ":" + event.minute + ":" + event.type + ":" + index
                }
              >
                <time>{Math.floor(event.minute)}′</time>
                <span className="matchdesk-event-label">
                  {eventLabels[event.type]}
                </span>
                <div>
                  <p>
                    {event.narration ??
                      `${eventLabels[event.type]} · ${event.actor}`}
                  </p>
                  {actor ? (
                    <button
                      className="v2-name-link"
                      onClick={() => onPlayer(actor)}
                    >
                      {actor.player}
                    </button>
                  ) : null}
                  {assist ? (
                    <>
                      <span> · assistência: </span>
                      <button
                        className="v2-name-link"
                        onClick={() => onPlayer(assist)}
                      >
                        {assist.player}
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </section>
  );
}
