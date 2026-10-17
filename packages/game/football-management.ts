import { GameError, type State } from "./engine.js";
import type { FootballMatch } from "../contracts/brasfoot.js";
import { playingMinute } from "../contracts/match-management.ts";
import { edition } from "./card-catalog.js";
import { effectiveCard } from "../contracts/card-model.js";
import { deriveSeed } from "./random.js";
import { simulateFootball, matchStatistics } from "./football-simulation.js";

function active(s: State, matchId: string) {
  const f = s.runtime.brasfoot,
    m = f?.match;
  if (!f || !m || m.id !== matchId)
    throw new GameError(
      "MATCH_CHANGED",
      "Esta partida já terminou ou mudou. Atualize a rodada.",
      409,
    );
  return { f, m };
}
function participants(m: FootballMatch) {
  m.participants ??= [
    ...m.home.map((card, i) => ({
      card: structuredClone(card),
      ownedId: m.homeOwnedIds?.[i],
      side: "HOME" as const,
      from: 0,
    })),
    ...m.away.map((card, i) => ({
      card: structuredClone(card),
      ownedId: m.awayOwnedIds?.[i],
      side: "AWAY" as const,
      from: 0,
    })),
  ];
  return m.participants;
}
export function pauseRound(s: State, matchId: string, now: number) {
  const { f, m } = active(s, matchId);
  if (m.pausedAt !== undefined) return;
  if (playingMinute(m, now) >= 90)
    throw new GameError("MATCH_ENDED", "A rodada já terminou.", 409);
  for (const game of [m, ...(f.roundMatches ?? [])]) game.pausedAt = now;
}
export function resumeRound(s: State, matchId: string, now: number) {
  const { f, m } = active(s, matchId);
  if (m.pausedAt === undefined)
    throw new GameError("NOT_PAUSED", "A rodada já está em andamento.", 409);
  for (const game of [m, ...(f.roundMatches ?? [])]) {
    const delta = Math.max(0, now - (game.pausedAt ?? now));
    game.totalPausedMs = (game.totalPausedMs ?? 0) + delta;
    game.endAt += delta;
    delete game.pausedAt;
  }
}
export function substituteFootball(
  s: State,
  matchId: string,
  outId: string,
  inId: string,
  now: number,
) {
  const { f, m } = active(s, matchId);
  if (m.pausedAt === undefined)
    throw new GameError(
      "PAUSE_REQUIRED",
      "Pause a rodada antes de substituir.",
      409,
    );
  if ((m.substitutions?.length ?? 0) >= 5)
    throw new GameError(
      "SUB_LIMIT",
      "Limite experimental de cinco substituições atingido.",
    );
  const side = m.homeAI ? "AWAY" : "HOME",
    team = side === "HOME" ? m.home : m.away,
    ids = side === "HOME" ? m.homeOwnedIds : m.awayOwnedIds;
  const slot = ids?.indexOf(outId) ?? -1,
    incoming = f.cards.find((c) => c.id === inId);
  if (
    slot < 0 ||
    !incoming ||
    !f.bench.includes(inId) ||
    f.listed?.includes(inId)
  )
    throw new GameError(
      "INVALID_SUB",
      "Escolha um titular atual e um reserva disponível.",
    );
  const appearances = participants(m);
  if (appearances.some((p) => p.ownedId === inId))
    throw new GameError(
      "ALREADY_PLAYED",
      "Um atleta que saiu não pode retornar nesta partida.",
    );
  const card = effectiveCard(edition(incoming.editionId), incoming),
    outgoing = team[slot];
  if (card.position !== outgoing.position)
    throw new GameError(
      "POSITION_MISMATCH",
      "Nesta versão, substitua por um reserva do mesmo setor.",
    );
  const minute = Math.floor(playingMinute(m, now));
  if (minute >= 90)
    throw new GameError("MATCH_ENDED", "A partida já terminou.");
  const participation = appearances.find(
    (p) => p.ownedId === outId && p.to === undefined,
  );
  if (participation) participation.to = minute;
  appearances.push({
    card: structuredClone(card),
    ownedId: inId,
    side,
    from: minute,
  });
  team[slot] = structuredClone(card);
  ids![slot] = inId;
  f.lineup = f.lineup.map((id) => (id === outId ? inId : id));
  f.bench = f.bench.map((id) => (id === inId ? outId : id));
  if (f.captain === outId) delete f.captain;
  m.substitutions ??= [];
  m.substitutions.push({ minute, outId, inId, side });
  const past = m.events.filter((e) => e.minute <= minute),
    score: [number, number] = [
      past.filter((e) => e.type === "GOAL" && e.side === "HOME").length,
      past.filter((e) => e.type === "GOAL" && e.side === "AWAY").length,
    ];
  const future = simulateFootball({
    seed: deriveSeed(s.runtime.secret, `SUB:${m.id}:${m.substitutions.length}`),
    home: m.home,
    away: m.away,
    ownSide: side === "HOME" ? 0 : 1,
    formation: m.formation,
    tactic: m.tactic,
    fromMinute: minute + 1,
    initialScore: score,
    fatigue: true,
    entries: Object.fromEntries(
      appearances
        .filter((p) => p.to === undefined)
        .map((p) => [p.card.id, p.from]),
    ),
  });
  m.events = [
    ...past,
    {
      minute,
      type: "SUBSTITUTION",
      side,
      actor: card.player,
      actorId: card.id,
      x: 50,
      y: 50,
      narration: `Substituição: sai ${outgoing.player}, entra ${card.player}.`,
    },
    ...future.events.filter((e) => e.minute > minute),
  ];
  m.score = future.score;
  m.engineVersion = "football-manager-v3";
  m.statistics = matchStatistics(m.events);
}
