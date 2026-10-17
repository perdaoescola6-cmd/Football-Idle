"use client";
import { useEffect, useState } from "react";
import type {
  CardEdition,
  FootballView,
} from "../../../../packages/contracts/brasfoot";
import { api } from "./api";
type Preview = {
  home: CardEdition[];
  away: CardEdition[];
  homeName: string;
  awayName: string;
  difficulty: string;
  ownOvr: number;
  opponentOvr: number;
};
export function PreMatch({
  f,
  onPlayer,
}: {
  f: FootballView;
  onPlayer: (c: CardEdition) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (f.season.round > 14) return;
    void api<Preview>("/brasfoot/preview")
      .then((p) => {
        if (active) setPreview(p);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [
    f.season.number,
    f.season.round,
    f.formation,
    f.tactic,
    f.lineup.join(","),
    f.cards.map((c) => `${c.id}:${c.upgrades ?? 0}`).join(","),
  ]);
  return (
    <section className="fb-panel">
      <p className="eyebrow">VESTIÁRIO / PRÉ-JOGO</p>
      <h2>Prepare a próxima rodada</h2>
      {preview ? (
        <>
          <p>
            {preview.homeName} × {preview.awayName} · dificuldade{" "}
            {preview.difficulty.toLowerCase()}
          </p>
          <div className="v2-stat-strip">
            <span>
              <strong>{preview.ownOvr}</strong>seu OVR médio
            </span>
            <span>
              <strong>{preview.opponentOvr}</strong>OVR adversário
            </span>
            <span>
              <strong>{f.formation}</strong>formação
            </span>
          </div>
          <p>
            Expectativa baseada na força das escalações; o resultado depende dos
            eventos e das decisões táticas.
          </p>
          <details>
            <summary>Escalações previstas</summary>
            <div className="v2-two-teams">
              {[preview.home, preview.away].map((team, side) => (
                <div key={side}>
                  <h3>{side === 0 ? preview.homeName : preview.awayName}</h3>
                  {team.map((c) => (
                    <p key={c.id}>
                      <button
                        className="v2-name-link"
                        onClick={() => onPlayer(c)}
                      >
                        {c.player}
                      </button>{" "}
                      · {c.role ?? c.position} · {c.rating}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </details>
        </>
      ) : (
        <p>{error || "Preparando as escalações…"}</p>
      )}
    </section>
  );
}
export { MatchDetail as MatchExperience } from "./MatchDetail";
export function SeasonCalendar({
  f,
  onClub,
}: {
  f: FootballView;
  onClub: (id: string) => void;
}) {
  const [seasonIndex, setSeasonIndex] = useState(-1),
    [round, setRound] = useState(Math.min(14, f.season.round));
  const archived = seasonIndex >= 0 ? f.seasons[seasonIndex] : undefined,
    fixtures = archived?.fixtures ?? f.season.fixtures,
    table = archived?.table ?? f.season.table;
  return (
    <section className="fb-panel">
      <h2>Central do campeonato</h2>
      <div className="fb-actions">
        <label>
          Temporada
          <select
            value={seasonIndex}
            onChange={(e) => {
              setSeasonIndex(Number(e.target.value));
              setRound(1);
            }}
          >
            <option value="-1">Atual · {f.season.number}</option>
            {f.seasons.map((s, i) => (
              <option key={s.number} value={i}>
                {s.number} · Série {["D", "C", "B", "A"][s.division]} ·{" "}
                {s.position}º
              </option>
            ))}
          </select>
        </label>
        <label>
          Rodada
          <select
            value={round}
            onChange={(e) => setRound(Number(e.target.value))}
          >
            {Array.from({ length: 14 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
      </div>
      {archived && !archived.fixtures ? (
        <p>
          Esta temporada anterior à V2 possui apenas o resumo preservado, sem
          calendário completo.
        </p>
      ) : (
        fixtures
          .filter((m) => m.round === round)
          .map((m) => (
            <div className="v2-fixture" key={m.id}>
              <button className="v2-name-link" onClick={() => onClub(m.home)}>
                {table.find((t) => t.id === m.home)?.name}
              </button>
              <strong>{m.score ? m.score.join(" : ") : "×"}</strong>
              <button className="v2-name-link" onClick={() => onClub(m.away)}>
                {table.find((t) => t.id === m.away)?.name}
              </button>
            </div>
          ))
      )}
      {archived?.table && (
        <details>
          <summary>Classificação final preservada</summary>
          {archived.table.map((t, i) => (
            <p key={t.id}>
              {i + 1}º {t.name} · {t.points} pontos · {t.wins}V {t.draws}E{" "}
              {t.losses}D
            </p>
          ))}
        </details>
      )}
      <p>
        Dois acessos e dois rebaixamentos entre divisões. Turno e returno em 14
        rodadas. Desempate: pontos, vitórias, saldo, gols e ID estável.
      </p>
      <small>
        {archived?.rulesVersion ?? f.season.rulesVersion} · formato compacto
        próprio, base de clubes 2024.
      </small>
    </section>
  );
}
