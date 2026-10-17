import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  acquirePresence,
  advance,
  createClub,
  ensureRenewals,
  heartbeat,
  releasePresence,
  setFarm,
  setLineup,
  type State,
} from "../packages/game/engine.js";
import {
  addAthleteXp,
  levelForXp,
  rarityForRoll,
  threshold,
} from "../packages/game/rules.js";
import { randomStream } from "../packages/game/random.js";
const start = 1_000_000;
function club(seed = "test-seed") {
  return createClub(randomUUID(), "União de Teste", seed, start);
}
function online(s: State, from: number, to: number) {
  s.runtime.presence.intervals = [{ start: from, end: to }];
  s.runtime.presence.validUntil = to;
}
test("exact rarity boundaries preserve conditional weights", () => {
  for (const [roll, rarity] of [
    [0, "P1"],
    [74484, "P1"],
    [74485, "P2"],
    [94484, "P2"],
    [94485, "P3"],
    [99484, "P3"],
    [99485, "P4"],
    [99984, "P4"],
    [99985, "P5"],
    [99999, "P5"],
  ] as const)
    assert.equal(rarityForRoll(roll), rarity);
  assert.throws(() => rarityForRoll(100000));
});
test("levels remain unbounded and exact at large boundaries, while attributes saturate", () => {
  for (const l of [2n, 6n, 9999999999999999999999999999n]) {
    assert.equal(levelForXp(threshold(l)), l);
    assert.equal(levelForXp(threshold(l) - 1n), l - 1n);
  }
  const s = club(),
    a = s.athletes[0];
  addAthleteXp(a, threshold(100000000000000n));
  assert.equal(a.level, "100000000000000");
  for (const key of Object.keys(a.attributes) as (keyof typeof a.attributes)[])
    assert.equal(a.attributes[key], a.caps[key]);
  assert.ok(a.ovr <= 99);
});
test("Regional unlocks after the 40th online match and survives a lineup change", () => {
  const s = club();
  online(s, start, start + 3_700_000);
  setFarm(s, true, "VARZEA", start);
  const before = advance(s, start + 39 * 90000, 100);
  assert.equal(before.settlements.length, 39);
  assert.equal(s.runtime.clubXp, "1092");
  assert.equal(s.runtime.regionalUnlocked, false);
  const last = advance(s, start + 40 * 90000, 100);
  assert.equal(last.settlements.length, 1);
  assert.equal(s.runtime.clubXp, "1120");
  assert.equal(s.runtime.regionalUnlocked, true);
  const snapshot = last.settlements[0].match;
  assert.equal(
    snapshot.events.filter((e) => e.type === "PASS_COMPLETED").length,
    9,
  );
  assert.equal(
    snapshot.events.filter((e) => e.type === "SHOT_RESOLVED").length,
    9,
  );
  for (const a of s.athletes.filter((a) => a.origin === "STARTER")) {
    assert.equal(a.xpTotal, "800");
    assert.equal(a.level, "6");
    assert.equal(a.ovr, 25);
  }
  setLineup(s, [...s.runtime.lineup].reverse(), s.runtime.lineupVersion);
  assert.equal(s.runtime.regionalUnlocked, true);
  assert.equal(advance(s, start + 40 * 90000, 100).settlements.length, 0);
});
test("deterministic recovery keeps score, replay and drops and keeps visual RNG independent", () => {
  const s = club("stable-seed");
  online(s, start, start + 100000);
  setFarm(s, true, "VARZEA", start);
  const recovered = structuredClone(s),
    a = advance(s, start + 90000),
    b = advance(recovered, start + 90000);
  assert.deepEqual(a, b);
  const match = a.settlements[0].match,
    goals = match.events.filter(
      (e) => e.type === "SHOT_RESOLVED" && e.payload.outcome === "GOAL",
    );
  assert.equal(
    goals.filter((e) => e.payload.team === "HOME").length,
    match.result!.homeGoals,
  );
  assert.equal(
    goals.filter((e) => e.payload.team === "AWAY").length,
    match.result!.awayGoals,
  );
  const stream = randomStream("seed", "sport"),
    other = randomStream("seed", "sport");
  randomStream("seed", "visual")(100);
  assert.equal(stream(100000), other(100000));
});
test("lineup is immutable for an active match and validates ownership/version", () => {
  const s = club();
  online(s, start, start + 200000);
  setFarm(s, true, "VARZEA", start);
  const original = s.current!.view.home.map((a) => a.id);
  setLineup(s, [...s.runtime.lineup].reverse(), 1);
  assert.deepEqual(
    s.current!.view.home.map((a) => a.id),
    original,
  );
  assert.throws(() => setLineup(s, [...s.runtime.lineup], 1));
  assert.throws(() =>
    setLineup(s, [...s.runtime.lineup.slice(0, 4), randomUUID()], 2),
  );
});
test("a late reconnect never makes a mixed match eligible for an athlete", () => {
  const s = club();
  online(s, start, start + 89999);
  setFarm(s, true, "VARZEA", start);
  const match = advance(s, start + 90000).settlements[0].match;
  assert.equal(match.reward!.mode, "MIXED");
  assert.equal(match.reward!.athlete, null);
  assert.equal(match.reward!.ineligibleMs, 1);
  assert.equal(match.reward!.material, 0);
});
test("releasing presence at the instant of starting cannot earn rewards without a budget", () => {
  const s = club(),
    p = acquirePresence(s, "tab", start);
  setFarm(s, true, "VARZEA", start);
  releasePresence(s, "tab", p.generation, start);
  const result = advance(s, start + 90000).settlements[0].match.reward!;
  assert.equal(result.mode, "INELIGIBLE");
  assert.equal(result.coins, "0");
  assert.equal(result.clubXp, "0");
  assert.equal(result.athlete, null);
  assert.equal(result.material, 0);
});
test("heartbeats do not stack across tabs, cannot extend by repetition and need ten continuous minutes", () => {
  const s = club(),
    first = acquirePresence(s, "tab1", start);
  heartbeat(s, "tab1", first.generation, 1, start + 10000);
  const until = s.runtime.presence.validUntil;
  heartbeat(s, "tab1", first.generation, 1, start + 15000);
  assert.equal(s.runtime.presence.validUntil, until);
  const second = acquirePresence(s, "tab2", start + 20000);
  assert.equal(s.runtime.presence.intervals.length, 1);
  assert.throws(() => heartbeat(s, "tab1", first.generation, 2, start + 20001));
  let seq = 0;
  for (let at = start + 30000; at <= start + 600000; at += 10000)
    heartbeat(s, "tab2", second.generation, ++seq, at);
  assert.equal(s.runtime.budgets.length, 1);
  assert.equal(s.runtime.budgets[0].openedAt, start + 600000);
  releasePresence(s, "tab2", second.generation, start + 600000);
  acquirePresence(s, "tab3", start + 610000);
  ensureRenewals(s, start + 620000);
  assert.equal(s.runtime.budgets.length, 1);
});
test("24h offline budget caps rewards and never grants athletes", () => {
  const s = club();
  online(s, start - 600000, start);
  ensureRenewals(s, start);
  s.runtime.farm = {
    running: true,
    region: "VARZEA",
    version: 1,
    sequence: 0,
    nextAt: start,
  };
  const progress = advance(s, start + 26 * 3600000, 2000);
  assert.equal(progress.settlements.length, 960);
  assert.equal(s.runtime.budgets[0].usedMs, 86400000);
  assert.equal(s.runtime.clubXp, "13440");
  assert.equal(s.athletes.length, 5);
  assert.equal(s.current, null);
  for (const a of s.athletes) assert.equal(a.xpTotal, "9600");
  for (const item of progress.settlements) {
    assert.equal(item.match.reward!.mode, "OFFLINE");
    assert.equal(item.match.reward!.athlete, null);
  }
  assert.ok(
    BigInt(s.runtime.balance) >= 4800n && BigInt(s.runtime.balance) <= 7200n,
  );
});
test("partial budget uses exact proportions and does not debit a later renewal", () => {
  const s = club();
  online(s, start - 600000, start);
  ensureRenewals(s, start);
  s.runtime.budgets[0].usedMs = 86400000 - 45000;
  s.runtime.farm = {
    running: true,
    region: "VARZEA",
    version: 1,
    sequence: 0,
    nextAt: start,
  };
  const result = advance(s, start + 90000).settlements[0].match.reward!;
  assert.equal(result.offlineMs, 45000);
  assert.equal(result.ineligibleMs, 45000);
  assert.equal(result.clubXp, "7");
  assert.equal(result.material, 0);
  assert.equal(result.athlete, null);
  const again = club();
  online(again, start - 600000, start);
  ensureRenewals(again, start);
  again.runtime.presence.intervals.push({
    start: start + 90000,
    end: start + 800000,
  });
  ensureRenewals(again, start + 800000);
  again.runtime.farm = {
    running: true,
    region: "VARZEA",
    version: 1,
    sequence: 0,
    nextAt: start,
  };
  advance(again, start + 90000);
  assert.equal(again.runtime.budgets[0].usedMs, 90000);
  assert.equal(again.runtime.budgets[1].usedMs, 0);
});
