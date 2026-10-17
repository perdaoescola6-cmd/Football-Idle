import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  packs,
  rarities,
  slotOdds,
  phenomenonChance,
} from "../packages/contracts/brasfoot.js";
import { catalog, edition } from "../packages/game/card-catalog.js";
import { createClub, startMatch, advance } from "../packages/game/engine.js";
import { coins } from "../packages/game/gameplay.js";
import {
  initializeFootball,
  openPack,
  packRarity,
  setFootballLineup,
  sellCards,
  startFootballMatch,
  settleFootball,
  footballView,
  newFootballSeason,
  nextDivision,
  standings,
} from "../packages/game/brasfoot.js";
import { openDatabase } from "../apps/server/src/db.js";
import { buildApp } from "../apps/server/src/app.js";
import { completedSeason } from "./season-fixtures.js";

function club() {
  const s = createClub(randomUUID(), "Clube QA", "seed-br-qa", 1000);
  initializeFootball(s, 1000);
  return s;
}
test("migration waits for the active legacy match, preserves its settlement and freezes old training", () => {
  const s = createClub(randomUUID(), "Clube legado", "legacy-seed", 1000);
  s.runtime.farm.running = true;
  startMatch(s, 1000);
  initializeFootball(s, 1000);
  assert.equal(s.runtime.farm.running, false);
  assert.equal(s.runtime.brasfoot, undefined);
  assert.ok(s.current);
  const progress = advance(s, 91000);
  assert.equal(progress.settlements.length, 1);
  assert.equal(s.current, null);
  const xp = s.runtime.clubXp,
    athletes = structuredClone(s.athletes);
  initializeFootball(s, 91000);
  assert.equal(s.runtime.clubXp, xp);
  assert.deepEqual(s.athletes, athletes);
  assert.equal(s.runtime.brasfoot!.lineup.length, 11);
});
test("promotion and relegation create fresh calendars in all four divisions while keeping cards and club progress", () => {
  for (let division = 0; division < 4; division++)
    for (const promoted of [true, false]) {
      const s = club(),
        f = s.runtime.brasfoot!;
      f.season = completedSeason(s, division, promoted);
      const cards = structuredClone(f.cards),
        xp = s.runtime.clubXp;
      newFootballSeason(s);
      assert.equal(f.season.division, nextDivision(division, promoted ? 1 : 8));
      assert.equal(f.season.fixtures.length, 56);
      assert.equal(f.season.round, 1);
      assert.deepEqual(f.cards, cards);
      assert.equal(s.runtime.clubXp, xp);
    }
});
test("packs: exhaustive 10,000 outcomes per slot exactly match published odds, all floors and Fenômeno", () => {
  for (const pack of packs) {
    assert.equal(
      pack.weights.reduce((a, b) => a + b, 0),
      10000,
    );
    assert.equal(pack.floors.length, 5);
    for (let slot = 0; slot < 5; slot++) {
      const frequencies = [0, 0, 0, 0, 0];
      for (let roll = 0; roll < 10000; roll++) {
        const r = rarities.indexOf(packRarity(pack, slot, roll));
        assert.ok(r >= pack.floors[slot]);
        frequencies[r]++;
      }
      assert.deepEqual(frequencies, slotOdds(pack, slot));
      assert.equal(frequencies[4], pack.weights[4]);
    }
    assert.equal(
      phenomenonChance(pack),
      1 - (1 - pack.weights[4] / 10000) ** 5,
    );
  }
});
test("catalog: immutable rarity/rating identities; five cards, exact debit and floors on every opening", () => {
  assert.equal(new Set(catalog.map((c) => c.id)).size, catalog.length);
  for (const pack of packs)
    for (let sample = 0; sample < 60; sample++) {
      const s = club();
      coins(s, BigInt(pack.price), "QA", 1000);
      const before = BigInt(s.runtime.balance),
        r = openPack(s, pack.id, 1000);
      assert.equal(r.cards.length, 5);
      assert.equal(new Set(r.cards.map((c) => c.id)).size, 5);
      assert.equal(BigInt(s.runtime.balance), before - BigInt(pack.price));
      r.cards.forEach((c, i) => {
        assert.ok(
          rarities.indexOf(edition(c.editionId).rarity) >= pack.floors[i],
        );
        assert.ok(edition(c.editionId).rating <= 99);
      });
    }
});
test("onboarding cannot repeat; lineup positions/ownership/duplicates, safe batch sale and organizer creates only pack cards", () => {
  const s = club(),
    f = s.runtime.brasfoot!,
    legacy = structuredClone(s.athletes);
  initializeFootball(s, 2000);
  assert.equal(s.runtime.balance, "10000");
  assert.equal(f.cards.length, 11);
  assert.deepEqual(s.athletes, legacy);
  openPack(s, "basic", 1000, true);
  assert.throws(() => openPack(s, "basic", 1000, true), /já recebido/);
  setFootballLineup(s, f.lineup, [], "4-4-2", "BALANCED");
  assert.throws(() =>
    setFootballLineup(s, f.lineup.slice(0, 10), [], "4-4-2", "BALANCED"),
  );
  assert.throws(() =>
    setFootballLineup(
      s,
      [...f.lineup.slice(0, 10), randomUUID()],
      [],
      "4-4-2",
      "BALANCED",
    ),
  );
  assert.throws(() =>
    setFootballLineup(
      s,
      [...f.lineup.slice(0, 10), f.lineup[0]],
      [],
      "4-4-2",
      "BALANCED",
    ),
  );
  assert.throws(
    () => setFootballLineup(s, f.lineup, [], "4-3-3", "ATTACK"),
    /posições/,
  );
  const duplicate = { ...f.cards[0], id: randomUUID() };
  f.cards.push(duplicate);
  assert.throws(
    () => setFootballLineup(s, f.lineup, [duplicate.id], "4-4-2", "BALANCED"),
    /mesmo jogador/,
  );
  const reserve = f.cards[11];
  reserve.locked = true;
  assert.throws(() => sellCards(s, [reserve.id], 2000));
  reserve.locked = false;
  assert.throws(() => sellCards(s, [reserve.id, f.lineup[0]], 2000));
  assert.ok(f.cards.includes(reserve));
  assert.throws(() => sellCards(s, [reserve.id, reserve.id], 2000));
  setFootballLineup(s, f.lineup, [reserve.id], "4-4-2", "BALANCED");
  assert.throws(() => sellCards(s, [reserve.id], 2000));
  f.bench = [];
  const before = BigInt(s.runtime.balance);
  sellCards(s, [reserve.id], 2000);
  assert.ok(BigInt(s.runtime.balance) > before);
  f.organizer.enabled = true;
  const count = f.cards.length;
  openPack(s, "basic", 3000);
  assert.equal(f.cards.length, count + 5);
  const balance = s.runtime.balance;
  assert.throws(() => openPack(s, "superstars", 3000), /insuficientes/);
  assert.equal(s.runtime.balance, balance);
});
test("official 11v11: authoritative events, 90 seconds, snapshots, rewards once, complete balanced calendar and season transitions", () => {
  const s = club(),
    f = s.runtime.brasfoot!;
  let now = 1000;
  for (let round = 1; round <= 14; round++) {
    startFootballMatch(s, now);
    const m = f.match!;
    assert.equal(m.home.length, 11);
    assert.equal(m.away.length, 11);
    assert.equal(m.endAt - m.startAt, 90000);
    assert.throws(() => startFootballMatch(s, now));
    assert.throws(() =>
      setFootballLineup(s, f.lineup, [], "4-4-2", "BALANCED"),
    );
    assert.equal(footballView(s, now)!.match!.events.length, 1);
    assert.equal(footballView(s, now)!.match!.score, undefined);
    assert.deepEqual(m.score, [
      m.events.filter((e) => e.type === "GOAL" && e.side === "HOME").length,
      m.events.filter((e) => e.type === "GOAL" && e.side === "AWAY").length,
    ]);
    const balance = s.runtime.balance;
    settleFootball(s, now + 89999);
    assert.equal(s.runtime.balance, balance);
    settleFootball(s, now + 90000);
    const settledBalance = s.runtime.balance;
    settleFootball(s, now + 90000);
    assert.equal(s.runtime.balance, settledBalance);
    assert.equal(f.season.round, round + 1);
    assert.equal(
      f.season.table.every((t) => t.played === round),
      true,
    );
    now += 90000;
  }
  assert.equal(f.history.length, 14);
  assert.ok(f.season.fixtures.every((m) => m.score));
  for (const a of f.season.table)
    for (const b of f.season.table.filter((b) => b.id !== a.id))
      assert.equal(
        f.season.fixtures.filter((m) => m.home === a.id && m.away === b.id)
          .length,
        1,
      );
  assert.throws(() => startFootballMatch(s, now), /próxima temporada/);
  const position = standings(f.season).findIndex((t) => t.id === s.id) + 1,
    expected = nextDivision(0, position);
  newFootballSeason(s);
  assert.equal(f.season.division, expected);
  assert.equal(f.season.number, 2);
  assert.equal(f.cards.length, 11);
  for (let d = 0; d < 4; d++) {
    assert.equal(nextDivision(d, 1), Math.min(3, d + 1));
    assert.equal(nextDivision(d, 8), Math.max(0, d - 1));
    assert.equal(nextDivision(d, 4), d);
  }
});

test("API + persisted PostgreSQL: concurrent packs, idempotency, no double-spend, atomic audit rollback, ownership and recovery", async () => {
  const directory = await mkdtemp(join(tmpdir(), "futidle-br-"));
  let db = await openDatabase({ directory }),
    now = 1000000;
  let built = await buildApp(db, { clock: () => now });
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
      }),
      cookie = `fi_session=${guest.cookies[0].value}`;
    const headers = { ...base, cookie };
    const call = (body: unknown, key = randomUUID()) =>
      built.app.inject({
        method: "POST",
        url: "/v1/brasfoot/command",
        headers: { ...headers, "idempotency-key": key },
        payload: body as object,
      });
    assert.equal(
      (
        await built.app.inject({
          method: "POST",
          url: "/v1/clubs",
          headers: { ...headers, "idempotency-key": randomUUID() },
          payload: { name: "Persistência QA" },
        })
      ).statusCode,
      201,
    );
    assert.equal((await call({ action: "INIT" })).statusCode, 200);
    assert.equal((await call({ action: "INIT" })).statusCode, 200);
    assert.equal(
      (
        await db.query<{ count: string }>(
          "SELECT count(*)::text count FROM coin_ledger_entries WHERE reason='BR_ONBOARDING_ONCE'",
        )
      ).rows[0].count,
      "1",
    );
    const idem = randomUUID(),
      requests = await Promise.all([
        call({ action: "PACK", packId: "basic" }, idem),
        call({ action: "PACK", packId: "basic" }, idem),
      ]);
    assert.equal(requests[0].statusCode, 200);
    assert.deepEqual(requests[0].json().data, requests[1].json().data);
    assert.equal(
      (await call({ action: "PACK", packId: "premium" }, idem)).statusCode,
      409,
    );
    const concurrent = await Promise.all([
      call({ action: "PACK", packId: "basic" }),
      call({ action: "PACK", packId: "basic" }),
    ]);
    assert.deepEqual(concurrent.map((r) => r.statusCode).sort(), [200, 422]);
    const view = async () =>
      (
        await built.app.inject({ url: "/v1/bootstrap", headers: { cookie } })
      ).json().data.game;
    let game = await view();
    assert.equal(game.wallet.balance, "0");
    assert.equal(game.brasfoot.cards.length, 21);
    const w = await Promise.all([
      call({ action: "WELCOME" }),
      call({ action: "WELCOME" }),
    ]);
    assert.deepEqual(w.map((r) => r.statusCode).sort(), [200, 409]);
    await db.query(
      "CREATE FUNCTION qa_br_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA audit failure'; END; $$",
    );
    await db.query(
      "CREATE TRIGGER qa_br_audit BEFORE INSERT ON football_audit FOR EACH ROW EXECUTE FUNCTION qa_br_fail()",
    );
    game = await view();
    const id = game.brasfoot.cards.find(
      (c: { id: string }) => !game.brasfoot.lineup.includes(c.id),
    ).id;
    const failed = await call({ action: "SELL", ids: [id] });
    assert.equal(failed.statusCode, 500);
    assert.equal((await view()).brasfoot.cards.length, 26);
    assert.equal((await view()).wallet.balance, "0");
    await db.query("DROP TRIGGER qa_br_audit ON football_audit");
    const sold = await call({ action: "SELL", ids: [id] });
    assert.equal(sold.statusCode, 200);
    assert.equal(
      (await call({ action: "SELL", ids: [randomUUID()] })).statusCode,
      422,
    );
    assert.equal((await call({ action: "PLAY" })).statusCode, 200);
    game = await view();
    assert.equal(game.brasfoot.match.score, undefined);
    assert.equal(game.brasfoot.match.events.length, 1);
    assert.ok(!JSON.stringify(game.brasfoot).includes("secret"));
    await built.app.close();
    await db.close();
    db = await openDatabase({ directory });
    built = await buildApp(db, { clock: () => now });
    game = await view();
    assert.ok(game.brasfoot.match);
    assert.equal(game.brasfoot.cards.length, 25);
    now += 90000;
    await built.repo.tick();
    game = await view();
    assert.equal(game.brasfoot.history.length, 1);
    assert.equal(game.brasfoot.season.round, 2);
    const balance = game.wallet.balance;
    await built.repo.tick();
    assert.equal((await view()).wallet.balance, balance);
    assert.equal(
      (
        await db.query<{ total: string }>(
          "SELECT sum(delta)::text total FROM coin_ledger_entries",
        )
      ).rows[0].total,
      balance,
    );
    await assert.rejects(() =>
      db.query("UPDATE football_audit SET action='TAMPER'"),
    );
    const noauth = await built.app.inject({
      method: "POST",
      url: "/v1/brasfoot/command",
      headers: { ...base, "idempotency-key": randomUUID() },
      payload: { action: "PACK", packId: "basic" },
    });
    assert.equal(noauth.statusCode, 401);
    const csrf = await built.app.inject({
      method: "POST",
      url: "/v1/brasfoot/command",
      headers: { cookie, "idempotency-key": randomUUID() },
      payload: { action: "PACK", packId: "basic" },
    });
    assert.equal(csrf.statusCode, 403);
  } finally {
    await built.app.close().catch(() => {});
    await db.close().catch(() => {});
    assert.ok(directory.startsWith(join(tmpdir(), "futidle-br-")));
    await rm(directory, { recursive: true, force: true });
  }
});
