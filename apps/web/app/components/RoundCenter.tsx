"use client";
import { useState } from "react";
import type {
  CardEdition,
  FootballView,
} from "../../../../packages/contracts/brasfoot";
import {
  playingMinute,
  playerEnergy,
} from "../../../../packages/contracts/match-management";
import { substitutionAdvice } from "../../../../packages/contracts/substitution-advisor";
import { MatchExperience } from "./MatchExperience";

export function RoundCenter({
  f,
  now,
  busy,
  execute,
  onPlayer,
}: {
  f: FootballView;
  now: number;
  busy: boolean;
  execute: (body: Record<string, unknown>) => Promise<unknown>;
  onPlayer: (c: CardEdition) => void;
}) {
  const [selected, setSelected] = useState(""),
    [outId, setOut] = useState(""),
    [inId, setIn] = useState(""),
    [advisorOpen, setAdvisorOpen] = useState(false);
  const live = f.match,
    games = live
      ? [live, ...(f.roundMatches ?? [])]
      : (f.lastRound?.matches ?? []);
  const detail =
    games.find((m) => m.id === selected) ??
    games.find((m) => !m.homeAI || !m.awayAI) ??
    games[0];
  if (!games.length) return null;
  const minute = live ? playingMinute(live, now) : 90,
    paused = live?.pausedAt !== undefined;
  const ownTeam = live ? (live.homeAI ? live.away : live.home) : [],
    ids = live
      ? ((live.homeAI ? live.awayOwnedIds : live.homeOwnedIds) ?? [])
      : [];
  const outgoing = ids.includes(outId) ? outId : (ids[1] ?? ids[0]),
    slot = ids.indexOf(outgoing),
    outCard = ownTeam[slot];
  const reserves = f.bench
    .map((id) => f.cards.find((c) => c.id === id)!)
    .filter((c) => c && !live?.participants?.some((p) => p.ownedId === c.id))
    .map((c) => ({
      owned: c,
      card: f.catalog.find((d) => d.id === c.editionId)!,
    }))
    .filter((c) => c.card && c.card.position === outCard?.position);
  const incoming = reserves.find((c) => c.owned.id === inId) ?? reserves[0];
  const suggestions = advisorOpen ? substitutionAdvice(f, minute) : [];
  return (
    <section className="manager-round">
      <div className="fb-panel">
        <div className="manager-round-heading">
          <div>
            <p className="eyebrow">CENTRAL DA RODADA · CAMPANHA INDIVIDUAL</p>
            <h2>
              {live
                ? `Rodada ${f.season.round}`
                : `Última rodada · ${f.lastRound?.round ?? ""}`}
            </h2>
            <p>
              {Math.floor(minute)}′ ·{" "}
              {live
                ? paused
                  ? "Rodada pausada"
                  : "Todos os confrontos em andamento"
                : "Resultados confirmados"}
            </p>
          </div>
          {live ? (
            <button
              disabled={busy}
              onClick={() =>
                void execute({
                  action: paused ? "RESUME" : "PAUSE",
                  matchId: live.id,
                })
              }
            >
              {paused ? "Continuar rodada" : "Pausar rodada"}
            </button>
          ) : null}
        </div>
        <div
          className="manager-scoreboard"
          aria-label="Placares simultâneos da rodada"
        >
          {games.map((m) => {
            const events = m.events.filter(
                (e) => e.minute <= Math.floor(minute),
              ),
              score = m.score ?? [
                events.filter((e) => e.type === "GOAL" && e.side === "HOME")
                  .length,
                events.filter((e) => e.type === "GOAL" && e.side === "AWAY")
                  .length,
              ],
              goal = events.filter((e) => e.type === "GOAL").at(-1);
            return (
              <button
                className={`manager-fixture ${detail?.id === m.id ? "selected" : ""}`}
                key={m.id}
                aria-label={`Ver jogo ${m.homeName} contra ${m.awayName}`}
                aria-pressed={detail?.id === m.id}
                onClick={() => setSelected(m.id)}
              >
                <span>{m.homeName}</span>
                <b>
                  {score[0]} × {score[1]}
                </b>
                <span>{m.awayName}</span>
                <small>
                  {goal
                    ? `⚽ ${goal.actor} ${Math.floor(goal.minute)}′`
                    : "Sem gols"}
                </small>
              </button>
            );
          })}
        </div>
        <p className="v2-note">
          Clique num confronto para abrir súmula, estatísticas e escalações. A
          pausa interrompe os quatro jogos da sua campanha, sem afetar outros
          usuários.
        </p>
      </div>
      {live && paused ? (
        <section className="fb-panel manager-substitutions">
          <h3>Decisões do treinador</h3>
          <button
            className="advisor-toggle"
            aria-expanded={advisorOpen}
            onClick={() => setAdvisorOpen(!advisorOpen)}
          >
            {advisorOpen ? "Fechar assistente" : "Consultar assistente"}
          </button>
          {advisorOpen ? (
            <div className="advisor-panel">
              <p>
                Estimativa por OVR e condição, usando o redutor do motor. Não
                prevê o resultado nem muda jogadores automaticamente.
              </p>
              {suggestions.length ? (
                suggestions.map((advice) => (
                  <article key={advice.outId + advice.inId}>
                    <div>
                      <strong>
                        {advice.outName} → {advice.inName}
                      </strong>
                      <small>
                        {advice.sector} · condição {advice.energy}% · força
                        estimada {advice.before.toFixed(1)} →{" "}
                        {advice.after.toFixed(1)} · ganho +
                        {advice.gain.toFixed(1)}
                      </small>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setOut(advice.outId);
                        setIn(advice.inId);
                      }}
                    >
                      Preparar troca
                    </button>
                  </article>
                ))
              ) : (
                <p>
                  Nenhuma melhora estimada disponível com os reservas elegíveis.
                  Você ainda pode escolher uma troca manual.
                </p>
              )}
              <small>
                As sugestões priorizam ganho estimado e respeitam banco, setor,
                reentrada, anúncios e limite de trocas. A confirmação abaixo
                continua obrigatória.
              </small>
            </div>
          ) : null}
          <p>
            {live.substitutions?.length ?? 0} / 5 substituições · regra
            experimental · reposição pelo mesmo setor.
          </p>
          <div className="fb-actions">
            <label>
              Sai
              <select
                value={outgoing ?? ""}
                onChange={(e) => {
                  setOut(e.target.value);
                  setIn("");
                }}
              >
                {ownTeam.map((c, i) => {
                  const p = live.participants?.find(
                    (p) => p.ownedId === ids[i] && p.to === undefined,
                  );
                  return (
                    <option key={ids[i]} value={ids[i]}>
                      {c.player} · {c.role ?? c.position} ·{" "}
                      {playerEnergy(c, minute, p?.from ?? 0)}%
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Entra
              <select
                value={incoming?.owned.id ?? ""}
                onChange={(e) => setIn(e.target.value)}
              >
                {!reserves.length ? (
                  <option value="">Sem reserva disponível neste setor</option>
                ) : (
                  reserves.map((c) => (
                    <option key={c.owned.id} value={c.owned.id}>
                      {c.card.player} · {c.card.role ?? c.card.position} · 100%
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              disabled={
                busy || !incoming || (live.substitutions?.length ?? 0) >= 5
              }
              onClick={() =>
                void execute({
                  action: "SUBSTITUTE",
                  matchId: live.id,
                  outId: outgoing,
                  inId: incoming?.owned.id,
                })
              }
            >
              Confirmar substituição
            </button>
          </div>
          <p className="v2-note">
            Selecione o banco antes de começar. Quem saiu não retorna. A
            condição se recupera totalmente no próximo jogo; não há espera nem
            consumíveis.
          </p>
        </section>
      ) : null}
      {!live ? (
        <div className="matchdesk-next">
          <a href="#round-controls">Preparar próxima rodada</a>
          <a href="#championship-table">Ver classificação</a>
        </div>
      ) : null}
      {detail ? (
        <MatchExperience
          key={detail.id}
          match={detail}
          live={Boolean(live)}
          minute={Math.floor(minute)}
          onPlayer={onPlayer}
        />
      ) : null}
    </section>
  );
}
