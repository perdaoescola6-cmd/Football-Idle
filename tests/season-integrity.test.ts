import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClub } from "../packages/game/engine.js";
import {
  createSeason,
  football,
  initializeFootball,
  newFootballSeason,
  nextDivision,
  standings,
} from "../packages/game/brasfoot.js";
import { completedSeason } from "./season-fixtures.js";
import type { Season } from "../packages/contracts/brasfoot.js";
import { openDatabase } from "../apps/server/src/db.js";
import { buildApp } from "../apps/server/src/app.js";

function club() {
  const s = createClub(randomUUID(), "Ligas QA", "season-integrity", 1000);
  initializeFootball(s, 1000);
  football(s);
  return s;
}

test("each division has 14 balanced rounds and exactly one home and away fixture per opponent", () => {
  const s = club();
  for (let division = 0; division < 4; division++) {
    const season = createSeason(s, division),
      next = createSeason(s, division, 2);
    assert.equal(season.table.length, 8);
    assert.equal(season.fixtures.length, 56);
    assert.equal(new Set(season.fixtures.map((f) => f.id)).size, 56);
    assert.ok(
      next.fixtures.every(
        (f) => !season.fixtures.some((old) => old.id === f.id),
      ),
    );
    for (let round = 1; round <= 14; round++) {
      const fixtures = season.fixtures.filter((f) => f.round === round);
      assert.equal(fixtures.length, 4);
      assert.equal(new Set(fixtures.flatMap((f) => [f.home, f.away])).size, 8);
    }
    for (const team of season.table) {
      assert.equal(season.fixtures.filter((f) => f.home === team.id).length, 7);
      assert.equal(season.fixtures.filter((f) => f.away === team.id).length, 7);
      for (const opponent of season.table.filter((r) => r.id !== team.id))
        assert.equal(
          season.fixtures.filter(
            (f) => f.home === team.id && f.away === opponent.id,
          ).length,
          1,
        );
    }
  }
});

test("standing ties use points, wins, goal difference, goals and binary ID order without mutating the table", () => {
  const s = club(),
    season = createSeason(s);
  const row = { ...season.table[0], points: 10, wins: 3, gf: 5, ga: 3 };
  season.table = [
    { ...row, id: "z", points: 11 },
    { ...row, id: "y", wins: 4 },
    { ...row, id: "x", ga: 2 },
    { ...row, id: "w", gf: 6, ga: 4 },
    { ...row, id: "a0" },
    { ...row, id: "AI-0-1" },
  ].reverse();
  const before = structuredClone(season.table);
  assert.deepEqual(
    standings(season).map((r) => r.id),
    ["z", "y", "x", "w", "AI-0-1", "a0"],
  );
  assert.deepEqual(season.table, before);
});

test("incomplete or contradictory seasons cannot grant prizes or mutate progress", () => {
  const corruptions: ((season: Season) => void)[] = [
    (season) => {
      delete season.fixtures[0].score;
    },
    (season) => {
      season.table[0].points++;
    },
    (season) => {
      season.table.shift();
    },
    (season) => {
      season.fixtures[1] = structuredClone(season.fixtures[0]);
    },
    (season) => {
      season.fixtures[0].score = [-1, 0];
    },
    (season) => {
      season.fixtures[0].round = 15;
    },
    (season) => {
      season.number = 0;
    },
    (season) => {
      season.number = Number.MAX_SAFE_INTEGER;
    },
  ];
  for (const corrupt of corruptions) {
    const s = club(),
      f = football(s);
    f.season = completedSeason(s, 0);
    corrupt(f.season);
    const before = structuredClone(s);
    assert.throws(() => newFootballSeason(s, 10000));
    assert.deepEqual(s, before);
  }
});

test("division and rank bounds reject invalid values instead of promoting rank zero", () => {
  const s = club();
  for (const division of [-1, 0.5, 4, NaN]) {
    assert.throws(() => createSeason(s, division));
    assert.throws(() => nextDivision(division, 1));
  }
  for (const rank of [0, -1, 1.5, 9, NaN])
    assert.throws(() => nextDivision(0, rank));
  for (const number of [0, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => createSeason(s, 0, number));
  const expected = [
    [1, 1, 0, 0, 0, 0, 0, 0],
    [2, 2, 1, 1, 1, 1, 0, 0],
    [3, 3, 2, 2, 2, 2, 1, 1],
    [3, 3, 3, 3, 3, 3, 2, 2],
  ];
  for (let division = 0; division < 4; division++)
    for (let rank = 1; rank <= 8; rank++)
      assert.equal(nextDivision(division, rank), expected[division][rank - 1]);
});

test("season API rolls back failed prizes and pays once across concurrent retries and application rebuild", async () => {
  const db = await openDatabase({ memory: true });
  let now = 100000,
    built = await buildApp(db, { clock: () => now });
  const base = {
    origin: "http://127.0.0.1:3000",
    "x-requested-with": "football-idle",
  };
  try {
    const guest = await built.app.inject({
      method: "POST",
      url: "/v1/auth/guest",
      headers: base,
      payload: {},
    });
    const cookie = `fi_session=${guest.cookies[0].value}`,
      headers = { ...base, cookie };
    const call = (action: string, key = randomUUID()) =>
      built.app.inject({
        method: "POST",
        url: "/v1/brasfoot/command",
        headers: { ...headers, "idempotency-key": key },
        payload: { action },
      });
    const view = async () =>
      (
        await built.app.inject({ url: "/v1/bootstrap", headers: { cookie } })
      ).json().data.game;
    assert.equal(
      (
        await built.app.inject({
          method: "POST",
          url: "/v1/clubs",
          headers: { ...headers, "idempotency-key": randomUUID() },
          payload: { name: "Liga persistida" },
        })
      ).statusCode,
      201,
    );
    assert.equal((await call("INIT")).statusCode, 200);
    for (let round = 1; round <= 14; round++) {
      assert.equal((await call("PLAY")).statusCode, 200);
      now += 90000;
      await built.repo.tick();
    }
    const before = await view();
    assert.equal(before.brasfoot.season.round, 15);
    await db.query(
      "CREATE FUNCTION qa_season_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA season rollback'; END; $$",
    );
    await db.query(
      "CREATE TRIGGER qa_season_trigger BEFORE INSERT ON football_audit FOR EACH ROW WHEN (NEW.action='NEXT_SEASON') EXECUTE FUNCTION qa_season_failure()",
    );
    const key = randomUUID();
    assert.equal((await call("NEXT_SEASON", key)).statusCode, 500);
    const failed = await view();
    assert.equal(failed.wallet.balance, before.wallet.balance);
    assert.deepEqual(failed.brasfoot, before.brasfoot);
    await db.query("DROP TRIGGER qa_season_trigger ON football_audit");
    const attempts = await Promise.all([
      call("NEXT_SEASON", key),
      call("NEXT_SEASON", key),
    ]);
    assert.ok(attempts.every((r) => r.statusCode === 200));
    assert.deepEqual(attempts[0].json().data, attempts[1].json().data);
    assert.equal((await call("NEXT_SEASON")).statusCode, 422);
    const after = await view();
    assert.equal(after.brasfoot.seasons.length, 1);
    assert.equal(after.brasfoot.season.number, 2);
    assert.equal(after.brasfoot.season.round, 1);
    assert.deepEqual(after.brasfoot.cards, before.brasfoot.cards);
    assert.deepEqual(after.brasfoot.performance, before.brasfoot.performance);
    assert.equal(typeof before.club.xpTotal, "string");
    assert.deepEqual(after.club, before.club);
    for (const field of [
      "lineup",
      "bench",
      "captain",
      "organizer",
      "history",
      "lastRound",
    ])
      assert.deepEqual(after.brasfoot[field], before.brasfoot[field]);
    const position = after.brasfoot.seasons[0].position;
    const prize = position === 1 ? 15000n : position === 2 ? 8000n : 3000n;
    assert.equal(
      after.brasfoot.season.division,
      nextDivision(before.brasfoot.season.division, position),
    );
    assert.deepEqual(
      after.brasfoot.seasons[0].fixtures,
      before.brasfoot.season.fixtures,
    );
    assert.equal(
      after.brasfoot.season.rulesVersion,
      before.brasfoot.season.rulesVersion,
    );
    assert.equal(
      BigInt(after.wallet.balance),
      BigInt(before.wallet.balance) + prize,
    );
    await built.app.close();
    built = await buildApp(db, { clock: () => now });
    assert.equal((await call("NEXT_SEASON", key)).statusCode, 200);
    await built.repo.tick();
    const recovered = await view();
    assert.equal(recovered.wallet.balance, after.wallet.balance);
    assert.deepEqual(recovered.brasfoot, after.brasfoot);
    const reward = (
      await db.query<{ count: string; total: string }>(
        "SELECT count(*)::text count, sum(delta)::text total FROM coin_ledger_entries WHERE reason LIKE 'BR_SEASON_PRIZE:1:%'",
      )
    ).rows[0];
    assert.equal(reward.count, "1");
    assert.equal(reward.total, String(prize));
  } finally {
    await built.app.close();
    await db.close();
  }
});
