import type { FootballState, FootballMatch } from "../contracts/brasfoot.js";
import { playerIdentity } from "../contracts/card-model.js";
import { playerMatchRating } from "./football-simulation.js";
export function ensureCareer(f: FootballState, clubId: string) {
  f.performance ??= {};
  if (!f.careerV2) {
    const row = f.season.table.find((t) => t.id === clubId);
    f.careerV2 = {
      matches: row?.played ?? 0,
      wins: row?.wins ?? 0,
      draws: row?.draws ?? 0,
      losses: row?.losses ?? 0,
      gf: row?.gf ?? 0,
      ga: row?.ga ?? 0,
      points: row?.points ?? 0,
      titles: f.seasons.filter((s) => s.position === 1).length,
      promotions: f.seasons.filter((s) => s.nextDivision > s.division).length,
      form: [],
      sinceSeason: f.season.number,
    };
  }
}
export function recordPerformance(
  f: FootballState,
  match: FootballMatch,
  clubId: string,
  clubName: string,
) {
  ensureCareer(f, clubId);
  if (
    !["football-events-v2", "football-manager-v3"].includes(
      match.engineVersion ?? "",
    )
  )
    return;
  const side = match.homeAI ? ("AWAY" as const) : ("HOME" as const),
    team = side === "HOME" ? match.home : match.away,
    conceded = match.score![side === "HOME" ? 1 : 0];
  const appearances = match.participants
    ? match.participants
        .filter((p) => p.side === side)
        .map((p) => ({
          card: p.card,
          minutes: Math.max(0, (p.to ?? 90) - p.from),
        }))
    : team.map((card) => ({ card, minutes: 90 }));
  for (const { card, minutes } of appearances) {
    if (minutes <= 0) continue;
    const id = playerIdentity(card),
      p = (f.performance![id] ??= {
        playerId: id,
        editionId: card.id,
        name: card.player,
        position: card.position,
        role: card.role,
        appearances: 0,
        minutes: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        saves: 0,
        passes: 0,
        shots: 0,
        ratingTotal: 0,
        ratedMatches: 0,
        lastClub: clubName,
        seasons: {},
      });
    const goals = match.events.filter(
        (e) => e.type === "GOAL" && e.side === side && e.actorId === card.id,
      ).length,
      assists = match.events.filter(
        (e) => e.type === "GOAL" && e.side === side && e.assistId === card.id,
      ).length;
    p.appearances++;
    p.minutes += minutes;
    p.goals += goals;
    p.assists += assists;
    p.cleanSheets +=
      card.position === "GOL" && conceded === 0 && minutes === 90 ? 1 : 0;
    p.saves += match.events.filter(
      (e) => e.type === "SAVE" && e.side === side && e.actorId === card.id,
    ).length;
    p.shots += match.events.filter(
      (e) => e.type === "SHOT" && e.side === side && e.actorId === card.id,
    ).length;
    p.passes += match.events.filter(
      (e) => e.type === "PASS" && e.side === side && e.actorId === card.id,
    ).length;
    p.ratingTotal += playerMatchRating(match, card, side);
    p.ratedMatches++;
    p.lastClub = clubName;
    const season = (p.seasons[String(f.season.number)] ??= {
      appearances: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
    });
    season.appearances++;
    season.goals += goals;
    season.assists += assists;
    season.cleanSheets +=
      card.position === "GOL" && conceded === 0 && minutes === 90 ? 1 : 0;
    season.minutes = (season.minutes ?? 0) + minutes;
    season.saves =
      (season.saves ?? 0) +
      match.events.filter(
        (e) => e.type === "SAVE" && e.side === side && e.actorId === card.id,
      ).length;
    season.passes =
      (season.passes ?? 0) +
      match.events.filter(
        (e) => e.type === "PASS" && e.side === side && e.actorId === card.id,
      ).length;
    season.shots =
      (season.shots ?? 0) +
      match.events.filter(
        (e) => e.type === "SHOT" && e.side === side && e.actorId === card.id,
      ).length;
    season.ratingTotal =
      (season.ratingTotal ?? 0) + playerMatchRating(match, card, side);
    season.ratedMatches = (season.ratedMatches ?? 0) + 1;
  }
}
