import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClub } from "../packages/game/engine.js";
import { catalog, edition } from "../packages/game/card-catalog.js";
import {
  effectiveCard,
  playerIdentity,
} from "../packages/contracts/card-model.js";
import {
  footballView,
  initializeFootball,
  startFootballMatch,
  settleFootball,
} from "../packages/game/brasfoot.js";
import {
  pauseRound,
  resumeRound,
  substituteFootball,
} from "../packages/game/football-management.js";
import {
  simulateFootball,
  matchStatistics,
} from "../packages/game/football-simulation.js";
import { deriveSeed } from "../packages/game/random.js";
import type { FootballEvent } from "../packages/contracts/brasfoot.js";

const sportingEvents = (events: FootballEvent[]) =>
  events.map(
    ({ minute, type, side, actor, receiverName, assistName, narration }) => ({
      minute,
      type,
      side,
      actor,
      receiverName,
      assistName,
      narration,
    }),
  );

test("fatigue is scoped by team when opponents use the same card edition", () => {
  const home = catalog.slice(0, 11),
    away = structuredClone(home);
  const fresh = Object.fromEntries(away.map((c) => [c.id, 60]));
  const distinct = away.map((c) => ({ ...c, id: `opponent:${c.id}` }));
  let observedEntryEffect = false;
  for (let seed = 0; seed < 32; seed++) {
    const input = {
      seed: `same-edition-${seed}`,
      home,
      away,
      ownSide: 0,
      formation: "4-4-2" as const,
      tactic: "BALANCED" as const,
      fatigue: true,
      fromMinute: 60,
    };
    const overlapping = simulateFootball({
      ...input,
      entries: { HOME: {}, AWAY: fresh },
    });
    const renamed = simulateFootball({
      ...input,
      away: distinct,
      entries: {
        HOME: {},
        AWAY: Object.fromEntries(distinct.map((c) => [c.id, 60])),
      },
    });
    assert.deepEqual(
      sportingEvents(overlapping.events),
      sportingEvents(renamed.events),
    );
    assert.deepEqual(overlapping.score, renamed.score);
    const tired = simulateFootball({
      ...input,
      entries: { HOME: {}, AWAY: {} },
    });
    if (
      JSON.stringify(sportingEvents(tired.events)) !==
      JSON.stringify(sportingEvents(overlapping.events))
    )
      observedEntryEffect = true;
  }
  assert.ok(
    observedEntryEffect,
    "An opponent entering at minute 60 must not be treated as having played since kickoff.",
  );
});

test("an unrelated substitution preserves active captain influence, published events and one-time settlement at home and away", () => {
  for (const round of [1, 2]) {
    const s = createClub(
      randomUUID(),
      "Continuidade",
      "continuity-secret",
      1000,
    );
    initializeFootball(s, 1000);
    const f = s.runtime.brasfoot!;
    f.season.round = round;
    f.captain = f.lineup[9];
    const identities = new Set(
      f.cards.map((c) => playerIdentity(edition(c.editionId))),
    );
    const incoming = catalog.find(
      (c) => c.position === "DEF" && !identities.has(playerIdentity(c)),
    )!;
    const owned = {
      id: randomUUID(),
      editionId: incoming.id,
      locked: false,
      storage: "COLLECTION" as const,
      acquiredAt: 1000,
    };
    f.cards.push(owned);
    f.bench.push(owned.id);
    startFootballMatch(s, 1000);
    const m = f.match!,
      side = m.homeAI ? "AWAY" : "HOME";
    const ids = side === "HOME" ? m.homeOwnedIds! : m.awayOwnedIds!;
    const outId = ids[2],
      past = structuredClone(m.events.filter((e) => e.minute <= 38));
    const home = structuredClone(m.home),
      away = structuredClone(m.away);
    (side === "HOME" ? home : away)[2] = effectiveCard(incoming, owned);
    const entries = {
      HOME: Object.fromEntries(
        home.map((c) => [
          c.id,
          side === "HOME" && c.id === incoming.id ? 38 : 0,
        ]),
      ),
      AWAY: Object.fromEntries(
        away.map((c) => [
          c.id,
          side === "AWAY" && c.id === incoming.id ? 38 : 0,
        ]),
      ),
    };
    const initialScore: [number, number] = [
      past.filter((e) => e.type === "GOAL" && e.side === "HOME").length,
      past.filter((e) => e.type === "GOAL" && e.side === "AWAY").length,
    ];
    let witness: ReturnType<typeof simulateFootball> | undefined;
    for (let candidate = 0; candidate < 128; candidate++) {
      m.id = `captain-witness-${round}-${candidate}`;
      const input = {
        seed: deriveSeed(s.runtime.secret, `SUB:${m.id}:1`),
        home,
        away,
        ownSide: side === "HOME" ? 0 : 1,
        formation: m.formation,
        tactic: m.tactic,
        fromMinute: 39,
        initialScore,
        fatigue: true,
        entries,
      };
      const retained = simulateFootball({ ...input, captain: m.captainId });
      const lost = simulateFootball(input);
      if (JSON.stringify(retained.events) !== JSON.stringify(lost.events)) {
        witness = retained;
        break;
      }
    }
    assert.ok(
      witness,
      "Fixed seeds must include a sporting outcome affected by captain influence.",
    );
    pauseRound(s, m.id, 39800);
    const visibleBefore = footballView(s, 39800)!.match!.events;
    substituteFootball(s, m.id, outId, owned.id, 39800);
    assert.deepEqual(m.events.slice(0, past.length), past);
    assert.deepEqual(
      m.events.filter((e) => e.minute > 38),
      witness.events,
    );
    assert.deepEqual(m.score, witness.score);
    assert.deepEqual(m.statistics, matchStatistics(m.events));
    const visibleAfter = footballView(s, 86400000)!.match!;
    assert.deepEqual(
      visibleAfter.events.filter((e) => e.type !== "SUBSTITUTION"),
      visibleBefore,
    );
    assert.ok(visibleAfter.events.every((e) => e.minute <= 38));
    assert.equal(visibleAfter.score, undefined);
    assert.deepEqual(
      visibleAfter.statistics,
      matchStatistics(visibleAfter.events),
    );
    const recovered = JSON.parse(JSON.stringify(s)) as typeof s;
    resumeRound(recovered, m.id, 86400000);
    settleFootball(recovered, recovered.runtime.brasfoot!.match!.endAt);
    resumeRound(s, m.id, 86400000);
    settleFootball(s, m.endAt);
    assert.equal(recovered.runtime.balance, s.runtime.balance);
    assert.deepEqual(
      recovered.runtime.brasfoot!.history,
      JSON.parse(JSON.stringify(f.history)),
    );
    assert.deepEqual(recovered.runtime.brasfoot!.performance, f.performance);
    const paid = s.runtime.balance,
      saved = JSON.stringify(f.history),
      journal = s.journal!.length;
    settleFootball(s, m.endAt + 100000);
    assert.equal(s.runtime.balance, paid);
    assert.equal(JSON.stringify(f.history), saved);
    assert.equal(s.journal!.length, journal);
  }
});
