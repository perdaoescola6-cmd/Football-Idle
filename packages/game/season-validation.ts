import type { Season } from "../contracts/brasfoot.js";
import { GameError } from "./engine.js";

/** Check the compact eight-team season before archiving it or crediting a prize. */
export function assertCompletedSeason(season: Season, clubId: string) {
  const fail = () => {
    throw new GameError(
      "SEASON_INTEGRITY_ERROR",
      "A temporada precisa de verificação antes da premiação. Nenhum progresso foi descartado.",
      409,
    );
  };
  const ids = new Set(season.table.map((r) => r.id));
  if (
    !Number.isSafeInteger(season.number) ||
    season.number < 1 ||
    season.round !== 15 ||
    season.table.length !== 8 ||
    ids.size !== 8 ||
    !ids.has(clubId) ||
    season.fixtures.length !== 56
  )
    fail();
  const totals = new Map(
    season.table.map((r) => [
      r.id,
      { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0 },
    ]),
  );
  const fixtures = new Set<string>(),
    pairs = new Set<string>();
  const rounds = new Map<number, Set<string>>();
  for (const fixture of season.fixtures) {
    const score = fixture.score;
    const pair = JSON.stringify([fixture.home, fixture.away]);
    if (
      !fixture.id ||
      fixtures.has(fixture.id) ||
      pairs.has(pair) ||
      !Number.isInteger(fixture.round) ||
      fixture.round < 1 ||
      fixture.round > 14 ||
      fixture.home === fixture.away ||
      !ids.has(fixture.home) ||
      !ids.has(fixture.away) ||
      !Array.isArray(score) ||
      score.length !== 2 ||
      score.some((n) => !Number.isSafeInteger(n) || n < 0)
    )
      fail();
    fixtures.add(fixture.id);
    pairs.add(pair);
    const round = rounds.get(fixture.round) ?? new Set<string>();
    if (round.has(fixture.home) || round.has(fixture.away)) fail();
    round.add(fixture.home);
    round.add(fixture.away);
    rounds.set(fixture.round, round);
    for (const [side, id] of [fixture.home, fixture.away].entries()) {
      const row = totals.get(id)!,
        own = score![side],
        against = score![1 - side];
      row.played++;
      row.gf += own;
      row.ga += against;
      if (own > against) {
        row.wins++;
        row.points += 3;
      } else if (own === against) {
        row.draws++;
        row.points++;
      } else row.losses++;
    }
  }
  if (
    rounds.size !== 14 ||
    [...rounds.values()].some((round) => round.size !== 8)
  )
    fail();
  for (const row of season.table) {
    const expected = totals.get(row.id)!;
    for (const key of Object.keys(expected) as (keyof typeof expected)[])
      if (
        !Number.isSafeInteger(row[key]) ||
        row[key] < 0 ||
        row[key] !== expected[key]
      )
        fail();
  }
}
