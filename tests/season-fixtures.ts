import { createSeason } from "../packages/game/brasfoot.js";
import type { State } from "../packages/game/engine.js";

/** Complete synthetic results for transition tests; every other fixture is a draw. */
export function completedSeason(s: State, division: number, champion = true) {
  const season = createSeason(s, division);
  for (const fixture of season.fixtures) {
    const home = season.table.find((r) => r.id === fixture.home)!;
    const away = season.table.find((r) => r.id === fixture.away)!;
    fixture.score =
      fixture.home === s.id
        ? champion
          ? [2, 0]
          : [0, 2]
        : fixture.away === s.id
          ? champion
            ? [0, 2]
            : [2, 0]
          : [0, 0];
    const [a, b] = fixture.score;
    home.played++;
    away.played++;
    home.gf += a;
    home.ga += b;
    away.gf += b;
    away.ga += a;
    if (a === b) {
      home.draws++;
      away.draws++;
      home.points++;
      away.points++;
    } else {
      const winner = a > b ? home : away,
        loser = a > b ? away : home;
      winner.wins++;
      winner.points += 3;
      loser.losses++;
    }
  }
  season.round = 15;
  return season;
}
