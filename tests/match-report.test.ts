import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClub } from "../packages/game/engine.js";
import {
  initializeFootball,
  startFootballMatch,
  settleFootball,
} from "../packages/game/brasfoot.js";
import {
  pauseRound,
  resumeRound,
  substituteFootball,
} from "../packages/game/football-management.js";
import { catalog, edition } from "../packages/game/card-catalog.js";
import { playerIdentity } from "../packages/contracts/card-model.js";
import {
  matchStatistics,
  participantReport,
  playerMatchRating,
} from "../packages/contracts/match-report.js";
import { playerEnergy } from "../packages/contracts/match-management.js";

test("match report preserves substituted players, freezes exit condition and uses exactly the career grading formula", () => {
  const s = createClub(randomUUID(), "Relatório QA", "match-report", 1000);
  initializeFootball(s, 1000);
  const f = s.runtime.brasfoot!,
    outId = f.lineup[2],
    outCard = edition(f.cards.find((c) => c.id === outId)!.editionId),
    identities = new Set(
      f.cards.map((c) => playerIdentity(edition(c.editionId))),
    ),
    incoming = catalog.find(
      (c) => c.position === "DEF" && !identities.has(playerIdentity(c)),
    )!,
    id = randomUUID();
  f.cards.push({
    id,
    editionId: incoming.id,
    locked: false,
    storage: "COLLECTION",
    acquiredAt: 1000,
  });
  f.bench = [id];
  f.captain = outId;
  startFootballMatch(s, 1000);
  const m = f.match!;
  assert.equal(m.captainId, outCard.id);
  pauseRound(s, m.id, 41000);
  substituteFootball(s, m.id, outId, id, 41000);
  resumeRound(s, m.id, 51000);
  settleFootball(s, m.endAt);
  const rows = participantReport(m),
    side = m.homeAI ? "AWAY" : "HOME",
    own = rows.filter((r) => r.side === side),
    out = own.find((r) => r.card.id === outCard.id)!,
    entry = own.find((r) => r.card.id === incoming.id)!;
  assert.equal(own.length, 12);
  assert.equal(out.minutes, 40);
  assert.equal(entry.minutes, 50);
  assert.equal(out.energy, playerEnergy(outCard, 40));
  assert.equal(entry.energy, playerEnergy(incoming, 90, 40));
  assert.equal(
    own.reduce((n, r) => n + r.minutes, 0),
    990,
  );
  for (const r of rows) {
    assert.equal(r.rating, playerMatchRating(m, r.card, r.side));
    assert.ok(r.rating! >= 1 && r.rating! <= 10);
    assert.equal(
      r.goals,
      m.events.filter(
        (e) =>
          e.type === "GOAL" && e.side === r.side && e.actorId === r.card.id,
      ).length,
    );
  }
  const total = matchStatistics(m.events);
  assert.equal(
    rows.filter((r) => r.side === "HOME").reduce((n, r) => n + r.goals, 0),
    total.home.goals,
  );
  assert.equal(
    rows.filter((r) => r.side === "AWAY").reduce((n, r) => n + r.goals, 0),
    total.away.goals,
  );
  assert.equal(f.performance![playerIdentity(outCard)].ratingTotal, out.rating);
});

test("partial and historical reports never invent future participation or final grades", () => {
  const s = createClub(randomUUID(), "Parcial QA", "partial-report", 1000);
  initializeFootball(s, 1000);
  startFootballMatch(s, 1000);
  const m = s.runtime.brasfoot!.match!,
    partial = participantReport(m, 20);
  assert.ok(partial.every((r) => r.rating === null && r.minutes === 20));
  assert.equal(
    partial.reduce((n, r) => n + r.goals, 0),
    m.events.filter((e) => e.minute <= 20 && e.type === "GOAL").length,
  );
  const empty = matchStatistics([]);
  assert.equal(empty.home.possession, 50);
  assert.equal(empty.away.possession, 50);
  assert.equal(empty.home.shots, 0);
  assert.equal(empty.away.goals, 0);
  const legacy = {
    ...m,
    participants: undefined,
    engineVersion: "historical-unknown",
  };
  assert.ok(
    participantReport(legacy).every(
      (r) => r.rating === null && r.energy === null,
    ),
  );
});
