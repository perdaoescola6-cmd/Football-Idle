import type {
  CardEdition,
  FootballEvent,
  FootballMatch,
  TeamMatchStats,
} from "./brasfoot.js";
import { playerEnergy } from "./match-management.ts";
export function participantReport(match: FootballMatch, minute = 90) {
  const cut = Math.max(0, Math.min(90, minute)),
    events = match.events.filter((e) => e.minute <= cut);
  const source = match.participants ?? [
    ...match.home.map((card) => ({
      card,
      side: "HOME" as const,
      from: 0,
      to: undefined,
    })),
    ...match.away.map((card) => ({
      card,
      side: "AWAY" as const,
      from: 0,
      to: undefined,
    })),
  ];
  const known = ["football-events-v2", "football-manager-v3"].includes(
    match.engineVersion ?? "",
  );
  const played = {
    ...match,
    events,
    score: [
      events.filter((e) => e.type === "GOAL" && e.side === "HOME").length,
      events.filter((e) => e.type === "GOAL" && e.side === "AWAY").length,
    ] as [number, number],
  };
  return source
    .filter((p) => p.from <= cut)
    .map((p) => {
      const until = Math.min(cut, p.to ?? cut),
        minutes = Math.max(0, until - p.from);
      return {
        card: p.card,
        side: p.side,
        from: p.from,
        to: p.to,
        minutes,
        goals: events.filter(
          (e) =>
            e.side === p.side && e.type === "GOAL" && e.actorId === p.card.id,
        ).length,
        assists: events.filter(
          (e) =>
            e.side === p.side && e.type === "GOAL" && e.assistId === p.card.id,
        ).length,
        saves: events.filter(
          (e) =>
            e.side === p.side && e.type === "SAVE" && e.actorId === p.card.id,
        ).length,
        energy:
          match.engineVersion === "football-manager-v3"
            ? playerEnergy(p.card, until, p.from)
            : null,
        rating:
          known && cut === 90 && minutes > 0
            ? playerMatchRating(played, p.card, p.side)
            : null,
      };
    });
}
export function matchStatistics(events: FootballEvent[]): {
  home: TeamMatchStats;
  away: TeamMatchStats;
} {
  const stats = () => ({
    shots: 0,
    shotsOnTarget: 0,
    saves: 0,
    passes: 0,
    possession: 0,
    goals: 0,
  });
  const home = stats(),
    away = stats();
  let homePoss = 0,
    awayPoss = 0;
  for (const e of events) {
    const own = e.side === "HOME" ? home : away,
      other = e.side === "HOME" ? away : home;
    if (e.type === "PASS") {
      own.passes++;
      e.side === "HOME" ? homePoss++ : awayPoss++;
    }
    if (e.type === "SHOT") own.shots++;
    if (e.type === "GOAL") {
      own.goals++;
      own.shotsOnTarget++;
    }
    if (e.type === "SAVE") {
      own.saves++;
      other.shotsOnTarget++;
    }
  }
  home.possession =
    homePoss + awayPoss
      ? Math.round((homePoss * 100) / (homePoss + awayPoss))
      : 50;
  away.possession = 100 - home.possession;
  return { home, away };
}
export function playerMatchRating(
  match: FootballMatch,
  card: CardEdition,
  side: "HOME" | "AWAY",
) {
  const goals = match.events.filter(
    (e) => e.type === "GOAL" && e.actorId === card.id && e.side === side,
  ).length;
  const assists = match.events.filter(
    (e) => e.type === "GOAL" && e.assistId === card.id && e.side === side,
  ).length;
  const saves = match.events.filter(
    (e) => e.type === "SAVE" && e.actorId === card.id && e.side === side,
  ).length;
  const passes = match.events.filter(
    (e) => e.type === "PASS" && e.actorId === card.id && e.side === side,
  ).length;
  const conceded = match.score?.[side === "HOME" ? 1 : 0] ?? 0;
  return Math.max(
    1,
    Math.min(
      10,
      Math.round(
        (6 +
          goals * 0.8 +
          assists * 0.5 +
          saves * 0.15 +
          passes * 0.025 +
          (card.position === "GOL"
            ? conceded === 0
              ? 0.6
              : -conceded * 0.15
            : 0)) *
          10,
      ) / 10,
    ),
  );
}
